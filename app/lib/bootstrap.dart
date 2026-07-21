import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

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
