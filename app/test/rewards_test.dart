import 'package:cashraja/core/api/models/enums.dart';
import 'package:cashraja/core/api/models/gift_card.dart';
import 'package:cashraja/core/providers.dart';
import 'package:cashraja/features/rewards/presentation/rewards_brand_screen.dart';
import 'package:cashraja/features/rewards/presentation/rewards_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fakes.dart';
import 'support/harness.dart';

const List<GiftCard> _catalog = <GiftCard>[
  GiftCard(
    id: 'amz-50',
    brand: GiftCardBrand.amazon,
    denomination: 50,
    coinCost: 5000,
    isActive: true,
    available: 4,
  ),
  GiftCard(
    id: 'amz-100',
    brand: GiftCardBrand.amazon,
    denomination: 100,
    coinCost: 10000,
    isActive: true,
    available: 0,
  ),
  GiftCard(
    id: 'flk-100',
    brand: GiftCardBrand.flipkart,
    denomination: 100,
    coinCost: 10000,
    isActive: true,
    available: 2,
  ),
];

void main() {
  testWidgets('Store groups the catalog into one card per brand (H6 level 1)',
      (tester) async {
    await pumpApp(
      tester,
      const RewardsScreen(),
      overrides: <Override>[
        apiClientProvider
            .overrideWithValue(FakeApiClient(giftCardsData: _catalog)),
      ],
    );
    await tester.pumpAndSettle();

    // One brand tile each — NOT one tile per denomination.
    expect(find.text('Amazon'), findsOneWidget);
    expect(find.text('Flipkart'), findsOneWidget);
    // Brand tile summarises the denominations (2 Amazon cards, from ₹50).
    expect(find.text('2 cards · from ₹50'), findsOneWidget);
    expect(find.text('1 cards · from ₹100'), findsOneWidget);
    // The flat ₹-per-card grid is gone from the store landing.
    expect(find.text('4 available'), findsNothing);
  });

  testWidgets(
      'Brand detail lists denominations with stock and disables sold-out redeem '
      '(H6 level 2)', (tester) async {
    await pumpApp(
      tester,
      const RewardsBrandScreen(brand: GiftCardBrand.amazon),
      overrides: <Override>[
        apiClientProvider
            .overrideWithValue(FakeApiClient(giftCardsData: _catalog)),
      ],
    );
    await tester.pumpAndSettle();

    // Both Amazon denominations show; the Flipkart card is filtered out.
    expect(find.text('₹50'), findsOneWidget);
    expect(find.text('₹100'), findsOneWidget);

    // Stock strings: in-stock count + sold-out marker.
    expect(find.text('4 available'), findsOneWidget);
    expect(find.text('Out of stock'), findsOneWidget);

    // In-stock card has an enabled Redeem button; sold-out one is disabled.
    final Finder redeem = find.widgetWithText(FilledButton, 'Redeem');
    final Finder soldOut = find.widgetWithText(FilledButton, 'Sold out');
    expect(redeem, findsOneWidget);
    expect(soldOut, findsOneWidget);
    expect(tester.widget<FilledButton>(redeem).onPressed, isNotNull);
    expect(tester.widget<FilledButton>(soldOut).onPressed, isNull);
  });
}
