import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import 'core/config/app_config.dart';

/// Initializes Firebase using the platform `google-services.json`.
///
/// Failure is non-fatal in debug: the app still boots so the dev mock-auth
/// path works on machines without a Google-wired emulator. In release a hard
/// failure is rethrown.
Future<void> initFirebase() async {
  try {
    await Firebase.initializeApp();
  } catch (e) {
    if (kReleaseMode) rethrow;
    debugPrint('Firebase init skipped (dev): $e');
  }
}

/// Initializes the AdMob SDK (G1). Skipped when running with mock ads so
/// emulators/CI without Play Services don't need the native SDK. Failure is
/// non-fatal — the UI degrades gracefully (banners render nothing, rewarded
/// shows report [AdResult.noFill]).
Future<void> initMobileAds() async {
  if (AppConfig.useMockAds) return;
  try {
    await MobileAds.instance.initialize();
  } catch (e) {
    debugPrint('MobileAds init skipped: $e');
  }
}
