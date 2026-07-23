import 'package:cashraja/core/api/models/bonus.dart';
import 'package:cashraja/core/providers.dart';
import 'package:cashraja/core/widgets/primary_button.dart';
import 'package:cashraja/features/ads/rewarded_ad_service.dart';
import 'package:cashraja/features/bonus/presentation/bonus_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fakes.dart';
import 'support/harness.dart';

BonusState _state(BonusKind kind, {int remaining = 1}) => BonusState(
      kind: kind,
      attemptsRemaining: remaining,
      attemptsPerDay: 1,
      unlocked: true,
    );

void main() {
  testWidgets('Spin claim-via-ad rolls + reveals the server prize (G6)',
      (tester) async {
    await pumpApp(
      tester,
      const BonusScreen(),
      overrides: <Override>[
        rewardedAdServiceProvider
            .overrideWithValue(FakeRewardedAdService(AdResult.watched)),
        apiClientProvider.overrideWithValue(
          FakeApiClient(
            bonusStateData: (BonusKind kind) => _state(kind),
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

    // Switch to the Spin tab and start the ad-gated claim.
    await tester.tap(find.text('Spin'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Spin now'));
    await tester.pumpAndSettle(); // claim popup
    expect(find.text('Watch ad & claim'), findsOneWidget);

    await tester.tap(find.text('Watch ad & claim'));
    await tester.pump(); // dialog closes
    await tester.pump(); // ad watched → play() in flight
    await tester.pump(); // resolve play()
    await tester.pumpAndSettle(); // spin animation

    expect(find.text('YOU WON'), findsOneWidget);
    expect(find.text('25'), findsOneWidget); // server-authoritative prize
  });

  testWidgets('Spin Close forfeits without rolling a prize (G6)', (tester) async {
    bool played = false;
    await pumpApp(
      tester,
      const BonusScreen(),
      overrides: <Override>[
        rewardedAdServiceProvider
            .overrideWithValue(FakeRewardedAdService(AdResult.watched)),
        apiClientProvider.overrideWithValue(
          FakeApiClient(
            bonusStateData: (BonusKind kind) => _state(kind),
            onPlayBonus: (BonusKind kind) {
              played = true;
              return const BonusPlayResult(
                prizeCoins: 25,
                newBalance: 125,
                attemptsRemaining: 0,
              );
            },
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Spin'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Spin now'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Close'));
    await tester.pumpAndSettle();

    expect(played, isFalse); // no roll / credit on forfeit
    expect(find.text('YOU WON'), findsNothing);
  });

  testWidgets('Scratch tab shows the scratchable foil', (tester) async {
    await pumpApp(
      tester,
      const BonusScreen(),
      overrides: <Override>[
        apiClientProvider.overrideWithValue(
          FakeApiClient(bonusStateData: (BonusKind kind) => _state(kind)),
        ),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.text('1 left'), findsWidgets);
    expect(find.textContaining('Scratch the card'), findsOneWidget);
  });

  testWidgets('No attempts left disables Spin', (tester) async {
    await pumpApp(
      tester,
      const BonusScreen(),
      overrides: <Override>[
        apiClientProvider.overrideWithValue(
          FakeApiClient(
            bonusStateData: (BonusKind kind) => _state(kind, remaining: 0),
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Spin'));
    await tester.pumpAndSettle();

    final PrimaryButton button = tester.widget<PrimaryButton>(
      find.ancestor(
        of: find.text('Spin now'),
        matching: find.byType(PrimaryButton),
      ),
    );
    expect(button.onPressed, isNull);
  });
}
