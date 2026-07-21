import 'package:flutter/material.dart';

import '../theme/raja_colors.dart';

/// A reusable gold coin glyph with a subtle gold rim, used everywhere a coin
/// value is shown. Scales with [size].
class CoinGlyph extends StatelessWidget {
  const CoinGlyph({super.key, this.size = 20});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RajaColors.goldGradient,
        border: Border.all(color: RajaColors.goldLight, width: size * 0.06),
        boxShadow: <BoxShadow>[
          BoxShadow(
            color: RajaColors.gold.withValues(alpha: 0.35),
            blurRadius: size * 0.3,
          ),
        ],
      ),
      alignment: Alignment.center,
      child: Text(
        '₹',
        style: TextStyle(
          fontSize: size * 0.56,
          height: 1,
          fontWeight: FontWeight.w800,
          color: const Color(0xFF5A3E00),
        ),
      ),
    );
  }
}
