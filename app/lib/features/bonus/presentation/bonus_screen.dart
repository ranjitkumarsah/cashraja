import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models/bonus.dart';
import '../../../core/theme/raja_colors.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../../core/widgets/coin_balance.dart';
import '../../../core/widgets/gradient_background.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/widgets/status_chip.dart';
import '../../ads/banner_ad_widget.dart';
import '../../ads/claim_reward_flow.dart';
import 'bonus_controller.dart';

/// D3 "Scratch & Spin". Two daily-bonus games sharing one server contract: the
/// prize is rolled server-side, and the reveal animation always shows the
/// server-returned `prize_coins` — never a client-chosen outcome.
class BonusScreen extends StatelessWidget {
  const BonusScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Scratch & Spin'),
          bottom: const TabBar(
            indicatorColor: RajaColors.gold,
            labelColor: RajaColors.gold,
            unselectedLabelColor: RajaColors.textMuted,
            tabs: <Widget>[
              Tab(text: 'Scratch'),
              Tab(text: 'Spin'),
            ],
          ),
        ),
        extendBodyBehindAppBar: true,
        body: const GradientBackground(
          child: SafeArea(
            // Tabs switch only by tapping the Scratch/Spin labels — swiping is
            // disabled so a horizontal scratch drag can never be stolen by the
            // TabBarView and jump to the other tab (owner bug: right→left
            // scratch used to swipe to Spin).
            child: TabBarView(
              physics: NeverScrollableScrollPhysics(),
              children: <Widget>[
                _BonusTab(kind: BonusKind.scratch),
                _BonusTab(kind: BonusKind.spin),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _BonusTab extends ConsumerStatefulWidget {
  const _BonusTab({required this.kind});

  final BonusKind kind;

  @override
  ConsumerState<_BonusTab> createState() => _BonusTabState();
}

class _BonusTabState extends ConsumerState<_BonusTab>
    with SingleTickerProviderStateMixin {
  late final AnimationController _spin;
  final Random _rng = Random();

  double _spinFrom = 0;
  double _spinTo = 0;

  BonusPlayResult? _result;
  bool _revealed = false;
  bool _playing = false;

  /// Bumped to hand the scratch card a fresh key so its foil re-covers after a
  /// forfeit / play-again.
  int _scratchNonce = 0;

  @override
  void initState() {
    super.initState();
    _spin = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    );
  }

  @override
  void dispose() {
    _spin.dispose();
    super.dispose();
  }

  /// Scratch flow (two-step, mirrors spin): once the foil is cleared past the
  /// threshold, the server rolls + reserves the prize (no credit) and the REAL
  /// coin amount is revealed on the card immediately — before any ad. The claim
  /// popup then shows those same coins: Claim → rewarded ad → credit the
  /// reservation; Close → forfeit (re-cover the card, never credited). A 0-coin
  /// scratch reveals "No win" with no ad. The server is always authoritative.
  Future<void> _scratchRoll() async {
    final BonusState? s =
        ref.read(bonusControllerProvider(widget.kind)).valueOrNull;
    if (s == null || !s.canPlay || _playing || _revealed) return;

    setState(() => _playing = true);
    try {
      final BonusRollResult roll =
          await ref.read(bonusControllerProvider(widget.kind).notifier).roll();
      if (!mounted) return;
      // Reveal the real prize on the card right away (not "?"), pre-ad.
      setState(() {
        _result = BonusPlayResult(
          prizeCoins: roll.prizeCoins,
          newBalance: 0,
          attemptsRemaining: roll.attemptsRemaining,
        );
        _revealed = true;
        _playing = false;
      });

      // A losing scratch (0 coins) has nothing to claim — leave it revealed.
      if (!roll.isWin) return;

      final ClaimOutcome outcome = await showAdGatedClaim(
        context,
        ref,
        coins: roll.prizeCoins,
        title: 'Daily scratch card',
        subtitle: 'Watch a short ad to claim your prize.',
        icon: Icons.auto_awesome_rounded,
      );
      if (!mounted) return;
      switch (outcome) {
        case ClaimOutcome.claimed:
          await _claimScratch(roll.reservationId);
        case ClaimOutcome.adUnavailable:
          // No ad to show right now — don't waste the consumed attempt; credit
          // the prize the user already revealed.
          await _claimScratch(roll.reservationId);
        case ClaimOutcome.adIncomplete:
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
                content: Text('Watch the full ad to claim your prize.')),
          );
          _forfeitScratch();
        case ClaimOutcome.closed:
          _forfeitScratch();
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _playing = false);
      // Attempt-limit or other errors — refresh state so the UI reflects it.
      await ref.read(bonusControllerProvider(widget.kind).notifier).refresh();
      if (!mounted) return;
      _forfeitScratch();
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _claimScratch(String reservationId) async {
    try {
      final BonusPlayResult result = await ref
          .read(bonusControllerProvider(widget.kind).notifier)
          .claim(reservationId);
      if (!mounted) return;
      // Card is already revealed with these coins; refresh with the credited
      // result (same prize, real balance).
      setState(() => _result = result);
    } on ApiException catch (e) {
      if (!mounted) return;
      _forfeitScratch();
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  /// Re-cover the scratch foil after a forfeit/failure, so the un-credited
  /// reveal is cleared. The reserved attempt was already consumed server-side.
  void _forfeitScratch() {
    if (!mounted) return;
    setState(() {
      _revealed = false;
      _result = null;
      _scratchNonce += 1;
    });
  }

  /// Spin flow (Issue 4): tap Spin → the server rolls + reserves the prize (no
  /// credit) → the wheel decelerates onto that exact segment → THEN the claim
  /// popup shows the won amount. Claim → rewarded ad → credit the reservation;
  /// Close → forfeit the reserved prize (never credited). The server is always
  /// authoritative — the client only animates onto the server's choice.
  Future<void> _spinNow() async {
    final BonusState? s =
        ref.read(bonusControllerProvider(widget.kind)).valueOrNull;
    if (s == null || !s.canPlay || _playing || _revealed) return;

    setState(() => _playing = true);
    try {
      final BonusRollResult roll =
          await ref.read(bonusControllerProvider(widget.kind).notifier).roll();
      if (!mounted) return;
      // Aim the wheel at the reserved prize and spin.
      _prepareSpinTarget(s.prizes, roll.prizeCoins);
      await _spin.forward(from: 0);
      if (!mounted) return;
      setState(() => _playing = false);

      // A losing spin (0 coins) has nothing to claim — reveal it directly.
      if (!roll.isWin) {
        setState(() {
          _result = BonusPlayResult(
            prizeCoins: 0,
            newBalance: 0,
            attemptsRemaining: roll.attemptsRemaining,
          );
          _revealed = true;
        });
        return;
      }

      final ClaimOutcome outcome = await showAdGatedClaim(
        context,
        ref,
        coins: roll.prizeCoins,
        title: 'You won!',
        subtitle: 'Watch a short ad to claim your coins.',
        icon: Icons.casino_rounded,
      );
      if (!mounted) return;
      switch (outcome) {
        case ClaimOutcome.claimed:
          await _claimSpin(roll.reservationId);
        case ClaimOutcome.adUnavailable:
          // No ad available — credit the reserved prize rather than waste the
          // consumed spin attempt.
          await _claimSpin(roll.reservationId);
        case ClaimOutcome.adIncomplete:
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
                content: Text('Watch the full ad to claim your prize.')),
          );
          _resetSpin();
        case ClaimOutcome.closed:
          _resetSpin();
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _playing = false);
      await ref.read(bonusControllerProvider(widget.kind).notifier).refresh();
      if (!mounted) return;
      _resetSpin();
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _claimSpin(String reservationId) async {
    try {
      final BonusPlayResult result = await ref
          .read(bonusControllerProvider(widget.kind).notifier)
          .claim(reservationId);
      if (!mounted) return;
      setState(() {
        _result = result;
        _revealed = true;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      _resetSpin();
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  /// Clears a forfeited/failed spin without revealing a prize. The reserved
  /// attempt was already consumed server-side, so `canPlay` reflects that.
  void _resetSpin() {
    if (!mounted) return;
    setState(() {
      _revealed = false;
      _result = null;
    });
  }

  /// Compute the wheel's target angle so the pointer (top) lands on the segment
  /// for [prizeCoins]. Segment i is centred at `i*sweep + sweep/2` (canvas 0rad
  /// = 3 o'clock, clockwise); the pointer sits at -pi/2, so the wheel must turn
  /// to `-pi/2 - center`, plus several full spins for the decelerating effect.
  void _prepareSpinTarget(List<int> prizes, int prizeCoins) {
    _spinFrom = _spinTo % (2 * pi);
    final double targetMod = _landingAngleFor(prizes, prizeCoins);
    final int turns = 5 + _rng.nextInt(2); // 5–6 full revolutions
    final double delta = (targetMod - _spinFrom) % (2 * pi);
    _spinTo = _spinFrom + turns * 2 * pi + delta;
  }

  double _landingAngleFor(List<int> prizes, int prizeCoins) {
    if (prizes.isEmpty) return _rng.nextDouble() * 2 * pi;
    int idx = prizes.indexOf(prizeCoins);
    if (idx < 0) idx = 0;
    final double sweep = 2 * pi / prizes.length;
    final double center = idx * sweep + sweep / 2;
    return (-pi / 2 - center) % (2 * pi);
  }

  /// "Play again" after a revealed prize.
  void _reset() {
    setState(() {
      _result = null;
      _revealed = false;
      _scratchNonce += 1;
    });
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<BonusState> state =
        ref.watch(bonusControllerProvider(widget.kind));
    return RefreshIndicator(
      color: RajaColors.gold,
      backgroundColor: RajaColors.surface,
      onRefresh: () =>
          ref.read(bonusControllerProvider(widget.kind).notifier).refresh(),
      child: AsyncValueView<BonusState>(
        value: state,
        onRetry: () =>
            ref.read(bonusControllerProvider(widget.kind).notifier).refresh(),
        data: (BonusState s) => ListView(
          padding: const EdgeInsets.all(20),
          children: <Widget>[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: <Widget>[
                Text(
                  widget.kind == BonusKind.scratch
                      ? 'Daily scratch card'
                      : 'Spin the wheel',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                StatusChip(
                  label: '${s.attemptsRemaining} left',
                  tone: s.attemptsRemaining > 0
                      ? StatusTone.info
                      : StatusTone.neutral,
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              widget.kind == BonusKind.scratch
                  ? 'Reveal your free daily prize. Odds are fair and set by the server.'
                  : 'Spin for a server-fair prize, once your free daily plays are ready.',
              style: const TextStyle(color: RajaColors.textSecondary, height: 1.4),
            ),
            const SizedBox(height: 28),
            Center(
              child: widget.kind == BonusKind.scratch
                  ? _ScratchCard(
                      key: ValueKey<int>(_scratchNonce),
                      revealed: _revealed,
                      result: _result,
                      canScratch: s.canPlay && !_playing,
                      onThresholdReached: _scratchRoll,
                    )
                  : _SpinWheel(
                      animation: _spin,
                      from: _spinFrom,
                      to: _spinTo,
                      revealed: _revealed,
                      result: _result,
                      prizes: s.prizes,
                    ),
            ),
            if (widget.kind == BonusKind.scratch && !_revealed) ...<Widget>[
              const SizedBox(height: 12),
              Text(
                s.canPlay
                    ? 'Scratch the card to reveal your prize.'
                    : 'No scratch cards left today.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: RajaColors.textMuted, fontSize: 13),
              ),
            ],
            const SizedBox(height: 32),
            _actionButton(s),
            // G5 (3d): banner under the win/reveal area.
            if (_revealed) ...<Widget>[
              const SizedBox(height: 20),
              const Center(child: BannerAdWidget()),
            ],
          ],
        ),
      ),
    );
  }

  Widget _actionButton(BonusState s) {
    if (_revealed) {
      final bool more = s.attemptsRemaining > 0;
      return PrimaryButton(
        label: more
            ? (widget.kind == BonusKind.scratch ? 'Scratch again' : 'Spin again')
            : 'Come back tomorrow',
        icon: more ? Icons.replay_rounded : null,
        onPressed: more ? _reset : null,
      );
    }
    // Scratch is driven by the gesture on the card; spin uses this button.
    if (widget.kind == BonusKind.scratch) {
      return const SizedBox.shrink();
    }
    final bool canPlay = s.canPlay && !_playing;
    return PrimaryButton(
      label: 'Spin now',
      loading: _playing,
      onPressed: canPlay ? _spinNow : null,
    );
  }
}

class _PrizeReveal extends StatelessWidget {
  const _PrizeReveal({required this.result});

  final BonusPlayResult result;

  @override
  Widget build(BuildContext context) {
    if (!result.isWin) {
      return const Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(Icons.sentiment_neutral_rounded,
              color: RajaColors.textSecondary, size: 40),
          SizedBox(height: 8),
          Text(
            'No win this time',
            style: TextStyle(
              color: RajaColors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      );
    }
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        const Text('YOU WON',
            style: TextStyle(
              color: RajaColors.textMuted,
              letterSpacing: 2,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            )),
        const SizedBox(height: 8),
        CoinBalance(amount: result.prizeCoins, fontSize: 34, glyphSize: 28),
      ],
    );
  }
}

/// Real scratch-to-reveal card (G6). The gold foil is drawn over the prize area
/// and the user drags a finger to erase it (a `CustomPainter` clearing circles
/// along the drag path). Once ~45% is scratched, [onThresholdReached] fires,
/// which rolls + reserves the prize server-side and reveals the real coin
/// amount on the card before the ad-gated claim.
class _ScratchCard extends StatefulWidget {
  const _ScratchCard({
    super.key,
    required this.revealed,
    required this.result,
    required this.canScratch,
    required this.onThresholdReached,
  });

  final bool revealed;
  final BonusPlayResult? result;
  final bool canScratch;
  final VoidCallback onThresholdReached;

  @override
  State<_ScratchCard> createState() => _ScratchCardState();
}

class _ScratchCardState extends State<_ScratchCard> {
  static const double _width = 240;
  static const double _height = 160;
  // Coarse occupancy grid used to estimate the scratched fraction.
  static const int _cols = 12;
  static const int _rows = 8;
  static const double _revealFraction = 0.45;

  final List<Offset> _points = <Offset>[];
  final Set<int> _cells = <int>{};
  bool _fired = false;

  void _addPoint(Offset local) {
    if (!widget.canScratch || widget.revealed || _fired) return;
    if (local.dx < 0 || local.dy < 0 || local.dx > _width || local.dy > _height) {
      return;
    }
    final int col = (local.dx / (_width / _cols)).floor().clamp(0, _cols - 1);
    final int row = (local.dy / (_height / _rows)).floor().clamp(0, _rows - 1);
    setState(() {
      _points.add(local);
      _cells.add(row * _cols + col);
    });
    if (_cells.length / (_cols * _rows) >= _revealFraction) {
      _fired = true;
      widget.onThresholdReached();
    }
  }

  @override
  Widget build(BuildContext context) {
    final BonusPlayResult? result = widget.result;
    return SizedBox(
      width: _width,
      height: _height,
      child: Stack(
        alignment: Alignment.center,
        children: <Widget>[
          // Prize layer (mystery until the server rolls it post-ad).
          DecoratedBox(
            decoration: BoxDecoration(
              color: RajaColors.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: RajaColors.border),
            ),
            child: Center(
              child: widget.revealed && result != null
                  ? _PrizeReveal(result: result)
                  : const Icon(Icons.card_giftcard_rounded,
                      color: RajaColors.textMuted, size: 40),
            ),
          ),
          // Scratchable gold foil.
          if (!widget.revealed)
            GestureDetector(
              onPanStart: (DragStartDetails d) => _addPoint(d.localPosition),
              onPanUpdate: (DragUpdateDetails d) => _addPoint(d.localPosition),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: CustomPaint(
                  size: const Size(_width, _height),
                  // Hand the painter a fresh snapshot each build so it is a
                  // different list instance from the previous delegate — the
                  // foil then actually repaints (erases) as the finger drags.
                  painter: _FoilPainter(points: List<Offset>.of(_points)),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _FoilPainter extends CustomPainter {
  _FoilPainter({required this.points});

  final List<Offset> points;

  @override
  void paint(Canvas canvas, Size size) {
    final Rect rect = Offset.zero & size;
    canvas.saveLayer(rect, Paint());
    // Gold foil.
    final Paint foil = Paint()
      ..shader = RajaColors.goldGradient.createShader(rect);
    canvas.drawRect(rect, foil);
    // "Scratch here" hint.
    final TextPainter tp = TextPainter(
      textDirection: TextDirection.ltr,
      text: const TextSpan(
        text: 'Scratch here',
        style: TextStyle(
          color: Color(0xFF1A1300),
          fontWeight: FontWeight.w800,
          fontSize: 15,
        ),
      ),
    )..layout();
    tp.paint(canvas, Offset((size.width - tp.width) / 2, (size.height - tp.height) / 2));
    // Erase along the drag path.
    final Paint eraser = Paint()
      ..blendMode = BlendMode.clear
      ..style = PaintingStyle.fill;
    for (final Offset p in points) {
      canvas.drawCircle(p, 18, eraser);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _FoilPainter oldDelegate) =>
      !identical(oldDelegate.points, points) ||
      oldDelegate.points.length != points.length;
}

class _SpinWheel extends StatelessWidget {
  const _SpinWheel({
    required this.animation,
    required this.from,
    required this.to,
    required this.revealed,
    required this.result,
    required this.prizes,
  });

  final Animation<double> animation;
  final double from;
  final double to;
  final bool revealed;
  final BonusPlayResult? result;

  /// The real prize set — one labelled segment per entry.
  final List<int> prizes;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: <Widget>[
        SizedBox(
          width: 240,
          height: 240,
          child: Stack(
            alignment: Alignment.center,
            children: <Widget>[
              AnimatedBuilder(
                animation: animation,
                builder: (_, Widget? child) {
                  final double angle = from + (to - from) * Curves.easeOutCubic.transform(animation.value);
                  return Transform.rotate(angle: angle, child: child);
                },
                child: CustomPaint(
                  size: const Size(220, 220),
                  painter: _WheelPainter(prizes: prizes),
                ),
              ),
              // Center hub.
              Container(
                width: 54,
                height: 54,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RajaColors.goldGradient,
                ),
                child: const Icon(Icons.casino_rounded,
                    color: Color(0xFF1A1300), size: 26),
              ),
              // Pointer.
              const Positioned(
                top: 0,
                child: Icon(Icons.arrow_drop_down_rounded,
                    color: RajaColors.gold, size: 44),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        if (revealed && result != null) _PrizeReveal(result: result!),
      ],
    );
  }
}

/// Draws the prize wheel: one segment per real prize amount, each labelled with
/// its coin value (a legible white number) plus a small gold "C" coin disc that
/// matches [CoinGlyph] — so every segment reads like "50 C".
class _WheelPainter extends CustomPainter {
  _WheelPainter({required this.prizes});

  final List<int> prizes;

  // Alternating segment fills chosen for strong contrast against white labels.
  static const List<Color> _fills = <Color>[
    RajaColors.indigo,
    RajaColors.surfaceHigh,
    RajaColors.indigoSoft,
    RajaColors.surface,
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final Offset center = Offset(size.width / 2, size.height / 2);
    final double radius = size.width / 2;
    final Rect rect = Rect.fromCircle(center: center, radius: radius);
    // Fall back to 6 blank segments only when the prize set is unknown.
    final int count = prizes.isEmpty ? 6 : prizes.length;
    final double sweep = 2 * pi / count;

    for (int i = 0; i < count; i++) {
      canvas.drawArc(
        rect,
        i * sweep,
        sweep,
        true,
        Paint()
          ..style = PaintingStyle.fill
          ..color = _fills[i % _fills.length],
      );
      // Thin divider between segments for definition.
      canvas.drawArc(
        rect,
        i * sweep,
        sweep,
        true,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1
          ..color = RajaColors.border,
      );
    }
    // Rim.
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 4
        ..color = RajaColors.gold,
    );

    if (prizes.isEmpty) return;

    // Per-segment label: the prize number + a small gold coin glyph.
    for (int i = 0; i < count; i++) {
      final double a = i * sweep + sweep / 2;
      final Offset labelCenter = Offset(
        center.dx + cos(a) * radius * 0.60,
        center.dy + sin(a) * radius * 0.60,
      );
      final TextPainter number = TextPainter(
        textDirection: TextDirection.ltr,
        text: TextSpan(
          text: '${prizes[i]}',
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w900,
            fontSize: 18,
            shadows: <Shadow>[
              Shadow(color: Color(0xCC000000), blurRadius: 3),
            ],
          ),
        ),
      )..layout();

      const double coinR = 8;
      const double gap = 3;
      // Stack the number above the coin, the pair centred on labelCenter.
      final double blockH = number.height + gap + coinR * 2;
      final double top = labelCenter.dy - blockH / 2;
      number.paint(
        canvas,
        Offset(labelCenter.dx - number.width / 2, top),
      );
      final Offset coin =
          Offset(labelCenter.dx, top + number.height + gap + coinR);
      canvas.drawCircle(
        coin,
        coinR,
        Paint()
          ..shader = RajaColors.goldGradient
              .createShader(Rect.fromCircle(center: coin, radius: coinR)),
      );
      canvas.drawCircle(
        coin,
        coinR,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.2
          ..color = RajaColors.goldLight,
      );
      final TextPainter c = TextPainter(
        textDirection: TextDirection.ltr,
        text: const TextSpan(
          text: 'C',
          style: TextStyle(
            color: Color(0xFF5A3E00),
            fontWeight: FontWeight.w900,
            fontSize: 11,
          ),
        ),
      )..layout();
      c.paint(canvas, coin - Offset(c.width / 2, c.height / 2));
    }
  }

  @override
  bool shouldRepaint(covariant _WheelPainter oldDelegate) =>
      !listEquals(oldDelegate.prizes, prizes);
}
