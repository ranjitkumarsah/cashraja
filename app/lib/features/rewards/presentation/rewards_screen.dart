import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/models/enums.dart';
import '../../../core/api/models/gift_card.dart';
import '../../../core/api/models/redemption.dart';
import '../../../core/router/app_router.dart';
import '../../../core/theme/raja_colors.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../../core/widgets/gradient_background.dart';
import 'brand_style.dart';
import 'redemption_card.dart';
import 'rewards_controllers.dart';

/// Rewards hub: a gift-card store (two levels — brand grid → brand detail) and
/// the user's redemption history.
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

/// Level 1: one card per BRAND. Tapping opens that brand's denominations.
class _StoreTab extends ConsumerWidget {
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
          final List<_BrandGroup> brands = _groupByBrand(list);
          return GridView.builder(
            padding: const EdgeInsets.all(16),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 0.9,
            ),
            itemCount: brands.length,
            itemBuilder: (_, int i) => _BrandTile(
              group: brands[i],
              onTap: () =>
                  context.push('${Routes.rewards}/brand/${brands[i].brand.wire}'),
            ),
          );
        },
      ),
    );
  }

  /// Group the flat catalog into one entry per brand, in a stable brand order.
  /// H10: only IN-STOCK cards are grouped, so brands with no available stock are
  /// hidden from the store grid entirely (the backend already filters to
  /// available>0; this is a defensive client-side guard).
  static List<_BrandGroup> _groupByBrand(List<GiftCard> cards) {
    const List<GiftCardBrand> order = <GiftCardBrand>[
      GiftCardBrand.amazon,
      GiftCardBrand.flipkart,
      GiftCardBrand.googlePlay,
      GiftCardBrand.unknown,
    ];
    final Map<GiftCardBrand, List<GiftCard>> byBrand =
        <GiftCardBrand, List<GiftCard>>{};
    for (final GiftCard c in cards) {
      if (!c.inStock) continue;
      byBrand.putIfAbsent(c.brand, () => <GiftCard>[]).add(c);
    }
    final List<_BrandGroup> groups = <_BrandGroup>[];
    for (final GiftCardBrand b in order) {
      final List<GiftCard> items = byBrand[b] ?? <GiftCard>[];
      if (items.isEmpty) continue;
      groups.add(_BrandGroup(brand: b, cards: items));
    }
    return groups;
  }
}

class _BrandGroup {
  _BrandGroup({required this.brand, required this.cards});

  final GiftCardBrand brand;
  final List<GiftCard> cards;

  int get denominationCount => cards.length;
  bool get anyInStock => cards.any((GiftCard c) => c.inStock);
  int get minDenomination =>
      cards.map((GiftCard c) => c.denomination).reduce((int a, int b) => a < b ? a : b);
}

class _BrandTile extends StatelessWidget {
  const _BrandTile({required this.group, required this.onTap});

  final _BrandGroup group;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final BrandStyle style = BrandStyle.of(group.brand);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Ink(
          decoration: BoxDecoration(
            gradient: style.gradient,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  // NOTE: generic gift-card icon by design — no copyrighted
                  // brand logos are bundled (see BrandStyle).
                  child: Icon(style.icon, color: style.onColor, size: 24),
                ),
                const Spacer(),
                Text(
                  style.label,
                  style: TextStyle(
                    color: style.onColor,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  group.anyInStock
                      ? '${group.denominationCount} cards · from ₹${group.minDenomination}'
                      : 'Out of stock',
                  style: TextStyle(
                    color: group.anyInStock
                        ? style.onColor.withValues(alpha: 0.85)
                        : style.accent,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
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
