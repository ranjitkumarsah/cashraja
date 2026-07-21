import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/api/models/enums.dart';
import '../../../core/api/models/redemption.dart';
import '../../../core/theme/raja_colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/status_chip.dart';

/// A redemption history card with a status timeline and, once issued, the
/// revealable gift-card code.
class RedemptionCard extends StatelessWidget {
  const RedemptionCard({super.key, required this.redemption});

  final Redemption redemption;

  @override
  Widget build(BuildContext context) {
    final Redemption r = redemption;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  '${r.giftCard.brand.label} ${Formatters.rupees(r.giftCard.denomination)}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
              ),
              StatusChip(label: r.status.label, tone: r.status.tone),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${r.coinAmount} coins • ${Formatters.date(r.createdAt)}',
            style: const TextStyle(color: RajaColors.textMuted, fontSize: 13),
          ),
          const SizedBox(height: 14),
          _Timeline(status: r.status, rejected: r.status == RedemptionStatus.rejected),
          if (r.status == RedemptionStatus.rejected &&
              r.rejectionReason != null) ...<Widget>[
            const SizedBox(height: 12),
            Text(
              'Reason: ${r.rejectionReason}',
              style: TextStyle(
                color: RajaColors.rose.withValues(alpha: 0.9),
                fontSize: 13,
              ),
            ),
          ],
          if (r.status == RedemptionStatus.issued && r.giftCardCode != null)
            _CodeReveal(code: r.giftCardCode!),
        ],
      ),
    );
  }
}

class _Timeline extends StatelessWidget {
  const _Timeline({required this.status, required this.rejected});

  final RedemptionStatus status;
  final bool rejected;

  static const List<RedemptionStatus> _steps = <RedemptionStatus>[
    RedemptionStatus.requested,
    RedemptionStatus.approved,
    RedemptionStatus.issued,
  ];

  int get _reachedIndex {
    switch (status) {
      case RedemptionStatus.requested:
      case RedemptionStatus.underReview:
        return 0;
      case RedemptionStatus.approved:
        return 1;
      case RedemptionStatus.issued:
        return 2;
      case RedemptionStatus.rejected:
      case RedemptionStatus.unknown:
        return 0;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (rejected) {
      return const Row(
        children: <Widget>[
          Icon(Icons.cancel_rounded, color: RajaColors.rose, size: 18),
          SizedBox(width: 8),
          Text('Rejected — coins refunded',
              style: TextStyle(color: RajaColors.textSecondary)),
        ],
      );
    }
    const List<String> labels = <String>['Requested', 'Approved', 'Issued'];
    return Row(
      children: List<Widget>.generate(_steps.length * 2 - 1, (int i) {
        if (i.isOdd) {
          final bool done = (i ~/ 2) < _reachedIndex;
          return Expanded(
            child: Container(
              height: 2,
              color: done ? RajaColors.emerald : RajaColors.border,
            ),
          );
        }
        final int stepIndex = i ~/ 2;
        final bool reached = stepIndex <= _reachedIndex;
        return Column(
          children: <Widget>[
            Icon(
              reached ? Icons.check_circle_rounded : Icons.circle_outlined,
              size: 18,
              color: reached ? RajaColors.emerald : RajaColors.textMuted,
            ),
            const SizedBox(height: 4),
            Text(
              labels[stepIndex],
              style: TextStyle(
                fontSize: 11,
                color: reached ? RajaColors.textSecondary : RajaColors.textMuted,
              ),
            ),
          ],
        );
      }),
    );
  }
}

class _CodeReveal extends StatefulWidget {
  const _CodeReveal({required this.code});

  final String code;

  @override
  State<_CodeReveal> createState() => _CodeRevealState();
}

class _CodeRevealState extends State<_CodeReveal> {
  bool _revealed = false;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: RajaColors.emerald.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: RajaColors.emerald.withValues(alpha: 0.4),
          ),
        ),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Text(
                _revealed ? widget.code : '•••• •••• ••••',
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.5,
                  color: RajaColors.textPrimary,
                ),
              ),
            ),
            if (_revealed)
              IconButton(
                icon: const Icon(Icons.copy_rounded, size: 18),
                color: RajaColors.emerald,
                onPressed: () async {
                  await Clipboard.setData(ClipboardData(text: widget.code));
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Code copied')),
                    );
                  }
                },
              )
            else
              TextButton(
                onPressed: () => setState(() => _revealed = true),
                child: const Text('Reveal'),
              ),
          ],
        ),
      ),
    );
  }
}
