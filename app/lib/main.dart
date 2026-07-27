import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'bootstrap.dart';
import 'features/notifications/data/push_messaging.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations(<DeviceOrientation>[
    DeviceOrientation.portraitUp,
  ]);

  // Initialize Firebase; non-fatal in dev so the mock auth path still runs.
  await initFirebase();

  // Register the FCM background handler before the app starts (H8).
  await initPushBackgroundHandler();

  // Initialize AdMob (no-op under mock ads); non-fatal so the app always boots.
  await initMobileAds();

  runApp(const ProviderScope(child: CashRajaApp()));
}
