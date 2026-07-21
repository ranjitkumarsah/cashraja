import 'package:flutter/material.dart';

import '../../core/theme/raja_colors.dart';
import '../../core/widgets/coin_glyph.dart';
import '../../core/widgets/gradient_background.dart';

/// Shown while the auth session is being restored on startup.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: GradientBackground(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              const CoinGlyph(size: 72),
              const SizedBox(height: 24),
              Text(
                'Cash Raja',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      letterSpacing: 0.5,
                    ),
              ),
              const SizedBox(height: 32),
              const SizedBox(
                width: 26,
                height: 26,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  color: RajaColors.gold,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
