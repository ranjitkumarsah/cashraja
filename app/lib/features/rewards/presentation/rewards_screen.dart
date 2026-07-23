import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models/gift_card.dart';
import '../../../core/api/models/redemption.dart';
import '../../../core/theme/raja_colors.dart';
import '../../../core/theme/raja_theme.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../../core/widgets/coin_glyph.dart';
import '../../../core/widgets/gradient_background.dart';
import '../../../core/widgets/primary_button.dart';
import '../../wallet/presentation/wallet_controllers.dart';
import 'redemption_card.dart';
import 'rewards_controllers.dart';

/// Rewards hub: a gift-card store and the user's redemption history.
class RewardsScreen extends ConsumerWidget {
  const RewardsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Rewards'),
          bottom: const TabBar(
            indicatorColor: RajaColors.gold,
            labelColor: RajaColors.gold,
            unselectedLabelColor: RajaColors.textMuted,
            tabs: <Widget>[
              Tab(text: 'Store'),
              Tab(text: 'My redemptions'),
            ],
          ),
        ),
        extendBodyBehindAppBar: true,
        body: GradientBackground(
          child: SafeArea(
            child: TabBarView(
              children: <Widget>[
                _StoreTab(),
                _HistoryTab(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _StoreTab extends ConsumerWidget {
  Future<void> _confirm(
    BuildContext context,
    WidgetRef ref,
    GiftCard card,
  ) async {
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
      builder: (_) => _ConfirmSheet(card: card, affordable: affordable),
    );
    if (go != true) return;

    if (!context.mounted) return;
    try {
      final Redemption r = await ref
          .read(redemptionsControllerProvider.notifier)
          .redeem(card.id);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Redemption ${r.status.label.toLowerCase()} — track it under '
            'My redemptions.',
          ),
        ),
      );
      DefaultTabController.of(context).animateTo(1);
    } on ApiException catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<GiftCard>> cards =
        ref.watch(giftCardsControllerProvider);
    return RefreshIndicator(
      color: RajaColors.gold,
      backgroundColor: RajaColors.surface,
      onRefresh: () => ref.read(giftCardsControllerProvider.notifier).refresh(),
      child: AsyncValueView<List<GiftCard>>(
        value: cards,
        onRetry: () => ref.read(giftCardsControllerProvider.notifier).refresh(),
        data: (List<GiftCard> list) {
          if (list.isEmpty) {
            return ListView(
              children: const <Widget>[
                SizedBox(height: 120),
                EmptyStateView(
                  icon: Icons.card_giftcard_rounded,
                  title: 'Store is empty',
                  subtitle: 'Gift cards will appear here soon.',
                ),
              ],
            );
          }
          return GridView.builder(
            padding: const EdgeInsets.all(16),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 0.82,
            ),
            itemCount: list.length,
            itemBuilder: (_, int i) => _GiftCardTile(
              card: list[i],
              onTap: list[i].inStock ? () => _confirm(context, ref, list[i]) : null,
            ),
          );
        },
      ),
    );
  }
}

class _GiftCardTile extends StatelessWidget {
  const _GiftCardTile({required this.card, required this.onTap});

  final GiftCard card;

  /// Null ⇒ out of stock: the tile is greyed and non-interactive.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final bool outOfStock = !card.inStock;
    final Widget tile = AppCard(
      onTap: onTap,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const Icon(Icons.card_giftcard_rounded,
              color: RajaColors.gold, size: 28),
          const Spacer(),
          Text(
            card.brand.label,
            style: const TextStyle(color: RajaColors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 2),
          Text(
            '₹${card.denomination}',
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: RajaColors.textPrimary,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: <Widget>[
              const CoinGlyph(size: 16),
              const SizedBox(width: 6),
              Text(
                '${card.coinCost}',
                style: const TextStyle(
                  color: RajaColors.gold,
                  fontWeight: FontWeight.w800,
                  fontFeatures: RajaTheme.tabularFigures,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            outOfStock ? 'Out of stock' : '${card.available} available',
            style: TextStyle(
              color: outOfStock ? RajaColors.rose : RajaColors.textMuted,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
    if (!outOfStock) return tile;
    // Greyed + a corner badge for sold-out cards.
    return Opacity(
      opacity: 0.55,
      child: Stack(
        children: <Widget>[
          tile,
          Positioned(
            top: 12,
            right: 12,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: RajaColors.surfaceHigh,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: RajaColors.border),
              ),
              child: const Text(
                'Sold out',
                style: TextStyle(
                  color: RajaColors.textMuted,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ConfirmSheet extends StatelessWidget {
  const _ConfirmSheet({required this.card, required this.affordable});

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
              onPressed: affordable
                  ? () => Navigator.of(context).pop(true)
                  : null,
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

class _HistoryTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<Redemption>> history =
        ref.watch(redemptionsControllerProvider);
    return RefreshIndicator(
      color: RajaColors.gold,
      backgroundColor: RajaColors.surface,
      onRefresh: () =>
          ref.read(redemptionsControllerProvider.notifier).refresh(),
      child: AsyncValueView<List<Redemption>>(
        value: history,
        onRetry: () =>
            ref.read(redemptionsControllerProvider.notifier).refresh(),
        data: (List<Redemption> list) {
          if (list.isEmpty) {
            return ListView(
              children: const <Widget>[
                SizedBox(height: 120),
                EmptyStateView(
                  icon: Icons.history_rounded,
                  title: 'No redemptions yet',
                  subtitle: 'Redeem a gift card and track its status here.',
                ),
              ],
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: list.length,
            separatorBuilder: (_, _) => const SizedBox(height: 12),
            itemBuilder: (_, int i) => RedemptionCard(redemption: list[i]),
          );
        },
      ),
    );
  }
}
