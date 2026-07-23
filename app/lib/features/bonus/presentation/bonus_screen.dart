import 'dart:async';
import 'dart:math';

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
            child: TabBarView(
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

  Future<void> _play() async {
    setState(() => _playing = true);
    try {
      final BonusPlayResult result =
          await ref.read(bonusControllerProvider(widget.kind).notifier).play();
      if (!mounted) return;
      if (widget.kind == BonusKind.spin) {
        _spinFrom = _spinTo % (2 * pi);
        _spinTo = _spinFrom + (2 * pi * (4 + _rng.nextInt(2))) + _rng.nextDouble() * 2 * pi;
        unawaited(_spin.forward(from: 0));
      }
      setState(() {
        _result = result;
        _revealed = true;
        _playing = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _playing = false);
      // Attempt-limit or other errors — refresh state so the UI reflects it.
      await ref.read(bonusControllerProvider(widget.kind).notifier).refresh();
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  void _reset() {
    setState(() {
      _result = null;
      _revealed = false;
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
                  ? _ScratchCard(revealed: _revealed, result: _result)
                  : _SpinWheel(
                      animation: _spin,
                      from: _spinFrom,
                      to: _spinTo,
                      revealed: _revealed,
                      result: _result,
                    ),
            ),
            const SizedBox(height: 32),
            _actionButton(s),
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
    final bool canPlay = s.canPlay && !_playing;
    return PrimaryButton(
      label: widget.kind == BonusKind.scratch ? 'Scratch to reveal' : 'Spin now',
      loading: _playing,
      onPressed: canPlay ? _play : null,
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

class _ScratchCard extends StatelessWidget {
  const _ScratchCard({required this.revealed, required this.result});

  final bool revealed;
  final BonusPlayResult? result;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 240,
      height: 160,
      child: Stack(
        alignment: Alignment.center,
        children: <Widget>[
          DecoratedBox(
            decoration: BoxDecoration(
              color: RajaColors.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: RajaColors.border),
            ),
            child: Center(
              child: revealed && result != null
                  ? _PrizeReveal(result: result!)
                  : const SizedBox.shrink(),
            ),
          ),
          AnimatedOpacity(
            opacity: revealed ? 0 : 1,
            duration: const Duration(milliseconds: 600),
            child: Container(
              decoration: BoxDecoration(
                gradient: RajaColors.goldGradient,
                borderRadius: BorderRadius.circular(20),
              ),
              alignment: Alignment.center,
              child: const Column(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Icon(Icons.auto_awesome_rounded,
                      color: Color(0xFF1A1300), size: 30),
                  SizedBox(height: 8),
                  Text(
                    'Daily prize',
                    style: TextStyle(
                      color: Color(0xFF1A1300),
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SpinWheel extends StatelessWidget {
  const _SpinWheel({
    required this.animation,
    required this.from,
    required this.to,
    required this.revealed,
    required this.result,
  });

  final Animation<double> animation;
  final double from;
  final double to;
  final bool revealed;
  final BonusPlayResult? result;

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
                  painter: _WheelPainter(),
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

class _WheelPainter extends CustomPainter {
  static const List<Color> _segments = <Color>[
    RajaColors.indigo,
    RajaColors.surfaceHigh,
    RajaColors.indigoSoft,
    RajaColors.surface,
    RajaColors.indigo,
    RajaColors.surfaceHigh,
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final Offset center = Offset(size.width / 2, size.height / 2);
    final double radius = size.width / 2;
    final Rect rect = Rect.fromCircle(center: center, radius: radius);
    final double sweep = 2 * pi / _segments.length;

    for (int i = 0; i < _segments.length; i++) {
      final Paint paint = Paint()
        ..style = PaintingStyle.fill
        ..color = _segments[i];
      canvas.drawArc(rect, i * sweep, sweep, true, paint);
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
    // Coin markers per segment — a small gold coin disc (the app economy is
    // coins, not rupees), matching the CoinGlyph used elsewhere.
    for (int i = 0; i < _segments.length; i++) {
      final double a = i * sweep + sweep / 2;
      final Offset p = Offset(
        center.dx + cos(a) * radius * 0.62,
        center.dy + sin(a) * radius * 0.62,
      );
      const double coinR = 11;
      canvas.drawCircle(p, coinR, Paint()..color = RajaColors.gold);
      canvas.drawCircle(
        p,
        coinR,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5
          ..color = RajaColors.goldDeep,
      );
      final TextPainter tp = TextPainter(
        textDirection: TextDirection.ltr,
        text: const TextSpan(
          text: '\$',
          style: TextStyle(
            color: RajaColors.indigoDeep,
            fontWeight: FontWeight.w900,
            fontSize: 13,
          ),
        ),
      )..layout();
      tp.paint(canvas, p - Offset(tp.width / 2, tp.height / 2));
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
