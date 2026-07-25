import 'package:cashraja/core/api/models/referral.dart';
import 'package:cashraja/core/providers.dart';
import 'package:cashraja/features/invite/presentation/invite_screen.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fakes.dart';
import 'support/harness.dart';

void main() {
  testWidgets('Invite screen renders the referral code and stats',
      (tester) async {
    await pumpApp(
      tester,
      const InviteScreen(),
      overrides: <Override>[
        apiClientProvider.overrideWithValue(
          FakeApiClient(
            referralCodeData: const ReferralCode(code: 'RAJA7777'),
            referralStatsData: const ReferralStats(
              code: 'RAJA7777',
              referredCount: 3,
              activeReferrals: 2,
              totalEarned: 150,
            ),
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.text('RAJA7777'), findsOneWidget);
    expect(find.text('3'), findsOneWidget); // referred
    expect(find.text('2'), findsOneWidget); // active
    expect(find.text('150'), findsOneWidget); // earned
    expect(find.text('Share invite'), findsOneWidget);
  });

  testWidgets('renders the referral breakdown: friends, earnings and rule',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 2600));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await pumpApp(
      tester,
      const InviteScreen(),
      overrides: <Override>[
        apiClientProvider.overrideWithValue(
          FakeApiClient(
            referralCodeData: const ReferralCode(code: 'RAJA7777'),
            referralStatsData: const ReferralStats(
              code: 'RAJA7777',
              referredCount: 1,
              activeReferrals: 1,
              totalEarned: 50,
            ),
            referralBreakdownData: ReferralBreakdown(
              referred: <ReferredUser>[
                ReferredUser(
                  displayName: 'Priya',
                  joinedAt: DateTime(2026, 7, 1),
                  theirEarningsTotal: 500,
                  commissionEarnedByMe: 50,
                  windowActive: true,
                  validUntil: DateTime(2026, 8, 1),
                ),
              ],
              referredCount: 1,
              activeCount: 1,
              totalCommission: 50,
              bonusPercent: 10,
              windowDays: 30,
            ),
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.text('Referred friends'), findsOneWidget);
    expect(find.text('Priya'), findsOneWidget);
    // "Active" appears both as the stats-tile label and the window chip.
    expect(find.text('Active'), findsNWidgets(2));
    expect(find.text('They earned'), findsOneWidget);
    expect(find.text('You earned'), findsOneWidget);
    expect(find.text('500'), findsOneWidget); // their earnings
  });
}
