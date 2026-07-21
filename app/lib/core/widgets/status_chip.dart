import 'package:flutter/material.dart';

import '../theme/raja_colors.dart';

enum StatusTone { neutral, info, pending, success, danger }

/// A small pill communicating a status (redemption state, offer state, etc.).
class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.label, this.tone = StatusTone.neutral});

  final String label;
  final StatusTone tone;

  Color get _color {
    switch (tone) {
      case StatusTone.success:
        return RajaColors.emerald;
      case StatusTone.danger:
        return RajaColors.rose;
      case StatusTone.pending:
        return RajaColors.amber;
      case StatusTone.info:
        return RajaColors.sky;
      case StatusTone.neutral:
        return RajaColors.textMuted;
    }
  }

  @override
  Widget build(BuildContext context) {
    final Color c = _color;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: c.withValues(alpha: 0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: c,
          fontSize: 12,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.2,
        ),
      ),
    );
  }
}
