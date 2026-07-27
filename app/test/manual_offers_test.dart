import 'package:cashraja/core/api/models/manual_offer.dart';
import 'package:cashraja/core/providers.dart';
import 'package:cashraja/features/tasks/presentation/manual_offers_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fakes.dart';
import 'support/harness.dart';

void main() {
  testWidgets('Offers tab shows instructions, reward, and a submit action',
      (tester) async {
    await pumpApp(
      tester,
      const ManualOffersScreen(),
      overrides: <Override>[
        apiClientProvider.overrideWithValue(
          FakeApiClient(
            manualOffersData: const <ManualOffer>[
              ManualOffer(
                id: 'o1',
                title: 'Follow us on Instagram',
                description: 'Follow @cashraja',
                instructions: 'Follow the page and keep it followed for 7 days',
                coinReward: 60,
                mySubmissionStatus: null,
              ),
            ],
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.text('Follow us on Instagram'), findsOneWidget);
    // Instructions render as Markdown (rich text), so match on contained text.
    expect(
      find.textContaining('Follow the page and keep it followed for 7 days'),
      findsOneWidget,
    );
    expect(find.text('+60'), findsOneWidget);
    expect(find.text('Submit proof'), findsOneWidget);
  });

  testWidgets('H7: instructions render Markdown; inline code taps to copy',
      (tester) async {
    // Capture Clipboard.setData writes off the platform channel.
    String? copied;
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (MethodCall call) async {
        if (call.method == 'Clipboard.setData') {
          copied = (call.arguments as Map<Object?, Object?>)['text'] as String?;
        }
        return null;
      },
    );
    addTearDown(() {
      tester.binding.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, null);
    });

    await pumpApp(
      tester,
      const ManualOffersScreen(),
      overrides: <Override>[
        apiClientProvider.overrideWithValue(
          FakeApiClient(
            manualOffersData: const <ManualOffer>[
              ManualOffer(
                id: 'o1',
                title: 'Redeem a promo',
                description: '',
                instructions:
                    'Enter code `RAJA50` at [our site](https://example.com). '
                    '**Do it today!**\n\n- step one\n- step two',
                coinReward: 60,
                mySubmissionStatus: null,
              ),
            ],
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    // Markdown is rendered (not a plain Text of the raw source).
    expect(find.byType(MarkdownBody), findsOneWidget);
    // The inline code chip is a real Text widget (tap-to-copy affordance).
    expect(find.text('RAJA50'), findsOneWidget);
    // Bold + link + list content all render as part of the rich text.
    expect(find.textContaining('Do it today!'), findsWidgets);
    expect(find.textContaining('our site'), findsWidgets);
    expect(find.textContaining('step one'), findsWidgets);

    // The inline code is a tap-to-copy chip: tapping it copies the code.
    await tester.tap(find.text('RAJA50'));
    await tester.pumpAndSettle();

    expect(copied, 'RAJA50');
    expect(find.text('Copied "RAJA50" to clipboard'), findsOneWidget);
  });

  testWidgets('An already-submitted offer shows Pending review, not a submit button',
      (tester) async {
    await pumpApp(
      tester,
      const ManualOffersScreen(),
      overrides: <Override>[
        apiClientProvider.overrideWithValue(
          FakeApiClient(
            manualOffersData: const <ManualOffer>[
              ManualOffer(
                id: 'o1',
                title: 'Join our Telegram',
                description: '',
                instructions: 'Join the channel',
                coinReward: 30,
                mySubmissionStatus: 'pending',
              ),
            ],
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.text('Pending review'), findsOneWidget);
    expect(find.text('Submit proof'), findsNothing);
  });

  testWidgets('Submitting proof calls the API and shows the pending snackbar',
      (tester) async {
    String? capturedProof;
    await pumpApp(
      tester,
      const ManualOffersScreen(),
      overrides: <Override>[
        apiClientProvider.overrideWithValue(
          FakeApiClient(
            manualOffersData: const <ManualOffer>[
              ManualOffer(
                id: 'o1',
                title: 'Watch our launch video',
                description: '',
                instructions: 'Watch to the end',
                coinReward: 20,
                mySubmissionStatus: null,
              ),
            ],
            onSubmitManualOfferProof: (String offerId, String proof) {
              capturedProof = proof;
              return ManualOfferSubmission(
                id: 's1',
                offerId: offerId,
                offerTitle: 'Watch our launch video',
                coinReward: 20,
                proofText: proof,
                status: 'pending',
                reviewReason: null,
                createdAt: DateTime(2026, 7, 25),
                reviewedAt: null,
              );
            },
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Submit proof'));
    await tester.pumpAndSettle();

    // Proof sheet is open.
    expect(find.text('Submit for review'), findsOneWidget);
    await tester.enterText(
      find.byType(TextFormField),
      'I watched the whole video, username raja123',
    );
    await tester.tap(find.text('Submit for review'));
    await tester.pumpAndSettle();

    expect(capturedProof, 'I watched the whole video, username raja123');
    expect(find.text('Proof submitted — pending review.'), findsOneWidget);
  });

  testWidgets('My submissions tab shows status and a rejection reason',
      (tester) async {
    await pumpApp(
      tester,
      const ManualOffersScreen(),
      overrides: <Override>[
        apiClientProvider.overrideWithValue(
          FakeApiClient(
            myManualOfferSubmissionsData: <ManualOfferSubmission>[
              ManualOfferSubmission(
                id: 's1',
                offerId: 'o1',
                offerTitle: 'Follow us on X',
                coinReward: 50,
                proofText: 'done it',
                status: 'rejected',
                reviewReason: 'Screenshot is unreadable',
                createdAt: DateTime(2026, 7, 20),
                reviewedAt: DateTime(2026, 7, 21),
              ),
            ],
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    // Move to the "My submissions" tab.
    await tester.tap(find.text('My submissions'));
    await tester.pumpAndSettle();

    expect(find.text('Follow us on X'), findsOneWidget);
    expect(find.text('Rejected'), findsOneWidget);
    expect(find.text('Reason: Screenshot is unreadable'), findsOneWidget);
  });
}
