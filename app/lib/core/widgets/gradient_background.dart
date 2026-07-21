import 'package:flutter/material.dart';

import '../theme/raja_colors.dart';

/// Full-screen royal-indigo gradient with a subtle radial gold glow at the top.
class GradientBackground extends StatelessWidget {
  const GradientBackground({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(gradient: RajaColors.royalGradient),
      child: Stack(
        children: <Widget>[
          Positioned(
            top: -140,
            left: -60,
            right: -60,
            child: IgnorePointer(
              child: Container(
                height: 320,
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    colors: <Color>[
                      RajaColors.gold.withValues(alpha: 0.16),
                      RajaColors.gold.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
          ),
          child,
        ],
      ),
    );
  }
}
