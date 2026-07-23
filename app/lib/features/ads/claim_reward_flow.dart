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

  /// User chose Claim but did not finish the ad (dismissed / no-fill / error) →
  /// caller must NOT credit; nudge them to watch the full ad.
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
  final bool? claim = await showDialog<bool>(
    context: context,
    barrierDismissible: false,
    builder: (_) => _ClaimDialog(
      coins: coins,
      title: title,
      subtitle: subtitle,
      claimLabel: claimLabel,
      icon: icon,
    ),
  );
  if (claim != true) return ClaimOutcome.closed;

  final RewardedAdService ads = ref.read(rewardedAdServiceProvider);
  final AdResult result = await ads.show();
  return result == AdResult.watched
      ? ClaimOutcome.claimed
      : ClaimOutcome.adIncomplete;
}

class _ClaimDialog extends StatelessWidget {
  const _ClaimDialog({
    required this.coins,
    required this.title,
    required this.subtitle,
    required this.claimLabel,
    required this.icon,
  });

  final int? coins;
  final String title;
  final String subtitle;
  final String claimLabel;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Dialog(
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
              child: Icon(icon, size: 38, color: const Color(0xFF1A1300)),
            ),
            const SizedBox(height: 18),
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            if (coins != null) ...<Widget>[
              CoinBalance(amount: coins!, fontSize: 40, glyphSize: 32),
              const SizedBox(height: 12),
            ],
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: const TextStyle(color: RajaColors.textSecondary, height: 1.4),
            ),
            const SizedBox(height: 24),
            PrimaryButton(
              label: claimLabel,
              icon: Icons.smart_display_rounded,
              onPressed: () => Navigator.of(context).pop(true),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Close',
                  style: TextStyle(color: RajaColors.textMuted)),
            ),
          ],
        ),
      ),
    );
  }
}
