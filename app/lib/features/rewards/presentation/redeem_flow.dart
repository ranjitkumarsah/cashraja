import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models/gift_card.dart';
import '../../../core/api/models/redemption.dart';
import '../../../core/theme/raja_colors.dart';
import '../../../core/widgets/coin_glyph.dart';
import '../../../core/widgets/primary_button.dart';
import '../../wallet/presentation/wallet_controllers.dart';
import 'rewards_controllers.dart';

/// Shared reserve-debit redeem flow: shows the confirm sheet, and on confirm
/// requests the redemption (reserving coins immediately). Used by the brand
/// detail store page. On success shows a snackbar and invokes [onRedeemed].
Future<void> confirmAndRedeem(
  BuildContext context,
  WidgetRef ref,
  GiftCard card, {
  VoidCallback? onRedeemed,
}) async {
  final int balance =
      ref.read(walletControllerProvider).valueOrNull?.coinBalance ?? 0;
  final bool affordable = balance >= card.coinCost;

  final bool? go = await showModalBottomSheet<bool>(
    context: context,
    backgroundColor: RajaColors.surface,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (_) => RedeemConfirmSheet(card: card, affordable: affordable),
  );
  if (go != true) return;
  if (!context.mounted) return;

  try {
    final Redemption r =
        await ref.read(redemptionsControllerProvider.notifier).redeem(card.id);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Redemption ${r.status.label.toLowerCase()} — track it under '
          'Rewards › My redemptions.',
        ),
      ),
    );
    onRedeemed?.call();
  } on ApiException catch (e) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(e.message)));
  }
}

/// Bottom sheet confirming a reserve-debit redemption.
class RedeemConfirmSheet extends StatelessWidget {
  const RedeemConfirmSheet({
    super.key,
    required this.card,
    required this.affordable,
  });

  final GiftCard card;
  final bool affordable;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: RajaColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Redeem ${card.brand.label} ₹${card.denomination}?',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            Row(
              children: <Widget>[
                const CoinGlyph(size: 20),
                const SizedBox(width: 8),
                Text(
                  '${card.coinCost} coins will be reserved now.',
                  style: const TextStyle(color: RajaColors.textSecondary),
                ),
              ],
            ),
            const SizedBox(height: 6),
            const Text(
              'Coins are deducted immediately and refunded automatically if the '
              'request is rejected.',
              style: TextStyle(color: RajaColors.textMuted, fontSize: 13),
            ),
            if (!affordable) ...<Widget>[
              const SizedBox(height: 14),
              Row(
                children: <Widget>[
                  const Icon(Icons.error_outline_rounded,
                      color: RajaColors.rose, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Not enough coins for this reward yet.',
                      style: TextStyle(
                        color: RajaColors.rose.withValues(alpha: 0.9),
                      ),
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 24),
            PrimaryButton(
              label: affordable ? 'Confirm redemption' : 'Not enough coins',
              onPressed:
                  affordable ? () => Navigator.of(context).pop(true) : null,
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Cancel',
                  style: TextStyle(color: RajaColors.textMuted)),
            ),
          ],
        ),
      ),
    );
  }
}
