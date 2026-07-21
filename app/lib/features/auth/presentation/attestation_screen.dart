import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/raja_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/gradient_background.dart';
import '../../../core/widgets/primary_button.dart';
import 'auth_controller.dart';

/// Post-sign-in gate: 18+ date-of-birth attestation + optional referral code,
/// then the token exchange. Required before a session is created.
class AttestationScreen extends ConsumerStatefulWidget {
  const AttestationScreen({super.key});

  @override
  ConsumerState<AttestationScreen> createState() => _AttestationScreenState();
}

class _AttestationScreenState extends ConsumerState<AttestationScreen> {
  DateTime? _dob;
  final TextEditingController _referral = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _referral.dispose();
    super.dispose();
  }

  Future<void> _pickDob() async {
    final DateTime now = DateTime.now();
    final DateTime initial = DateTime(now.year - 20, now.month, now.day);
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(now.year - 100),
      lastDate: now,
      helpText: 'Select your date of birth',
    );
    if (picked != null) setState(() => _dob = picked);
  }

  bool get _isAdult => _dob != null && AuthController.isAdult(_dob!);

  Future<void> _continue() async {
    if (_dob == null) return;
    setState(() => _busy = true);
    try {
      await ref.read(authControllerProvider.notifier).completeAttestation(
            dateOfBirth: _dob!,
            referralCode: _referral.text.trim().isEmpty
                ? null
                : _referral.text.trim(),
          );
      // Router redirect takes us home on success.
    } on ApiException catch (e) {
      _showError(e.message);
    } catch (_) {
      _showError('Something went wrong. Please try again.');
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
    final bool underage = _dob != null && !_isAdult;
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.close_rounded),
          onPressed: _busy
              ? null
              : () => ref.read(authControllerProvider.notifier).cancelPending(),
        ),
      ),
      extendBodyBehindAppBar: true,
      body: GradientBackground(
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                const SizedBox(height: 8),
                Text(
                  'One quick check',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                const Text(
                  'Cash Raja is for adults only. Confirm your date of birth to '
                  'continue.',
                  style: TextStyle(color: RajaColors.textSecondary, height: 1.5),
                ),
                const SizedBox(height: 28),
                AppCard(
                  onTap: _busy ? null : _pickDob,
                  child: Row(
                    children: <Widget>[
                      const Icon(Icons.cake_rounded, color: RajaColors.gold),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            const Text(
                              'Date of birth',
                              style: TextStyle(
                                color: RajaColors.textMuted,
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              _dob == null
                                  ? 'Tap to select'
                                  : Formatters.date(_dob!),
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right_rounded,
                          color: RajaColors.textMuted),
                    ],
                  ),
                ),
                if (underage) ...<Widget>[
                  const SizedBox(height: 12),
                  Row(
                    children: <Widget>[
                      const Icon(Icons.error_outline_rounded,
                          color: RajaColors.rose, size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'You must be 18 or older to use Cash Raja.',
                          style: TextStyle(
                            color: RajaColors.rose.withValues(alpha: 0.9),
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 28),
                const Text(
                  'Referral code (optional)',
                  style: TextStyle(
                    color: RajaColors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _referral,
                  enabled: !_busy,
                  textCapitalization: TextCapitalization.characters,
                  decoration: const InputDecoration(
                    hintText: 'Enter a friend\'s code',
                    prefixIcon: Icon(Icons.redeem_rounded),
                  ),
                ),
                const SizedBox(height: 36),
                PrimaryButton(
                  label: 'Continue',
                  loading: _busy,
                  onPressed: (_isAdult && !_busy) ? _continue : null,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
