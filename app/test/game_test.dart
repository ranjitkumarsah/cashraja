import 'package:cashraja/core/api/api_exception.dart';
import 'package:cashraja/core/api/models/game.dart';
import 'package:cashraja/core/providers.dart';
import 'package:cashraja/features/ads/rewarded_ad_service.dart';
import 'package:cashraja/features/game/presentation/game_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fakes.dart';
import 'support/harness.dart';

/// Reads the currently-displayed target number from the big prompt (tagged with
/// a `ValueKey<int>`).
int _currentTarget(WidgetTester tester) {
  final Text big = tester
      .widgetList<Text>(find.byType(Text))
      .firstWhere((Text t) => t.key is ValueKey<int>);
  return (big.key! as ValueKey<int>).value;
}

Future<void> _startEasy(WidgetTester tester) async {
  await tester.tap(find.text('Easy'));
  await tester.pump(); // → starting
  await tester.pump(); // resolve round-start → playing
  await tester.pump(const Duration(milliseconds: 300)); // switcher settle
}

Future<void> _clearRound(WidgetTester tester) async {
  // Easy tier requires 5 correct taps. Tap a grid tile (never the big prompt)
  // matching the current target each round.
  for (int i = 0; i < GameDifficulty.easy.targets; i++) {
    final int target = _currentTarget(tester);
    final Finder tile = find
        .descendant(
          of: find.byType(GridView),
          matching: find.text('$target'),
        )
        .first;
    await tester.tap(tile);
    await tester.pump();
  }
}

void main() {
  testWidgets('Game win popup: claim watches an ad then credits server coins (G4)',
      (tester) async {
    await pumpApp(
      tester,
      const GameScreen(),
      overrides: <Override>[
        rewardedAdServiceProvider
            .overrideWithValue(FakeRewardedAdService(AdResult.watched)),
        apiClientProvider.overrideWithValue(
          FakeApiClient(
            onStartRound: (GameDifficulty d) => GameRound(
              roundId: 'r-1',
              difficulty: d,
              expiresAt: DateTime.now().add(const Duration(seconds: 120)),
              dailyCapRemaining: 19,
              rewardPreview: 5,
            ),
            onCompleteRound: (String roundId) => const RoundResult(
              coinsEarned: 5,
              newBalance: 105,
              dailyCapRemaining: 18,
            ),
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    await _startEasy(tester);
    expect(find.text('Find the number'), findsOneWidget);

    await _clearRound(tester);

    // Under the min play-time, the round is held for verification first.
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Locking in your round…'), findsOneWidget);

    // Fire the min-play-time timer → the win claim popup (reward preview shown).
    await tester.pump(const Duration(seconds: 12));
    await tester.pumpAndSettle();
    expect(find.text('Watch ad & claim'), findsOneWidget);

    // Claim → rewarded ad (watched) → round-complete → result.
    await tester.tap(find.text('Watch ad & claim'));
    await tester.pump(); // dialog closes
    await tester.pump(); // ad watched → round-complete in flight
    await tester.pump(); // resolve round-complete
    await tester.pumpAndSettle();

    expect(find.textContaining('18 rounds left'), findsOneWidget);
  });

  testWidgets('Game win popup: Close forfeits the round without crediting (G4)',
      (tester) async {
    bool completed = false;
    await pumpApp(
      tester,
      const GameScreen(),
      overrides: <Override>[
        rewardedAdServiceProvider
            .overrideWithValue(FakeRewardedAdService(AdResult.watched)),
        apiClientProvider.overrideWithValue(
          FakeApiClient(
            onStartRound: (GameDifficulty d) => GameRound(
              roundId: 'r-1',
              difficulty: d,
              expiresAt: DateTime.now().add(const Duration(seconds: 120)),
              dailyCapRemaining: 19,
              rewardPreview: 5,
            ),
            onCompleteRound: (String roundId) {
              completed = true;
              return const RoundResult(
                coinsEarned: 5,
                newBalance: 105,
                dailyCapRemaining: 18,
              );
            },
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    await _startEasy(tester);
    await _clearRound(tester);
    await tester.pump(const Duration(seconds: 12));
    await tester.pumpAndSettle();

    // Close forfeits — round-complete is never called, back to the picker.
    await tester.tap(find.text('Close'));
    await tester.pumpAndSettle();

    expect(completed, isFalse);
    expect(find.text('Pick your challenge'), findsOneWidget);
  });

  testWidgets('Game shows the daily-cap state when the server rejects start',
      (tester) async {
    await pumpApp(
      tester,
      const GameScreen(),
      overrides: <Override>[
        apiClientProvider.overrideWithValue(
          FakeApiClient(
            onStartRound: (GameDifficulty d) =>
                throw const ApiException('daily_round_cap_reached',
                    statusCode: 429),
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Medium'));
    await tester.pump();
    await tester.pump();
    await tester.pumpAndSettle();

    expect(find.text('That\'s a wrap for today'), findsOneWidget);
  });
}
