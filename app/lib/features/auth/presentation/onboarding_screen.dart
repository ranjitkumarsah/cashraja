import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/config/app_config.dart';
import '../../../core/theme/raja_colors.dart';
import '../../../core/widgets/coin_glyph.dart';
import '../../../core/widgets/gradient_background.dart';
import '../../../core/widgets/primary_button.dart';
import 'auth_controller.dart';

/// First screen for signed-out users: brand, value props, and sign-in.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  bool _busy = false;

  Future<void> _google() async {
    setState(() => _busy = true);
    try {
      await ref.read(authControllerProvider.notifier).startGoogleSignIn();
      // Navigation is handled by the router redirect on state change.
    } on ApiException catch (e) {
      _showError(e.message);
    } catch (_) {
      _showError('Google sign-in isn\'t available on this device yet.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _dev() async {
    setState(() => _busy = true);
    try {
      await ref.read(authControllerProvider.notifier).startDevSignIn();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: GradientBackground(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              children: <Widget>[
                const Spacer(flex: 2),
                const CoinGlyph(size: 84),
                const SizedBox(height: 28),
                Text(
                  'Cash Raja',
                  style: Theme.of(context).textTheme.displaySmall?.copyWith(
                        fontSize: 40,
                        letterSpacing: 0.5,
                      ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Play. Earn. Redeem real gift cards.',
                  style: TextStyle(color: RajaColors.textSecondary, fontSize: 16),
                ),
                const SizedBox(height: 40),
                const _ValueProp(
                  icon: Icons.task_alt_rounded,
                  text: 'Complete offers & watch ads to earn coins',
                ),
                const _ValueProp(
                  icon: Icons.local_fire_department_rounded,
                  text: 'Keep your daily streak alive for bonuses',
                ),
                const _ValueProp(
                  icon: Icons.card_giftcard_rounded,
                  text: 'Redeem for Amazon, Flipkart & Google Play',
                ),
                const Spacer(flex: 3),
                PrimaryButton(
                  label: 'Continue with Google',
                  icon: Icons.g_mobiledata_rounded,
                  loading: _busy,
                  onPressed: _busy ? null : _google,
                ),
                if (AppConfig.devLoginEnabled) ...<Widget>[
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: _busy ? null : _dev,
                    child: const Text(
                      'Dev sign-in (mock)',
                      style: TextStyle(color: RajaColors.textMuted),
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                const Text(
                  'By continuing you agree you are 18+ and accept our Terms.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: RajaColors.textMuted, fontSize: 12),
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ValueProp extends StatelessWidget {
  const _ValueProp({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: <Widget>[
          Icon(icon, color: RajaColors.gold, size: 22),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(color: RajaColors.textPrimary, fontSize: 15),
            ),
          ),
        ],
      ),
    );
  }
}
