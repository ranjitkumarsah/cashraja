import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models/ad_reward.dart';
import '../../../core/api/models/streak.dart';
import '../../../core/api/models/wallet.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/raja_colors.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../../core/widgets/coin_balance.dart';
import '../../../core/widgets/gradient_background.dart';
import '../../../core/widgets/streak_flame.dart';
import '../../ads/ad_reward_controller.dart';
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
                const _WatchEarnCard(),
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

/// G7 (3g): "Watch & earn" with a server-enforced daily cap (10) + cooldown.
/// Shows the remaining count and a live cooldown countdown; the credit comes
/// from `POST /api/ads/reward` only after a completed rewarded-ad watch.
class _WatchEarnCard extends ConsumerStatefulWidget {
  const _WatchEarnCard();

  @override
  ConsumerState<_WatchEarnCard> createState() => _WatchEarnCardState();
}

class _WatchEarnCardState extends ConsumerState<_WatchEarnCard> {
  Timer? _ticker;
  int _cooldown = 0;
  bool _busy = false;

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  void _startCooldown(int seconds) {
    _ticker?.cancel();
    setState(() => _cooldown = seconds);
    if (seconds <= 0) return;
    _ticker = Timer.periodic(const Duration(seconds: 1), (Timer t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      setState(() {
        _cooldown -= 1;
        if (_cooldown <= 0) {
          _cooldown = 0;
          t.cancel();
          _ticker = null;
        }
      });
    });
  }

  Future<void> _watch(AdRewardState st) async {
    if (_busy || _cooldown > 0 || !st.canWatch) return;
    setState(() => _busy = true);
    final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);

    final AdResult result = await ref.read(rewardedAdServiceProvider).show();
    if (!mounted) return;
    if (result != AdResult.watched) {
      setState(() => _busy = false);
      messenger.showSnackBar(
        const SnackBar(content: Text('Watch the full ad to earn coins.')),
      );
      return;
    }

    try {
      final AdRewardResult r =
          await ref.read(adRewardControllerProvider.notifier).claim();
      if (!mounted) return;
      await ref.read(walletControllerProvider.notifier).refresh();
      if (!mounted) return;
      setState(() => _busy = false);
      _startCooldown(r.cooldownSeconds);
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            '+${r.coinsEarned} coins! ${r.rewardsRemainingToday} left today.',
          ),
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      await ref.read(adRewardControllerProvider.notifier).refresh();
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    // Adopt the server's cooldown once when we aren't already counting down.
    ref.listen<AsyncValue<AdRewardState>>(adRewardControllerProvider,
        (AsyncValue<AdRewardState>? prev, AsyncValue<AdRewardState> next) {
      final AdRewardState? st = next.valueOrNull;
      if (st == null) return;
      if (_ticker == null && _cooldown == 0 && st.cooldownRemainingSeconds > 0) {
        _startCooldown(st.cooldownRemainingSeconds);
      }
    });

    final AdRewardState? st =
        ref.watch(adRewardControllerProvider).valueOrNull;

    final bool capReached = st?.capReached ?? false;
    final bool onCooldown = _cooldown > 0;
    final bool enabled = st != null && !capReached && !onCooldown && !_busy;

    final String subtitle;
    if (capReached) {
      subtitle = 'Daily limit reached — come back tomorrow';
    } else if (onCooldown) {
      subtitle = 'Next reward in ${_cooldown}s';
    } else if (st != null) {
      subtitle = '${st.rewardsRemainingToday} left today · +${st.coinsPerView} coins';
    } else {
      subtitle = 'Watch a short video for bonus coins';
    }

    return AppCard(
      onTap: enabled ? () => _watch(st) : null,
      gradient: RajaColors.royalGradient,
      child: Row(
        children: <Widget>[
          const Icon(Icons.smart_display_rounded, color: RajaColors.gold, size: 28),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                const Text(
                  'Watch & earn',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(color: RajaColors.textMuted, fontSize: 13),
                ),
              ],
            ),
          ),
          if (_busy)
            const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2.4, color: RajaColors.gold),
            )
          else if (onCooldown)
            Text(
              '${_cooldown}s',
              style: const TextStyle(
                color: RajaColors.textSecondary,
                fontWeight: FontWeight.w700,
              ),
            )
          else
            const Icon(Icons.chevron_right_rounded, color: RajaColors.textMuted),
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
