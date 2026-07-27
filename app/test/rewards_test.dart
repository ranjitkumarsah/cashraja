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
  testWidgets(
      'Store groups only IN-STOCK cards, one per brand, hiding sold-out (H10)',
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
    // The sold-out ₹100 Amazon card is excluded, so Amazon summarises 1 card.
    expect(find.text('1 cards · from ₹50'), findsOneWidget);
    expect(find.text('1 cards · from ₹100'), findsOneWidget);
    // No brand renders an "Out of stock" summary — sold-out brands are hidden.
    expect(find.text('Out of stock'), findsNothing);
  });

  testWidgets('Brand detail lists ONLY in-stock denominations (H10)',
      (tester) async {
    await pumpApp(
      tester,
      const RewardsBrandScreen(brand: GiftCardBrand.amazon),
      overrides: <Override>[
        apiClientProvider
            .overrideWithValue(FakeApiClient(giftCardsData: _catalog)),
      ],
    );
    await tester.pumpAndSettle();

    // Only the in-stock ₹50 Amazon card shows; the sold-out ₹100 is filtered
    // out, and the Flipkart card is filtered by brand.
    expect(find.text('₹50'), findsOneWidget);
    expect(find.text('₹100'), findsNothing);
    expect(find.text('4 available'), findsOneWidget);

    // No sold-out affordance renders at all now.
    expect(find.text('Out of stock'), findsNothing);
    final Finder redeem = find.widgetWithText(FilledButton, 'Redeem');
    expect(redeem, findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Sold out'), findsNothing);
    expect(tester.widget<FilledButton>(redeem).onPressed, isNotNull);
  });
}
