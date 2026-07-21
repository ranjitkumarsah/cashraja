import 'package:cashraja/core/api/models/enums.dart';
import 'package:cashraja/core/api/models/redemption.dart';
import 'package:cashraja/features/rewards/presentation/redemption_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/harness.dart';

Redemption _redemption({
  required RedemptionStatus status,
  String? code,
  String? rejectionReason,
}) {
  return Redemption(
    id: 'r1',
    giftCard: const RedemptionGiftCard(
      id: 'g1',
      brand: GiftCardBrand.amazon,
      denomination: 100,
      coinCost: 1000,
    ),
    coinAmount: 1000,
    status: status,
    createdAt: DateTime(2026, 7, 20),
    giftCardCode: code,
    rejectionReason: rejectionReason,
  );
}

void main() {
  testWidgets('Issued redemption shows Issued chip and hidden code',
      (tester) async {
    await pumpApp(
      tester,
      Scaffold(
        body: SingleChildScrollView(
          child: RedemptionCard(
            redemption: _redemption(
              status: RedemptionStatus.issued,
              code: 'AMZN-1234-5678',
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // "Issued" appears in both the status chip and the timeline label.
    expect(find.text('Issued'), findsWidgets);
    expect(find.text('Amazon ₹100'), findsOneWidget);
    // Code is masked until revealed.
    expect(find.text('AMZN-1234-5678'), findsNothing);
    expect(find.text('Reveal'), findsOneWidget);

    await tester.tap(find.text('Reveal'));
    await tester.pumpAndSettle();
    expect(find.text('AMZN-1234-5678'), findsOneWidget);
  });

  testWidgets('Rejected redemption shows reason and refund note',
      (tester) async {
    await pumpApp(
      tester,
      Scaffold(
        body: SingleChildScrollView(
          child: RedemptionCard(
            redemption: _redemption(
              status: RedemptionStatus.rejected,
              rejectionReason: 'Suspicious activity',
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Rejected'), findsOneWidget);
    expect(find.textContaining('coins refunded'), findsOneWidget);
    expect(find.textContaining('Suspicious activity'), findsOneWidget);
  });

  testWidgets('Requested redemption is on the first timeline step',
      (tester) async {
    await pumpApp(
      tester,
      Scaffold(
        body: SingleChildScrollView(
          child: RedemptionCard(
            redemption: _redemption(status: RedemptionStatus.requested),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Requested'), findsWidgets);
  });
}
