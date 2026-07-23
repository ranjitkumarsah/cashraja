import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models/streak.dart';
import '../../../core/theme/raja_colors.dart';
import '../../../core/theme/raja_theme.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../../core/widgets/coin_glyph.dart';
import '../../../core/widgets/primary_button.dart';
import '../../ads/rewarded_ad_service.dart';
import 'streak_controller.dart';

/// Opens the daily-streak claim sheet.
Future<void> showStreakSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: RajaColors.surface,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (_) => const StreakSheet(),
  );
}

/// The daily login-streak surface: shows the current streak and lets the user
/// claim today's bonus when `claimable_today` is true.
class StreakSheet extends ConsumerStatefulWidget {
  const StreakSheet({super.key});

  @override
  ConsumerState<StreakSheet> createState() => _StreakSheetState();
}

class _StreakSheetState extends ConsumerState<StreakSheet> {
  bool _claiming = false;

  Future<void> _claim() async {
    setState(() => _claiming = true);
    final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);
    final NavigatorState navigator = Navigator.of(context);

    // G2 (3a): the daily bonus is gated behind a rewarded ad. Only a completed
    // watch calls the authoritative /streak/claim credit endpoint.
    final AdResult ad = await ref.read(rewardedAdServiceProvider).show();
    if (!mounted) return;
    if (ad != AdResult.watched) {
      setState(() => _claiming = false);
      messenger.showSnackBar(
        const SnackBar(content: Text('Watch the ad to claim your streak bonus.')),
      );
      return;
    }

    try {
      final StreakClaimResult result =
          await ref.read(streakControllerProvider.notifier).claim();
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(content: Text('Day ${result.streakCount} claimed · '
            '+${result.coinsEarned} coins!')),
      );
      await navigator.maybePop();
      if (mounted) setState(() => _claiming = false);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _claiming = false);
      // Reflect authoritative state (e.g. already-claimed race).
      await ref.read(streakControllerProvider.notifier).refresh();
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<StreakState> streak = ref.watch(streakControllerProvider);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: AsyncValueView<StreakState>(
          value: streak,
          onRetry: () => ref.read(streakControllerProvider.notifier).refresh(),
          data: (StreakState s) => Column(
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
              Row(
                children: <Widget>[
                  const Icon(Icons.local_fire_department_rounded,
                      color: RajaColors.amber, size: 30),
                  const SizedBox(width: 10),
                  Text(
                    'Daily streak',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const Spacer(),
                  Text(
                    '${s.currentCount}',
                    style: const TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w900,
                      color: RajaColors.textPrimary,
                      fontFeatures: RajaTheme.tabularFigures,
                    ),
                  ),
                  const SizedBox(width: 4),
                  const Text('days',
                      style: TextStyle(color: RajaColors.textMuted)),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: <Widget>[
                  const CoinGlyph(size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      s.claimableToday
                          ? 'Claim today\'s bonus of ${s.nextBonus} coins to keep '
                              'your streak alive.'
                          : 'You\'re all caught up today. Come back tomorrow for '
                              '${s.nextBonus} coins.',
                      style: const TextStyle(color: RajaColors.textSecondary),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              PrimaryButton(
                label: s.claimableToday
                    ? 'Claim ${s.nextBonus} coins'
                    : 'Claimed for today',
                icon: s.claimableToday ? Icons.bolt_rounded : Icons.check_rounded,
                loading: _claiming,
                onPressed: s.claimableToday ? _claim : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
