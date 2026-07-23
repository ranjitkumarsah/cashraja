import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'bootstrap.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations(<DeviceOrientation>[
    DeviceOrientation.portraitUp,
  ]);

  // Initialize Firebase; non-fatal in dev so the mock auth path still runs.
  await initFirebase();

  // Initialize AdMob (no-op under mock ads); non-fatal so the app always boots.
  await initMobileAds();

  runApp(const ProviderScope(child: CashRajaApp()));
}
