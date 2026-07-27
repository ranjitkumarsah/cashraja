import 'package:cashraja/core/device/private_dns_service.dart';
import 'package:cashraja/core/providers.dart';
import 'package:cashraja/features/home/presentation/home_shell.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fakes.dart';
import 'support/harness.dart';

/// A [PrivateDnsService] that reports OFF so the shell never shows the blocking
/// DNS dialog during these tests.
class _OffDnsService extends PrivateDnsService {
  const _OffDnsService();

  @override
  Future<bool> isPrivateDnsOn() async => false;
}

void main() {
  // HomeShell hosts always-animating widgets (e.g. the streak flame), so the
  // tree never "settles" — pump fixed frames instead of pumpAndSettle.
  Future<void> pumpHome(WidgetTester tester) async {
    await pumpApp(
      tester,
      const HomeShell(),
      overrides: <Override>[
        apiClientProvider.overrideWithValue(FakeApiClient()),
        privateDnsServiceProvider.overrideWithValue(const _OffDnsService()),
      ],
    );
    // Let initState's post-frame callbacks and the FakeApiClient futures run.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
  }

  List<MethodCall> capturePlatform(WidgetTester tester) {
    final List<MethodCall> calls = <MethodCall>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (MethodCall call) async {
        calls.add(call);
        return null;
      },
    );
    addTearDown(() {
      tester.binding.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, null);
    });
    return calls;
  }

  bool exitedApp(List<MethodCall> calls) =>
      calls.any((MethodCall c) => c.method == 'SystemNavigator.pop');

  testWidgets('Home tab: first back shows exit prompt, second back exits',
      (tester) async {
    final List<MethodCall> platformCalls = capturePlatform(tester);
    await pumpHome(tester);

    // First back → prompt snackbar, app does NOT exit.
    await tester.binding.handlePopRoute();
    await tester.pump();
    expect(find.text('Press back again to exit'), findsOneWidget);
    expect(exitedApp(platformCalls), isFalse);

    // Second back within the window → exits via SystemNavigator.pop.
    await tester.binding.handlePopRoute();
    await tester.pump();
    expect(exitedApp(platformCalls), isTrue);
  });

  testWidgets('Back from a non-Home tab returns to Home instead of exiting',
      (tester) async {
    final List<MethodCall> platformCalls = capturePlatform(tester);
    await pumpHome(tester);

    // Switch to the Profile tab via its bottom-nav icon (unambiguous).
    await tester.tap(find.byIcon(Icons.person_rounded));
    await tester.pump();

    // Back returns to the Home tab: no exit, no prompt.
    await tester.binding.handlePopRoute();
    await tester.pump();
    expect(find.text('Press back again to exit'), findsNothing);
    expect(exitedApp(platformCalls), isFalse);

    // Now on Home, the first back shows the exit prompt (still no exit).
    await tester.binding.handlePopRoute();
    await tester.pump();
    expect(find.text('Press back again to exit'), findsOneWidget);
    expect(exitedApp(platformCalls), isFalse);
  });
}
