import 'package:cashraja/core/api/api_exception.dart';
import 'package:cashraja/core/api/models/game.dart';
import 'package:cashraja/core/providers.dart';
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
  testWidgets('Game round: start → play → server coins revealed',
      (tester) async {
    await pumpApp(
      tester,
      const GameScreen(),
      overrides: <Override>[
        apiClientProvider.overrideWithValue(
          FakeApiClient(
            onStartRound: (GameDifficulty d) => GameRound(
              roundId: 'r-1',
              difficulty: d,
              expiresAt: DateTime.now().add(const Duration(seconds: 120)),
              dailyCapRemaining: 19,
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

    // Fire the min-play-time timer → round-complete → result.
    await tester.pump(const Duration(seconds: 12));
    await tester.pump(); // resolve round-complete
    await tester.pumpAndSettle();

    expect(find.text('Round cleared!'), findsOneWidget);
    expect(find.text('5'), findsOneWidget); // server-authoritative coins
    expect(find.textContaining('18 rounds left'), findsOneWidget);
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
