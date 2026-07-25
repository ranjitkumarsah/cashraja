import 'package:cashraja/core/api/models/bonus.dart';
import 'package:cashraja/core/providers.dart';
import 'package:cashraja/core/widgets/primary_button.dart';
import 'package:cashraja/features/ads/rewarded_ad_service.dart';
import 'package:cashraja/features/bonus/presentation/bonus_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fakes.dart';
import 'support/harness.dart';

BonusState _state(BonusKind kind, {int remaining = 1}) => BonusState(
      kind: kind,
      attemptsRemaining: remaining,
      attemptsPerDay: 1,
      unlocked: true,
      prizes: const <int>[0, 5, 25, 100],
    );

void main() {
  testWidgets(
      'Spin: tap → wheel lands on the reserved prize → claim-via-ad credits it '
      '(Issue 4)', (tester) async {
    bool claimed = false;
    await pumpApp(
      tester,
      const BonusScreen(),
      overrides: <Override>[
        rewardedAdServiceProvider
            .overrideWithValue(FakeRewardedAdService(AdResult.watched)),
        apiClientProvider.overrideWithValue(
          FakeApiClient(
            bonusStateData: (BonusKind kind) => _state(kind),
            // Server reserves the prize first (no credit)…
            onRollBonus: (BonusKind kind) => const BonusRollResult(
              reservationId: 'res-1',
              prizeCoins: 25,
              attemptsRemaining: 0,
            ),
            // …then the ad-gated claim credits exactly that reservation.
            onClaimBonus: (BonusKind kind, String reservationId) {
              claimed = reservationId == 'res-1';
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

    // Tap Spin → roll happens → wheel animates → THEN the claim popup appears.
    await tester.tap(find.text('Spin now'));
    await tester.pumpAndSettle(); // roll + spin animation settle → claim popup
    expect(find.text('Watch ad & claim'), findsOneWidget);
    expect(find.text('You won!'), findsOneWidget);

    await tester.tap(find.text('Watch ad & claim'));
    await tester.pumpAndSettle();

    expect(claimed, isTrue); // credited the reserved prize
    expect(find.text('YOU WON'), findsOneWidget);
    expect(find.text('25'), findsWidgets); // server-authoritative prize
  });

  testWidgets('Spin Close forfeits the reserved prize without crediting '
      '(Issue 4)', (tester) async {
    bool claimed = false;
    await pumpApp(
      tester,
      const BonusScreen(),
      overrides: <Override>[
        rewardedAdServiceProvider
            .overrideWithValue(FakeRewardedAdService(AdResult.watched)),
        apiClientProvider.overrideWithValue(
          FakeApiClient(
            bonusStateData: (BonusKind kind) => _state(kind),
            onRollBonus: (BonusKind kind) => const BonusRollResult(
              reservationId: 'res-1',
              prizeCoins: 25,
              attemptsRemaining: 0,
            ),
            onClaimBonus: (BonusKind kind, String reservationId) {
              claimed = true;
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
    await tester.pumpAndSettle(); // wheel lands → claim popup

    await tester.tap(find.text('Close'));
    await tester.pumpAndSettle();

    expect(claimed, isFalse); // forfeit never credits
    expect(find.text('YOU WON'), findsNothing);
  });

  testWidgets(
      'Scratch/Spin tabs never swipe — TabBarView physics is NeverScrollable '
      'so a scratch drag can never change tabs (Issue 1)', (tester) async {
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

    final TabBarView view = tester.widget<TabBarView>(find.byType(TabBarView));
    expect(view.physics, isA<NeverScrollableScrollPhysics>());
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

  testWidgets(
      'Scratch two-step: threshold → roll reveals the REAL coins on the card '
      'BEFORE the ad → claim-via-ad credits the reservation', (tester) async {
    bool claimed = false;
    await pumpApp(
      tester,
      const BonusScreen(),
      overrides: <Override>[
        rewardedAdServiceProvider
            .overrideWithValue(FakeRewardedAdService(AdResult.watched)),
        apiClientProvider.overrideWithValue(
          FakeApiClient(
            bonusStateData: (BonusKind kind) => _state(kind),
            onRollBonus: (BonusKind kind) => const BonusRollResult(
              reservationId: 'scr-1',
              prizeCoins: 7,
              attemptsRemaining: 0,
            ),
            onClaimBonus: (BonusKind kind, String reservationId) {
              claimed = reservationId == 'scr-1';
              return const BonusPlayResult(
                prizeCoins: 7,
                newBalance: 107,
                attemptsRemaining: 0,
              );
            },
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    // The scratch card (first _scratchNonce == 0) is 240x160 (12x8 cells). Snake
    // a single continuous drag across every row so well over 45% is scratched →
    // the threshold fires. A pump after each step lets the pan recognizer win.
    final Rect card = tester.getRect(find.byKey(const ValueKey<int>(0)));
    const Duration tick = Duration(milliseconds: 50);
    final TestGesture gesture =
        await tester.startGesture(card.topLeft + const Offset(10, 10));
    await tester.pump(tick);
    await gesture.moveBy(const Offset(40, 0));
    await tester.pump(tick);
    for (int row = 0; row < 8; row++) {
      final double y = card.top + 10 + row * 20;
      for (int col = 0; col < 12; col++) {
        await gesture.moveTo(Offset(card.left + 10 + col * 20, y));
        await tester.pump(tick);
      }
    }
    await gesture.up();
    await tester.pumpAndSettle();

    // The real coins are revealed on the card (not "?"), AND the claim popup is
    // up showing the same amount — proof the roll happened before the ad.
    expect(find.text('YOU WON'), findsOneWidget);
    expect(find.text('7'), findsWidgets);
    expect(find.text('Watch ad & claim'), findsOneWidget);

    await tester.tap(find.text('Watch ad & claim'));
    await tester.pumpAndSettle();
    expect(claimed, isTrue); // credited the reserved scratch prize
  });

  testWidgets('Scratch Close forfeits — reveal is re-covered, no credit',
      (tester) async {
    bool claimed = false;
    await pumpApp(
      tester,
      const BonusScreen(),
      overrides: <Override>[
        rewardedAdServiceProvider
            .overrideWithValue(FakeRewardedAdService(AdResult.watched)),
        apiClientProvider.overrideWithValue(
          FakeApiClient(
            // Still has an attempt left after this one, so the re-covered card
            // shows the "Scratch the card" prompt again.
            bonusStateData: (BonusKind kind) => _state(kind, remaining: 2),
            onRollBonus: (BonusKind kind) => const BonusRollResult(
              reservationId: 'scr-1',
              prizeCoins: 7,
              attemptsRemaining: 1,
            ),
            onClaimBonus: (BonusKind kind, String reservationId) {
              claimed = true;
              return const BonusPlayResult(
                prizeCoins: 7,
                newBalance: 107,
                attemptsRemaining: 1,
              );
            },
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    final Rect card = tester.getRect(find.byKey(const ValueKey<int>(0)));
    const Duration tick = Duration(milliseconds: 50);
    final TestGesture gesture =
        await tester.startGesture(card.topLeft + const Offset(10, 10));
    await tester.pump(tick);
    await gesture.moveBy(const Offset(40, 0));
    await tester.pump(tick);
    for (int row = 0; row < 8; row++) {
      final double y = card.top + 10 + row * 20;
      for (int col = 0; col < 12; col++) {
        await gesture.moveTo(Offset(card.left + 10 + col * 20, y));
        await tester.pump(tick);
      }
    }
    await gesture.up();
    await tester.pumpAndSettle();

    expect(find.text('Watch ad & claim'), findsOneWidget);
    await tester.tap(find.text('Close'));
    await tester.pumpAndSettle();

    expect(claimed, isFalse); // forfeit never credits
    // The reveal is re-covered — the scratch prompt is back.
    expect(find.textContaining('Scratch the card'), findsOneWidget);
  });

  testWidgets(
      'Claim button shows a loader and disables controls while the ad loads (G4)',
      (tester) async {
    final DeferredRewardedAdService ads = DeferredRewardedAdService();
    await pumpApp(
      tester,
      const BonusScreen(),
      overrides: <Override>[
        rewardedAdServiceProvider.overrideWithValue(ads),
        apiClientProvider.overrideWithValue(
          FakeApiClient(bonusStateData: (BonusKind kind) => _state(kind)),
        ),
      ],
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Spin'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Spin now'));
    await tester.pumpAndSettle();

    // Tap Claim — the ad is now pending (never resolves until we complete it).
    await tester.tap(find.text('Watch ad & claim'));
    await tester.pump();

    final Finder dialogClaim = find.descendant(
      of: find.byType(Dialog),
      matching: find.byType(PrimaryButton),
    );
    final PrimaryButton claimBtn = tester.widget<PrimaryButton>(dialogClaim);
    expect(claimBtn.loading, isTrue, reason: 'spinner shown while ad loads');
    expect(claimBtn.onPressed, isNull, reason: 'no double-tap while loading');

    final TextButton close = tester.widget<TextButton>(
      find.descendant(of: find.byType(Dialog), matching: find.byType(TextButton)),
    );
    expect(close.onPressed, isNull, reason: 'Close disabled while loading');

    // Ad completes → dialog resolves → prize reveals.
    ads.complete(AdResult.watched);
    await tester.pumpAndSettle();
    expect(find.text('YOU WON'), findsOneWidget);
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
