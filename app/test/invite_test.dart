import 'package:cashraja/core/api/models/referral.dart';
import 'package:cashraja/core/providers.dart';
import 'package:cashraja/features/invite/presentation/invite_screen.dart';
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
}
