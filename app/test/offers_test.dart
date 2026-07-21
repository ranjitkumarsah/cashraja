import 'package:cashraja/core/api/models/offer.dart';
import 'package:cashraja/core/providers.dart';
import 'package:cashraja/features/tasks/presentation/tasks_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fakes.dart';
import 'support/harness.dart';

void main() {
  testWidgets('Tasks screen lists offers with rewards', (tester) async {
    await pumpApp(
      tester,
      const TasksScreen(),
      overrides: <Override>[
        apiClientProvider.overrideWithValue(
          FakeApiClient(offersData: const <Offer>[
            Offer(
              id: 'o1',
              network: 'mock',
              title: 'Complete a survey',
              coinReward: 500,
              description: 'Answer a few questions',
            ),
            Offer(id: 'o2', network: 'cpx', title: 'Install a game', coinReward: 1200),
          ]),
        ),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.text('Complete a survey'), findsOneWidget);
    expect(find.text('Install a game'), findsOneWidget);
    expect(find.text('+500'), findsOneWidget);
    expect(find.text('+1200'), findsOneWidget);
  });

  testWidgets('Tasks screen shows empty state when no offers', (tester) async {
    await pumpApp(
      tester,
      const TasksScreen(),
      overrides: <Override>[
        apiClientProvider.overrideWithValue(
          FakeApiClient(offersData: const <Offer>[]),
        ),
      ],
    );
    await tester.pumpAndSettle();
    expect(find.text('No offers right now'), findsOneWidget);
  });
}
