import 'package:cashraja/core/api/models/streak.dart';
import 'package:cashraja/core/providers.dart';
import 'package:cashraja/features/streak/presentation/streak_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fakes.dart';
import 'support/harness.dart';

void main() {
  testWidgets('Streak sheet claims the daily bonus when claimable',
      (tester) async {
    await pumpApp(
      tester,
      const Scaffold(body: StreakSheet()),
      overrides: <Override>[
        apiClientProvider.overrideWithValue(
          FakeApiClient(
            streakData: const StreakState(
              currentCount: 2,
              claimableToday: true,
              nextBonus: 15,
            ),
            onClaimStreak: () => const StreakClaimResult(
              streakCount: 3,
              coinsEarned: 15,
              newBalance: 315,
            ),
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.text('Claim 15 coins'), findsOneWidget);

    await tester.tap(find.text('Claim 15 coins'));
    await tester.pump(); // claim in flight
    await tester.pump(); // resolve claim + refresh
    await tester.pumpAndSettle();

    expect(find.textContaining('Day 3 claimed'), findsOneWidget);
  });

  testWidgets('Streak sheet shows caught-up state when not claimable',
      (tester) async {
    await pumpApp(
      tester,
      const Scaffold(body: StreakSheet()),
      overrides: <Override>[
        apiClientProvider.overrideWithValue(
          FakeApiClient(
            streakData: const StreakState(
              currentCount: 4,
              claimableToday: false,
              nextBonus: 30,
            ),
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.text('Claimed for today'), findsOneWidget);
  });
}
