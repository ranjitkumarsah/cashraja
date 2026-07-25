import 'package:cashraja/core/api/models/feedback.dart';
import 'package:cashraja/core/providers.dart';
import 'package:cashraja/features/feedback/presentation/feedback_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fakes.dart';
import 'support/harness.dart';

void main() {
  testWidgets('shows existing submissions with status and admin reply',
      (tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 2400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await pumpApp(
      tester,
      const FeedbackScreen(),
      overrides: <Override>[
        apiClientProvider.overrideWithValue(
          FakeApiClient(
            myFeedbackData: <FeedbackEntry>[
              FeedbackEntry(
                id: 'f1',
                type: FeedbackType.complaint,
                subject: 'Coins missing',
                message: 'My offer did not credit.',
                status: 'resolved',
                adminReply: 'Sorted — credited now.',
                createdAt: DateTime(2026, 7, 20),
                resolvedAt: DateTime(2026, 7, 21),
              ),
            ],
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.text('Coins missing'), findsOneWidget);
    expect(find.text('Resolved'), findsOneWidget);
    expect(find.text('Sorted — credited now.'), findsOneWidget);
  });

  testWidgets('submits feedback and shows a success message', (tester) async {
    FeedbackType? sentType;
    String? sentSubject;

    await pumpApp(
      tester,
      const FeedbackScreen(),
      overrides: <Override>[
        apiClientProvider.overrideWithValue(
          FakeApiClient(
            myFeedbackData: const <FeedbackEntry>[],
            onSubmitFeedback:
                (FeedbackType type, String subject, String message) {
              sentType = type;
              sentSubject = subject;
              return FeedbackEntry(
                id: 'new',
                type: type,
                subject: subject,
                message: message,
                status: 'open',
                adminReply: null,
                createdAt: DateTime(2026, 7, 25),
                resolvedAt: null,
              );
            },
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    // Choose "Complaint", fill the form, submit.
    await tester.tap(find.text('Complaint'));
    await tester.pump();
    await tester.enterText(find.byType(TextFormField).at(0), 'Bug report');
    await tester.enterText(
        find.byType(TextFormField).at(1), 'Something went wrong here.');
    await tester.tap(find.text('Send'));
    await tester.pumpAndSettle();

    expect(sentType, FeedbackType.complaint);
    expect(sentSubject, 'Bug report');
    expect(find.text('Thanks! Your message has been sent.'), findsOneWidget);
  });
}
