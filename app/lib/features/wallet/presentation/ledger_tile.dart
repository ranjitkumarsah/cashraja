import 'package:flutter/material.dart';

import '../../../core/api/models/enums.dart';
import '../../../core/api/models/wallet.dart';
import '../../../core/theme/raja_colors.dart';
import '../../../core/theme/raja_theme.dart';
import '../../../core/utils/formatters.dart';

/// A single ledger row: source icon, label + timestamp, and a signed amount.
class LedgerTile extends StatelessWidget {
  const LedgerTile({super.key, required this.entry});

  final LedgerEntry entry;

  IconData get _icon {
    switch (entry.sourceType) {
      case LedgerSourceType.offer:
        return Icons.task_alt_rounded;
      case LedgerSourceType.ad:
        return Icons.smart_display_rounded;
      case LedgerSourceType.game:
        return Icons.sports_esports_rounded;
      case LedgerSourceType.referral:
        return Icons.group_rounded;
      case LedgerSourceType.redemption:
        return Icons.card_giftcard_rounded;
      case LedgerSourceType.streak:
        return Icons.local_fire_department_rounded;
      case LedgerSourceType.bonus:
        return Icons.casino_rounded;
      case LedgerSourceType.adminAdjustment:
        return Icons.tune_rounded;
      case LedgerSourceType.unknown:
        return Icons.receipt_long_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool credit = entry.isCredit;
    final Color amountColor =
        credit ? RajaColors.emerald : RajaColors.textSecondary;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: <Widget>[
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: RajaColors.surfaceHigh,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(_icon, size: 20, color: RajaColors.textSecondary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  entry.sourceType.label,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: RajaColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  Formatters.dateTime(entry.createdAt),
                  style: const TextStyle(
                    color: RajaColors.textMuted,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          Text(
            Formatters.signedCoins(entry.amount),
            style: TextStyle(
              fontWeight: FontWeight.w800,
              color: amountColor,
              fontFeatures: RajaTheme.tabularFigures,
            ),
          ),
        ],
      ),
    );
  }
}
