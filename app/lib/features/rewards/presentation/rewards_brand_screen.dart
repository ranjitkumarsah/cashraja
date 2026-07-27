import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/models/enums.dart';
import '../../../core/api/models/gift_card.dart';
import '../../../core/theme/raja_colors.dart';
import '../../../core/theme/raja_theme.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../../core/widgets/coin_glyph.dart';
import '../../../core/widgets/gradient_background.dart';
import '../../ads/banner_ad_widget.dart';
import 'brand_style.dart';
import 'redeem_flow.dart';
import 'rewards_controllers.dart';

/// Brand detail (level 2 of the rewards redesign, H6): the available gift cards
/// for a single [brand] — one row per denomination with stock, coin cost, and
/// Redeem. A banner ad is pinned at the bottom of the page.
class RewardsBrandScreen extends ConsumerWidget {
  const RewardsBrandScreen({super.key, required this.brand});

  final GiftCardBrand brand;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final BrandStyle style = BrandStyle.of(brand);
    final AsyncValue<List<GiftCard>> cards =
        ref.watch(giftCardsControllerProvider);

    return Scaffold(
      appBar: AppBar(title: Text(style.label)),
      extendBodyBehindAppBar: true,
      body: GradientBackground(
        child: SafeArea(
          child: Column(
            children: <Widget>[
              Expanded(
                child: RefreshIndicator(
                  color: RajaColors.gold,
                  backgroundColor: RajaColors.surface,
                  onRefresh: () =>
                      ref.read(giftCardsControllerProvider.notifier).refresh(),
                  child: AsyncValueView<List<GiftCard>>(
                    value: cards,
                    onRetry: () => ref
                        .read(giftCardsControllerProvider.notifier)
                        .refresh(),
                    data: (List<GiftCard> all) {
                      // H10: show only in-stock denominations. The backend
                      // returns available>0 only; this filter is a defensive
                      // guard so sold-out cards never render.
                      final List<GiftCard> brandCards = all
                          .where((GiftCard c) => c.brand == brand && c.inStock)
                          .toList()
                        ..sort((GiftCard a, GiftCard b) =>
                            a.denomination.compareTo(b.denomination));
                      if (brandCards.isEmpty) {
                        return ListView(
                          children: const <Widget>[
                            SizedBox(height: 120),
                            EmptyStateView(
                              icon: Icons.card_giftcard_rounded,
                              title: 'No cards available',
                              subtitle:
                                  'Gift cards for this brand will appear here soon.',
                            ),
                          ],
                        );
                      }
                      return ListView(
                        padding: const EdgeInsets.all(16),
                        children: <Widget>[
                          _BrandHeader(style: style),
                          const SizedBox(height: 16),
                          for (final GiftCard card in brandCards) ...<Widget>[
                            _DenominationRow(
                              card: card,
                              style: style,
                              onRedeem: card.inStock
                                  ? () => confirmAndRedeem(context, ref, card)
                                  : null,
                            ),
                            const SizedBox(height: 12),
                          ],
                        ],
                      );
                    },
                  ),
                ),
              ),
              // Banner ad pinned at the bottom of the brand-detail page (H6).
              // Renders nothing until/unless an ad fills, so it reserves no space.
              const BannerAdWidget(),
            ],
          ),
        ),
      ),
    );
  }
}

class _BrandHeader extends StatelessWidget {
  const _BrandHeader({required this.style});

  final BrandStyle style;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: style.gradient,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: <Widget>[
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(style.icon, color: style.onColor, size: 28),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  style.label,
                  style: TextStyle(
                    color: style.onColor,
                    fontWeight: FontWeight.w800,
                    fontSize: 20,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Choose a denomination to redeem',
                  style: TextStyle(
                    color: style.onColor.withValues(alpha: 0.85),
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DenominationRow extends StatelessWidget {
  const _DenominationRow({
    required this.card,
    required this.style,
    required this.onRedeem,
  });

  final GiftCard card;
  final BrandStyle style;

  /// Null ⇒ out of stock: the Redeem button is disabled.
  final VoidCallback? onRedeem;

  @override
  Widget build(BuildContext context) {
    final bool outOfStock = !card.inStock;
    return AppCard(
      child: Row(
        children: <Widget>[
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                '₹${card.denomination}',
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: RajaColors.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              Row(
                children: <Widget>[
                  const CoinGlyph(size: 15),
                  const SizedBox(width: 5),
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
            ],
          ),
          const Spacer(),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: <Widget>[
              Text(
                outOfStock ? 'Out of stock' : '${card.available} available',
                style: TextStyle(
                  color: outOfStock ? RajaColors.rose : RajaColors.textMuted,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                height: 36,
                child: FilledButton(
                  onPressed: onRedeem,
                  style: FilledButton.styleFrom(
                    backgroundColor: RajaColors.gold,
                    foregroundColor: const Color(0xFF1A1300),
                    disabledBackgroundColor: RajaColors.surfaceHigh,
                    disabledForegroundColor: RajaColors.textMuted,
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(
                    outOfStock ? 'Sold out' : 'Redeem',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
