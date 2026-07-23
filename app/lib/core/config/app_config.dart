import 'package:flutter/foundation.dart';

/// Compile-time configuration, supplied via `--dart-define`.
///
/// Example:
/// ```
/// flutter run \
///   --dart-define=API_BASE_URL=http://10.0.2.2:3000/api \
///   --dart-define=ENABLE_DEV_LOGIN=true
/// ```
class AppConfig {
  const AppConfig._();

  /// Backend base URL. Defaults to `localhost:3000`, which works on both
  /// physical devices and emulators when the dev tunnel is active
  /// (`adb reverse tcp:3000 tcp:3000`). Override per environment via
  /// `--dart-define=API_BASE_URL=...` (e.g. a LAN IP or a deployed host).
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000/api',
  );

  /// Enables the dev-only "Dev sign-in" button (mock auth path). Only takes
  /// effect in debug builds — never surfaced in release.
  static const bool _enableDevLoginFlag = bool.fromEnvironment(
    'ENABLE_DEV_LOGIN',
    defaultValue: true,
  );

  static bool get devLoginEnabled => kDebugMode && _enableDevLoginFlag;

  /// When true, the [RewardedAdService] uses the mock driver (no real SDK).
  /// Default true so tests and emulators without Play Services keep working;
  /// set `--dart-define=USE_MOCK_ADS=false` (with real/test ad ids) to exercise
  /// the real AdMob path.
  static const bool useMockAds = bool.fromEnvironment(
    'USE_MOCK_ADS',
    defaultValue: true,
  );

  // ── AdMob unit ids ─────────────────────────────────────────────────────────
  // Dev defaults are Google's official SAMPLE unit ids (always fill, never earn
  // real revenue). Release supplies the real ids via --dart-define. The AdMob
  // *App ID* is native (AndroidManifest) — see the `admobAppId` manifest
  // placeholder in android/app/build.gradle.kts.

  /// Rewarded unit. Dev = Google test rewarded id.
  static const String admobRewardedId = String.fromEnvironment(
    'ADMOB_REWARDED_ID',
    defaultValue: 'ca-app-pub-3940256099942544/5224354917',
  );

  /// Banner unit. Dev = Google test banner id.
  static const String admobBannerId = String.fromEnvironment(
    'ADMOB_BANNER_ID',
    defaultValue: 'ca-app-pub-3940256099942544/6300978111',
  );
}
