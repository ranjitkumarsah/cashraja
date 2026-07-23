import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models/game.dart';
import '../../../core/providers.dart';
import '../../../core/theme/raja_colors.dart';
import '../../../core/theme/raja_theme.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/coin_balance.dart';
import '../../../core/widgets/coin_glyph.dart';
import '../../../core/widgets/gradient_background.dart';
import '../../../core/widgets/primary_button.dart';
import '../../ads/banner_ad_widget.dart';
import '../../ads/claim_reward_flow.dart';
import '../../wallet/presentation/wallet_controllers.dart';

/// Lifecycle of a single play session.
enum _Phase {
  picking,
  starting,
  playing,
  verifying,
  readyToClaim,
  completing,
  result,
  capReached,
  error,
}

/// The D1 "Play & Win" mini-game. A round is server-issued (`round-start`),
/// the number-recognition game is pure client-side UX, and the coin reward is
/// whatever the server returns from `round-complete` — the local score is never
/// trusted for coins.
class GameScreen extends ConsumerStatefulWidget {
  const GameScreen({super.key});

  @override
  ConsumerState<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends ConsumerState<GameScreen> {
  final Random _rng = Random();

  _Phase _phase = _Phase.picking;
  GameRound? _round;
  RoundResult? _result;
  String _message = '';

  int _score = 0;
  int _target = 0;
  List<int> _grid = const <int>[];
  DateTime _startedAt = DateTime.now();
  Timer? _verifyTimer;

  @override
  void dispose() {
    _verifyTimer?.cancel();
    super.dispose();
  }

  GameDifficulty get _difficulty => _round?.difficulty ?? GameDifficulty.easy;

  Future<void> _start(GameDifficulty difficulty) async {
    setState(() => _phase = _Phase.starting);
    try {
      final GameRound round =
          await ref.read(apiClientProvider).startGameRound(difficulty);
      if (!mounted) return;
      setState(() {
        _round = round;
        _score = 0;
        _startedAt = DateTime.now();
        _phase = _Phase.playing;
        _nextChallenge();
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      final bool cap = e.statusCode == 429 ||
          e.message.contains('daily_round_cap_reached');
      setState(() {
        _phase = cap ? _Phase.capReached : _Phase.error;
        _message = cap
            ? 'You\'ve hit today\'s game limit. Come back tomorrow for more rounds.'
            : e.message;
      });
    }
  }

  void _nextChallenge() {
    final int n = _difficulty.gridSize * _difficulty.gridSize;
    final int target = _rng.nextInt(10);
    final List<int> grid = List<int>.generate(n, (_) => _rng.nextInt(10));
    // Guarantee the target appears at least once.
    grid[_rng.nextInt(n)] = target;
    _target = target;
    _grid = grid;
  }

  void _onTapTile(int value) {
    if (_phase != _Phase.playing) return;
    if (value != _target) {
      // Wrong tap — light haptic-style nudge, no progress.
      return;
    }
    _score += 1;
    if (_score >= _difficulty.targets) {
      _finishPlay();
    } else {
      setState(_nextChallenge);
    }
  }

  void _finishPlay() {
    final Duration elapsed = DateTime.now().difference(_startedAt);
    final Duration min = _difficulty.minPlayTime;
    if (elapsed >= min) {
      _onCleared();
      return;
    }
    // Hold the round open until the minimum play time so a genuine round is
    // never rejected as `round_completed_too_fast`.
    setState(() => _phase = _Phase.verifying);
    _verifyTimer?.cancel();
    _verifyTimer = Timer(min - elapsed, () {
      if (mounted) _onCleared();
    });
  }

  /// Local play is done and the round is genuine (min play time met). Show the
  /// win claim popup (G4): the coins come from the server `reward_preview`, and
  /// only a completed ad watch calls round-complete to actually credit.
  void _onCleared() {
    setState(() => _phase = _Phase.readyToClaim);
    _promptClaim();
  }

  Future<void> _promptClaim() async {
    final GameRound? round = _round;
    if (round == null || !mounted) return;
    final ClaimOutcome outcome = await showAdGatedClaim(
      context,
      ref,
      coins: round.rewardPreview,
      title: 'Round cleared!',
      subtitle: 'Watch a short ad to claim your coins.',
    );
    if (!mounted) return;
    switch (outcome) {
      case ClaimOutcome.claimed:
        await _complete();
      case ClaimOutcome.adIncomplete:
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Watch the full ad to claim your coins.')),
        );
      // Stay on the readyToClaim view so they can try again or forfeit.
      case ClaimOutcome.closed:
        // Forfeited — round-complete is never called, so no reward is credited.
        _reset();
    }
  }

  Future<void> _complete() async {
    final GameRound? round = _round;
    if (round == null) return;
    setState(() => _phase = _Phase.completing);
    try {
      final RoundResult result = await ref
          .read(apiClientProvider)
          .completeGameRound(round.roundId, clientScore: _score);
      if (!mounted) return;
      await ref.read(walletControllerProvider.notifier).refresh();
      if (!mounted) return;
      setState(() {
        _result = result;
        _phase = _Phase.result;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _phase = _Phase.error;
        _message = _friendlyRoundError(e);
      });
    }
  }

  String _friendlyRoundError(ApiException e) {
    if (e.statusCode == 410 || e.message.contains('round_expired')) {
      return 'This round expired. Start a fresh one to keep earning.';
    }
    if (e.statusCode == 409 || e.message.contains('round_not_active')) {
      return 'This round was already played. Start a new one.';
    }
    if (e.statusCode == 400 || e.message.contains('round_completed_too_fast')) {
      return 'That was a little too quick — give it a moment and try again.';
    }
    return e.message;
  }

  void _reset() {
    setState(() {
      _phase = _Phase.picking;
      _round = null;
      _result = null;
      _score = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Play & Win')),
      extendBodyBehindAppBar: true,
      body: GradientBackground(
        child: SafeArea(
          child: Column(
            children: <Widget>[
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 260),
                    child: _buildBody(),
                  ),
                ),
              ),
              // G3 (3b): banner anchored at the bottom, clear of the game grid.
              const Padding(
                padding: EdgeInsets.only(bottom: 8),
                child: BannerAdWidget(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBody() {
    switch (_phase) {
      case _Phase.picking:
        return _DifficultyPicker(key: const ValueKey<String>('pick'), onPick: _start);
      case _Phase.starting:
      case _Phase.completing:
        return const Center(
          key: ValueKey<String>('busy'),
          child: CircularProgressIndicator(color: RajaColors.gold),
        );
      case _Phase.playing:
        return _GameBoard(
          key: const ValueKey<String>('board'),
          target: _target,
          grid: _grid,
          gridSize: _difficulty.gridSize,
          progress: _score / _difficulty.targets,
          scoreLabel: '$_score / ${_difficulty.targets}',
          onTapTile: _onTapTile,
        );
      case _Phase.verifying:
        return const _VerifyingView(key: ValueKey<String>('verify'));
      case _Phase.readyToClaim:
        return _ReadyToClaimView(
          key: const ValueKey<String>('claim'),
          coins: _round?.rewardPreview ?? 0,
          onClaim: _promptClaim,
          onForfeit: _reset,
        );
      case _Phase.result:
        return _ResultView(
          key: const ValueKey<String>('result'),
          result: _result!,
          onPlayAgain: _reset,
        );
      case _Phase.capReached:
        return _MessageView(
          key: const ValueKey<String>('cap'),
          icon: Icons.hourglass_bottom_rounded,
          title: 'That\'s a wrap for today',
          message: _message,
          actionLabel: 'Back',
          onAction: () => Navigator.of(context).maybePop(),
        );
      case _Phase.error:
        return _MessageView(
          key: const ValueKey<String>('err'),
          icon: Icons.error_outline_rounded,
          title: 'Round didn\'t count',
          message: _message,
          actionLabel: 'Try again',
          onAction: _reset,
        );
    }
  }
}

class _DifficultyPicker extends StatelessWidget {
  const _DifficultyPicker({super.key, required this.onPick});

  final void Function(GameDifficulty) onPick;

  static const Map<GameDifficulty, int> _reward = <GameDifficulty, int>{
    GameDifficulty.easy: 5,
    GameDifficulty.medium: 10,
    GameDifficulty.hard: 20,
  };

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: <Widget>[
        Text(
          'Pick your challenge',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 6),
        const Text(
          'Spot the number to clear each round. Harder tiers pay out more.',
          style: TextStyle(color: RajaColors.textSecondary, height: 1.4),
        ),
        const SizedBox(height: 20),
        for (final GameDifficulty d in GameDifficulty.values) ...<Widget>[
          _DifficultyTile(
            difficulty: d,
            reward: _reward[d]!,
            onTap: () => onPick(d),
          ),
          const SizedBox(height: 12),
        ],
      ],
    );
  }
}

class _DifficultyTile extends StatelessWidget {
  const _DifficultyTile({
    required this.difficulty,
    required this.reward,
    required this.onTap,
  });

  final GameDifficulty difficulty;
  final int reward;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.all(18),
      child: Row(
        children: <Widget>[
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: RajaColors.surfaceHigh,
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(Icons.grid_view_rounded, color: RajaColors.gold),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  difficulty.label,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: RajaColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${difficulty.targets} rounds · ${difficulty.gridSize}×${difficulty.gridSize} grid',
                  style: const TextStyle(
                    color: RajaColors.textMuted,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          const CoinGlyph(size: 18),
          const SizedBox(width: 6),
          Text(
            '$reward',
            style: const TextStyle(
              color: RajaColors.gold,
              fontWeight: FontWeight.w800,
              fontSize: 16,
              fontFeatures: RajaTheme.tabularFigures,
            ),
          ),
        ],
      ),
    );
  }
}

class _GameBoard extends StatelessWidget {
  const _GameBoard({
    super.key,
    required this.target,
    required this.grid,
    required this.gridSize,
    required this.progress,
    required this.scoreLabel,
    required this.onTapTile,
  });

  final int target;
  final List<int> grid;
  final int gridSize;
  final double progress;
  final String scoreLabel;
  final void Function(int value) onTapTile;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: <Widget>[
            const Text(
              'Find the number',
              style: TextStyle(color: RajaColors.textSecondary),
            ),
            Text(
              scoreLabel,
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                color: RajaColors.textPrimary,
                fontFeatures: RajaTheme.tabularFigures,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 8,
            backgroundColor: RajaColors.surfaceHigh,
            valueColor: const AlwaysStoppedAnimation<Color>(RajaColors.gold),
          ),
        ),
        const SizedBox(height: 24),
        Center(
          child: Column(
            children: <Widget>[
              const Text(
                'TAP',
                style: TextStyle(
                  color: RajaColors.textMuted,
                  letterSpacing: 3,
                  fontWeight: FontWeight.w700,
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '$target',
                key: ValueKey<int>(target),
                style: const TextStyle(
                  fontSize: 64,
                  fontWeight: FontWeight.w900,
                  color: RajaColors.gold,
                  fontFeatures: RajaTheme.tabularFigures,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        Expanded(
          child: Center(
            child: AspectRatio(
              aspectRatio: 1,
              child: GridView.builder(
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: gridSize,
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                ),
                itemCount: grid.length,
                itemBuilder: (_, int i) => _NumberTile(
                  value: grid[i],
                  onTap: () => onTapTile(grid[i]),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _NumberTile extends StatelessWidget {
  const _NumberTile({required this.value, required this.onTap});

  final int value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: RajaColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: RajaColors.border),
          ),
          child: Center(
            child: Text(
              '$value',
              style: const TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w800,
                color: RajaColors.textPrimary,
                fontFeatures: RajaTheme.tabularFigures,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _VerifyingView extends StatelessWidget {
  const _VerifyingView({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          const CircularProgressIndicator(color: RajaColors.gold),
          const SizedBox(height: 20),
          Text(
            'Locking in your round…',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 6),
          const Text(
            'Verifying a fair round before crediting coins.',
            textAlign: TextAlign.center,
            style: TextStyle(color: RajaColors.textMuted),
          ),
        ],
      ),
    );
  }
}

/// Shown after a genuine round clears, alongside the claim popup (G4). If the
/// popup's ad is not completed, the user lands here to retry or forfeit.
class _ReadyToClaimView extends StatelessWidget {
  const _ReadyToClaimView({
    super.key,
    required this.coins,
    required this.onClaim,
    required this.onForfeit,
  });

  final int coins;
  final VoidCallback onClaim;
  final VoidCallback onForfeit;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          const Icon(Icons.emoji_events_rounded, size: 56, color: RajaColors.gold),
          const SizedBox(height: 18),
          Text('Round cleared!', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          const Text('Claim your reward',
              style: TextStyle(color: RajaColors.textSecondary)),
          const SizedBox(height: 10),
          CoinBalance(amount: coins, fontSize: 40, glyphSize: 32),
          const SizedBox(height: 28),
          SizedBox(
            width: 260,
            child: PrimaryButton(
              label: 'Claim reward',
              icon: Icons.smart_display_rounded,
              onPressed: onClaim,
            ),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: onForfeit,
            child: const Text('Forfeit',
                style: TextStyle(color: RajaColors.textMuted)),
          ),
        ],
      ),
    );
  }
}

class _ResultView extends StatelessWidget {
  const _ResultView({super.key, required this.result, required this.onPlayAgain});

  final RoundResult result;
  final VoidCallback onPlayAgain;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          TweenAnimationBuilder<double>(
            tween: Tween<double>(begin: 0.6, end: 1),
            duration: const Duration(milliseconds: 400),
            curve: Curves.easeOutBack,
            builder: (_, double scale, Widget? child) =>
                Transform.scale(scale: scale, child: child),
            child: Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RajaColors.goldGradient,
                boxShadow: <BoxShadow>[
                  BoxShadow(
                    color: RajaColors.gold.withValues(alpha: 0.4),
                    blurRadius: 28,
                  ),
                ],
              ),
              child: const Icon(Icons.check_rounded,
                  size: 52, color: Color(0xFF1A1300)),
            ),
          ),
          const SizedBox(height: 24),
          Text('Round cleared!', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          const Text('You earned', style: TextStyle(color: RajaColors.textSecondary)),
          const SizedBox(height: 10),
          CoinBalance(amount: result.coinsEarned, fontSize: 44, glyphSize: 36),
          const SizedBox(height: 12),
          Text(
            '${result.dailyCapRemaining} rounds left today',
            style: const TextStyle(color: RajaColors.textMuted),
          ),
          const SizedBox(height: 32),
          SizedBox(
            width: 260,
            child: PrimaryButton(
              label: result.dailyCapRemaining > 0 ? 'Play again' : 'Done',
              icon: result.dailyCapRemaining > 0 ? Icons.replay_rounded : null,
              onPressed: result.dailyCapRemaining > 0
                  ? onPlayAgain
                  : () => Navigator.of(context).maybePop(),
            ),
          ),
        ],
      ),
    );
  }
}

class _MessageView extends StatelessWidget {
  const _MessageView({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(icon, size: 56, color: RajaColors.textMuted),
          const SizedBox(height: 18),
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: RajaColors.textSecondary, height: 1.4),
          ),
          const SizedBox(height: 28),
          SizedBox(
            width: 200,
            child: PrimaryButton(label: actionLabel, onPressed: onAction),
          ),
        ],
      ),
    );
  }
}
