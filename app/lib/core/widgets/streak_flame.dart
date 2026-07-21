import 'package:flutter/material.dart';

import '../theme/raja_colors.dart';

/// A gently pulsing flame with the current streak count. Subtle motion only.
class StreakFlame extends StatefulWidget {
  const StreakFlame({super.key, required this.days});

  final int days;

  @override
  State<StreakFlame> createState() => _StreakFlameState();
}

class _StreakFlameState extends State<StreakFlame>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bool active = widget.days > 0;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        ScaleTransition(
          scale: Tween<double>(begin: 0.9, end: 1.08).animate(
            CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
          ),
          child: Icon(
            Icons.local_fire_department_rounded,
            color: active ? RajaColors.amber : RajaColors.textMuted,
            size: 22,
          ),
        ),
        const SizedBox(width: 4),
        Text(
          '${widget.days}',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            color: active ? RajaColors.textPrimary : RajaColors.textMuted,
          ),
        ),
      ],
    );
  }
}
