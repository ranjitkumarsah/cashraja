import 'package:cashraja/core/api/models/enums.dart';
import 'package:cashraja/core/api/models/gift_card.dart';
import 'package:cashraja/core/providers.dart';
import 'package:cashraja/features/rewards/presentation/rewards_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fakes.dart';
import 'support/harness.dart';

void main() {
  testWidgets('Rewards store shows stock and disables sold-out cards (G0.2)',
      (tester) async {
    await pumpApp(
      tester,
      const RewardsScreen(),
      overrides: <Override>[
        apiClientProvider.overrideWithValue(
          FakeApiClient(
            giftCardsData: <GiftCard>[
              const GiftCard(
                id: 'in-stock',
                brand: GiftCardBrand.amazon,
                denomination: 50,
                coinCost: 5000,
                isActive: true,
                available: 4,
              ),
              const GiftCard(
                id: 'sold-out',
                brand: GiftCardBrand.flipkart,
                denomination: 100,
                coinCost: 10000,
                isActive: true,
                available: 0,
              ),
            ],
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    // In-stock card shows its available count; sold-out card is marked.
    expect(find.text('4 available'), findsOneWidget);
    expect(find.text('Out of stock'), findsOneWidget);
    expect(find.text('Sold out'), findsOneWidget);

    // Tapping the sold-out card does nothing (no redeem confirm sheet opens).
    await tester.tap(find.text('Out of stock'));
    await tester.pumpAndSettle();
    expect(find.textContaining('will be reserved now'), findsNothing);
  });
}
