import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/models/streak.dart';
import '../../../core/api/models/wallet.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/raja_colors.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../../core/widgets/coin_balance.dart';
import '../../../core/widgets/gradient_background.dart';
import '../../../core/widgets/streak_flame.dart';
import '../../ads/rewarded_ad_service.dart';
import '../../streak/presentation/streak_controller.dart';
import '../../streak/presentation/streak_sheet.dart';
import '../../wallet/presentation/ledger_tile.dart';
import '../../wallet/presentation/wallet_controllers.dart';

/// The landing tab: balance, streak, primary earn/redeem CTAs, recent activity.
class HomeTab extends ConsumerWidget {
  const HomeTab({super.key, this.onGoToTasks, this.onGoToWallet});

  final VoidCallback? onGoToTasks;
  final VoidCallback? onGoToWallet;

  Future<void> _watchAd(BuildContext context, WidgetRef ref) async {
    final RewardedAdService ads = ref.read(rewardedAdServiceProvider);
    final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);
    messenger.showSnackBar(
      const SnackBar(content: Text('Loading ad…'), duration: Duration(seconds: 1)),
    );
    final AdResult result = await ads.show();
    if (!context.mounted) return;
    switch (result) {
      case AdResult.watched:
        messenger.showSnackBar(
          const SnackBar(
            content: Text('Ad complete! Coins arrive shortly after review.'),
          ),
        );
        // In production the SSV callback credits coins; refresh to reflect it.
        await ref.read(walletControllerProvider.notifier).refresh();
      case AdResult.dismissed:
        messenger.showSnackBar(
          const SnackBar(content: Text('Watch the full ad to earn coins.')),
        );
      case AdResult.noFill:
      case AdResult.failed:
        messenger.showSnackBar(
          const SnackBar(content: Text('No ad available right now.')),
        );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<WalletSummary> wallet =
        ref.watch(walletControllerProvider);
    final StreakState? streak =
        ref.watch(streakControllerProvider).valueOrNull;

    return Scaffold(
      body: GradientBackground(
        child: SafeArea(
          child: RefreshIndicator(
            color: RajaColors.gold,
            backgroundColor: RajaColors.surface,
            onRefresh: () async {
              await ref.read(walletControllerProvider.notifier).refresh();
              await ref.read(streakControllerProvider.notifier).refresh();
            },
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: <Widget>[
                _TopBar(
                  streakDays: streak?.currentCount ?? 0,
                  claimable: streak?.claimableToday ?? false,
                  onTap: () => showStreakSheet(context),
                ),
                const SizedBox(height: 16),
                _BalanceHero(wallet: wallet),
                const SizedBox(height: 20),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: _ActionTile(
                        icon: Icons.sports_esports_rounded,
                        label: 'Play',
                        onTap: () => context.push(Routes.game),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _ActionTile(
                        icon: Icons.task_alt_rounded,
                        label: 'Tasks',
                        onTap: onGoToTasks,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _ActionTile(
                        icon: Icons.group_add_rounded,
                        label: 'Invite',
                        onTap: () => context.push(Routes.invite),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                AppCard(
                  onTap: () => context.push(Routes.spin),
                  child: const Row(
                    children: <Widget>[
                      Icon(Icons.casino_rounded,
                          color: RajaColors.gold, size: 28),
                      SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text(
                              'Scratch & Spin',
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 16,
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Your free daily scratch card and wheel spin',
                              style: TextStyle(
                                color: RajaColors.textMuted,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Icon(Icons.chevron_right_rounded,
                          color: RajaColors.textMuted),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                AppCard(
                  onTap: () => _watchAd(context, ref),
                  gradient: RajaColors.royalGradient,
                  child: const Row(
                    children: <Widget>[
                      Icon(Icons.smart_display_rounded,
                          color: RajaColors.gold, size: 28),
                      SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text(
                              'Watch & earn',
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 16,
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Watch a short video for bonus coins',
                              style: TextStyle(
                                color: RajaColors.textMuted,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Icon(Icons.chevron_right_rounded,
                          color: RajaColors.textMuted),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                Row(
                  children: <Widget>[
                    const Text(
                      'Recent activity',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: RajaColors.textPrimary,
                      ),
                    ),
                    const Spacer(),
                    TextButton(
                      onPressed: onGoToWallet,
                      child: const Text('See all'),
                    ),
                  ],
                ),
                _RecentActivity(wallet: wallet),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.streakDays,
    required this.claimable,
    required this.onTap,
  });

  final int streakDays;
  final bool claimable;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Text(
          'Cash Raja',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w800,
                color: RajaColors.gold,
              ),
        ),
        const Spacer(),
        Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(999),
            onTap: onTap,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: RajaColors.surfaceHigh,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color: claimable ? RajaColors.gold : RajaColors.border,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  StreakFlame(days: streakDays),
                  if (claimable) ...<Widget>[
                    const SizedBox(width: 6),
                    Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: RajaColors.gold,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _BalanceHero extends StatelessWidget {
  const _BalanceHero({required this.wallet});

  final AsyncValue<WalletSummary> wallet;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(24),
      gradient: const LinearGradient(
        colors: <Color>[RajaColors.indigo, RajaColors.surfaceHigh],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const Text(
            'Your balance',
            style: TextStyle(color: RajaColors.textSecondary),
          ),
          const SizedBox(height: 10),
          wallet.when(
            data: (WalletSummary w) =>
                CoinBalance(amount: w.coinBalance, fontSize: 42, glyphSize: 36),
            loading: () => const SizedBox(
              height: 46,
              child: Align(
                alignment: Alignment.centerLeft,
                child: SizedBox(
                  width: 26,
                  height: 26,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: RajaColors.gold,
                  ),
                ),
              ),
            ),
            error: (_, _) => const Text(
              '—',
              style: TextStyle(
                fontSize: 42,
                fontWeight: FontWeight.w800,
                color: RajaColors.textMuted,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({required this.icon, required this.label, this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(vertical: 18),
      child: Column(
        children: <Widget>[
          Icon(icon, color: RajaColors.gold, size: 26),
          const SizedBox(height: 8),
          Text(
            label,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _RecentActivity extends StatelessWidget {
  const _RecentActivity({required this.wallet});

  final AsyncValue<WalletSummary> wallet;

  @override
  Widget build(BuildContext context) {
    return AsyncValueView<WalletSummary>(
      value: wallet,
      data: (WalletSummary w) {
        if (w.recentEntries.isEmpty) {
          return const EmptyStateView(
            icon: Icons.bolt_rounded,
            title: 'Nothing yet',
            subtitle: 'Complete a task to start earning.',
          );
        }
        return Column(
          children: w.recentEntries
              .take(5)
              .map((entry) => LedgerTile(entry: entry))
              .toList(),
        );
      },
    );
  }
}
