import 'package:cashraja/core/device/private_dns_service.dart';
import 'package:cashraja/features/home/presentation/home_shell.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('PrivateDnsService.isModeOn', () {
    test('null and "off" are OFF', () {
      expect(PrivateDnsService.isModeOn(null), isFalse);
      expect(PrivateDnsService.isModeOn('off'), isFalse);
      expect(PrivateDnsService.isModeOn('OFF'), isFalse);
      expect(PrivateDnsService.isModeOn(' off '), isFalse);
    });

    test('opportunistic and hostname are ON', () {
      expect(PrivateDnsService.isModeOn('opportunistic'), isTrue);
      expect(PrivateDnsService.isModeOn('hostname'), isTrue);
    });
  });

  group('PrivateDnsService.isPrivateDnsOn (via channel)', () {
    const MethodChannel channel = MethodChannel('cashraja/device');

    void mockMode(String? mode) {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        if (call.method == 'getPrivateDnsMode') return mode;
        return null;
      });
    }

    tearDown(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, null);
      debugDefaultTargetPlatformOverride = null;
    });

    test('reads "hostname" from native → ON on Android', () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      mockMode('hostname');
      expect(await const PrivateDnsService().isPrivateDnsOn(), isTrue);
    });

    test('reads "off" from native → OFF on Android', () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      mockMode('off');
      expect(await const PrivateDnsService().isPrivateDnsOn(), isFalse);
    });

    test('non-Android platforms never call the channel and assume OFF',
        () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      bool called = false;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        called = true;
        return 'hostname';
      });
      expect(await const PrivateDnsService().isPrivateDnsOn(), isFalse);
      expect(called, isFalse);
    });

    test('a channel error is swallowed and assumed OFF', () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        throw PlatformException(code: 'boom');
      });
      expect(await const PrivateDnsService().isPrivateDnsOn(), isFalse);
    });
  });

  group('PrivateDnsBlockDialog (blocking gate)', () {
    const MethodChannel channel = MethodChannel('cashraja/device');

    tearDown(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, null);
      debugDefaultTargetPlatformOverride = null;
    });

    testWidgets(
        'stays up while Private DNS is on, and dismisses once re-check finds it '
        'off (Issue 5)', (tester) async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      String mode = 'hostname'; // starts ON
      bool openedSettings = false;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        switch (call.method) {
          case 'getPrivateDnsMode':
            return mode;
          case 'openPrivateDnsSettings':
            openedSettings = true;
            return true;
        }
        return null;
      });

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (BuildContext ctx) => ElevatedButton(
                onPressed: () => showDialog<void>(
                  context: ctx,
                  barrierDismissible: false,
                  builder: (_) =>
                      const PrivateDnsBlockDialog(service: PrivateDnsService()),
                ),
                child: const Text('open'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();

      // Blocking dialog is up.
      expect(find.text('Turn off Private DNS'), findsOneWidget);

      // Open Settings routes to the native settings screen.
      await tester.tap(find.text('Open Settings'));
      await tester.pumpAndSettle();
      expect(openedSettings, isTrue);

      // Re-check while still ON keeps the dialog and warns.
      await tester.tap(find.text("I've turned it off — Re-check"));
      await tester.pumpAndSettle();
      expect(find.text('Turn off Private DNS'), findsOneWidget);
      expect(find.textContaining('still on'), findsOneWidget);

      // Turn it off, then re-check → dialog dismisses, app continues.
      mode = 'off';
      await tester.tap(find.text("I've turned it off — Re-check"));
      await tester.pumpAndSettle();
      expect(find.text('Turn off Private DNS'), findsNothing);

      // Reset the platform override within the test body (testWidgets verifies
      // foundation debug vars are unset before tearDown runs).
      debugDefaultTargetPlatformOverride = null;
    });
  });
}
