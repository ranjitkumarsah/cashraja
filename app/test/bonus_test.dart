import 'package:cashraja/core/api/models/bonus.dart';
import 'package:cashraja/core/providers.dart';
import 'package:cashraja/core/widgets/primary_button.dart';
import 'package:cashraja/features/bonus/presentation/bonus_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fakes.dart';
import 'support/harness.dart';

void main() {
  testWidgets('Scratch reveals the server-rolled prize and decrements attempts',
      (tester) async {
    await pumpApp(
      tester,
      const BonusScreen(),
      overrides: <Override>[
        apiClientProvider.overrideWithValue(
          FakeApiClient(
            bonusStateData: (BonusKind kind) => BonusState(
              kind: kind,
              attemptsRemaining: 1,
              attemptsPerDay: 1,
              unlocked: true,
            ),
            onPlayBonus: (BonusKind kind) => const BonusPlayResult(
              prizeCoins: 25,
              newBalance: 125,
              attemptsRemaining: 0,
            ),
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.text('1 left'), findsWidgets);
    expect(find.text('Scratch to reveal'), findsOneWidget);

    await tester.tap(find.text('Scratch to reveal'));
    await tester.pump(); // play() kicks off
    await tester.pump(); // resolve play()
    await tester.pumpAndSettle();

    // The revealed prize is the SERVER value, and attempts have decremented.
    expect(find.text('YOU WON'), findsOneWidget);
    expect(find.text('25'), findsOneWidget);
    expect(find.text('0 left'), findsOneWidget);
    expect(find.text('Come back tomorrow'), findsOneWidget);
  });

  testWidgets('No attempts left disables play', (tester) async {
    await pumpApp(
      tester,
      const BonusScreen(),
      overrides: <Override>[
        apiClientProvider.overrideWithValue(
          FakeApiClient(
            bonusStateData: (BonusKind kind) => BonusState(
              kind: kind,
              attemptsRemaining: 0,
              attemptsPerDay: 1,
              unlocked: true,
            ),
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.text('0 left'), findsWidgets);
    // Play is disabled while attempts are exhausted.
    final PrimaryButton button = tester.widget<PrimaryButton>(
      find.ancestor(
        of: find.text('Scratch to reveal'),
        matching: find.byType(PrimaryButton),
      ),
    );
    expect(button.onPressed, isNull);
  });
}
