import 'package:flutter/material.dart';

import '../theme/raja_colors.dart';
import '../theme/raja_theme.dart';
import '../utils/formatters.dart';
import 'coin_glyph.dart';

/// Displays a coin amount with the coin glyph and tabular figures, with a
/// smooth count-up animation whenever the value changes.
class CoinBalance extends StatelessWidget {
  const CoinBalance({
    super.key,
    required this.amount,
    this.fontSize = 34,
    this.glyphSize = 30,
    this.color = RajaColors.textPrimary,
    this.animate = true,
  });

  final int amount;
  final double fontSize;
  final double glyphSize;
  final Color color;
  final bool animate;

  @override
  Widget build(BuildContext context) {
    final TextStyle style = TextStyle(
      fontFamily: RajaTheme.fontFamily,
      fontSize: fontSize,
      fontWeight: FontWeight.w800,
      color: color,
      fontFeatures: RajaTheme.tabularFigures,
      letterSpacing: -0.5,
    );

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        CoinGlyph(size: glyphSize),
        const SizedBox(width: 8),
        if (animate)
          TweenAnimationBuilder<double>(
            tween: Tween<double>(begin: 0, end: amount.toDouble()),
            duration: const Duration(milliseconds: 700),
            curve: Curves.easeOutCubic,
            builder: (BuildContext context, double value, _) {
              return Text(Formatters.coins(value.round()), style: style);
            },
          )
        else
          Text(Formatters.coins(amount), style: style),
      ],
    );
  }
}
