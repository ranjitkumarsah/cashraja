import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/raja_colors.dart';
import '../../core/widgets/coin_balance.dart';
import '../../core/widgets/primary_button.dart';
import 'rewarded_ad_service.dart';

/// Outcome of the ad-gated claim flow (G2/G4/G6).
enum ClaimOutcome {
  /// User chose Claim AND watched the rewarded ad to completion → caller should
  /// now call the server credit endpoint.
  claimed,

  /// User chose Claim but the ad wasn't watched to completion — dismissed early,
  /// no-fill, or a load/show error. Either way NO reward is granted: coins come
  /// only from a fully-watched ad.
  adIncomplete,

  /// User closed/forfeited the popup → no reward.
  closed,
}

/// Shows a "you won N coins" popup with **Claim** and **Close**, and — when
/// Claim is pressed — plays a rewarded ad. Resolves to a [ClaimOutcome] the
/// caller acts on: only [ClaimOutcome.claimed] should trigger the server
/// credit. The coin amount is shown BEFORE crediting (from a server-provided
/// preview), never invented client-side.
Future<ClaimOutcome> showAdGatedClaim(
  BuildContext context,
  WidgetRef ref, {
  int? coins,
  String title = 'You won!',
  String subtitle = 'Watch a short ad to claim your coins.',
  String claimLabel = 'Watch ad & claim',
  IconData icon = Icons.celebration_rounded,
}) async {
  // The dialog itself drives the rewarded ad and stays on-screen (with a
  // loader + modal barrier) for the whole load/show, so the surface underneath
  // can never be tapped and Claim can't be double-fired. It resolves directly
  // to the [ClaimOutcome] the caller acts on.
  final ClaimOutcome? outcome = await showDialog<ClaimOutcome>(
    context: context,
    barrierDismissible: false,
    builder: (_) => _ClaimDialog(
      ads: ref.read(rewardedAdServiceProvider),
      coins: coins,
      title: title,
      subtitle: subtitle,
      claimLabel: claimLabel,
      icon: icon,
    ),
  );
  return outcome ?? ClaimOutcome.closed;
}

class _ClaimDialog extends StatefulWidget {
  const _ClaimDialog({
    required this.ads,
    required this.coins,
    required this.title,
    required this.subtitle,
    required this.claimLabel,
    required this.icon,
  });

  final RewardedAdService ads;
  final int? coins;
  final String title;
  final String subtitle;
  final String claimLabel;
  final IconData icon;

  @override
  State<_ClaimDialog> createState() => _ClaimDialogState();
}

class _ClaimDialogState extends State<_ClaimDialog> {
  bool _loading = false;

  Future<void> _onClaim() async {
    if (_loading) return;
    // Show the spinner + freeze every control while the ad loads/plays.
    setState(() => _loading = true);
    final AdResult result = await widget.ads.show();
    if (!mounted) return;
    // Only a fully-watched ad grants the reward; a dismissal, no-fill or error
    // all mean "no ad watched" → no credit.
    Navigator.of(context).pop(
      result == AdResult.watched ? ClaimOutcome.claimed : ClaimOutcome.adIncomplete,
    );
  }

  @override
  Widget build(BuildContext context) {
    // Block the Android back gesture while the ad is in flight so the barrier
    // can't be dismissed underneath a loading claim.
    return PopScope(
      canPop: !_loading,
      child: Dialog(
        backgroundColor: RajaColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Container(
                width: 72,
                height: 72,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RajaColors.goldGradient,
                ),
                child:
                    Icon(widget.icon, size: 38, color: const Color(0xFF1A1300)),
              ),
              const SizedBox(height: 18),
              Text(widget.title, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              if (widget.coins != null) ...<Widget>[
                CoinBalance(amount: widget.coins!, fontSize: 40, glyphSize: 32),
                const SizedBox(height: 12),
              ],
              Text(
                _loading ? 'Loading your ad…' : widget.subtitle,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    color: RajaColors.textSecondary, height: 1.4),
              ),
              const SizedBox(height: 24),
              PrimaryButton(
                label: widget.claimLabel,
                icon: Icons.smart_display_rounded,
                loading: _loading,
                onPressed: _loading ? null : _onClaim,
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed:
                    _loading ? null : () => Navigator.of(context).pop(ClaimOutcome.closed),
                child: const Text('Close',
                    style: TextStyle(color: RajaColors.textMuted)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
