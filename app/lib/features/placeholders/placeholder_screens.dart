import 'package:flutter/material.dart';

import '../../core/theme/raja_colors.dart';
import '../../core/widgets/gradient_background.dart';

/// A clean, navigable "coming soon" scaffold for Phase D features whose backend
/// has just landed and which get wired next. Not a broken/dead screen.
class ComingSoonScreen extends StatelessWidget {
  const ComingSoonScreen({
    super.key,
    required this.title,
    required this.icon,
    required this.blurb,
  });

  final String title;
  final IconData icon;
  final String blurb;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      extendBodyBehindAppBar: true,
      body: GradientBackground(
        child: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: RajaColors.surfaceHigh,
                      border: Border.all(color: RajaColors.border),
                    ),
                    child: Icon(icon, size: 44, color: RajaColors.gold),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    title,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: RajaColors.gold.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: RajaColors.gold.withValues(alpha: 0.4),
                      ),
                    ),
                    child: const Text(
                      'COMING SOON',
                      style: TextStyle(
                        color: RajaColors.gold,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1,
                        fontSize: 12,
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    blurb,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: RajaColors.textSecondary,
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class GamePlaceholderScreen extends StatelessWidget {
  const GamePlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const ComingSoonScreen(
      title: 'Play & Win',
      icon: Icons.sports_esports_rounded,
      blurb:
          'Skill mini-games with server-issued rounds and daily caps are on the '
          'way. Earn coins for every round you clear.',
    );
  }
}

class SpinPlaceholderScreen extends StatelessWidget {
  const SpinPlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const ComingSoonScreen(
      title: 'Scratch & Spin',
      icon: Icons.casino_rounded,
      blurb:
          'Daily scratch cards and the spin wheel — with fair, server-side odds '
          '— are coming soon. Come back for your free daily try.',
    );
  }
}

class InvitePlaceholderScreen extends StatelessWidget {
  const InvitePlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const ComingSoonScreen(
      title: 'Invite & Earn',
      icon: Icons.group_add_rounded,
      blurb:
          'Share your code and earn a bonus on what your friends make. Full '
          'referral tracking lands next.',
    );
  }
}
