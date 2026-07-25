import 'package:cashraja/features/legal/legal_content.dart';
import 'package:cashraja/features/legal/presentation/policy_screen.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/harness.dart';

void main() {
  testWidgets('Privacy Policy screen renders content (no draft banner)',
      (tester) async {
    await pumpApp(
      tester,
      const PolicyScreen(
        title: 'Privacy Policy',
        content: LegalContent.privacyPolicy,
      ),
    );
    await tester.pumpAndSettle();

    // Title in the app bar.
    expect(find.text('Privacy Policy'), findsWidgets);
    // A known heading from the finalised content.
    expect(find.text('Data we collect'), findsOneWidget);
    // The draft-review banner must NOT be present (content is published).
    expect(find.textContaining('Draft pending legal review'), findsNothing);
  });

  testWidgets('policies are non-empty and use the real contact email',
      (tester) async {
    expect(LegalContent.privacyPolicy.trim().isNotEmpty, isTrue);
    expect(LegalContent.terms.trim().isNotEmpty, isTrue);
    expect(LegalContent.aboutUs.trim().isNotEmpty, isTrue);
    expect(LegalContent.contactEmail, 'support.cashraja@gmail.com');
    expect(LegalContent.privacyPolicy.contains(LegalContent.contactEmail), isTrue);
  });
}
