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

  /// Backend base URL. Defaults to the Android-emulator loopback alias that
  /// maps to the host machine's `localhost:3000`.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000/api',
  );

  /// Enables the dev-only "Dev sign-in" button (mock auth path). Only takes
  /// effect in debug builds — never surfaced in release.
  static const bool _enableDevLoginFlag = bool.fromEnvironment(
    'ENABLE_DEV_LOGIN',
    defaultValue: true,
  );

  static bool get devLoginEnabled => kDebugMode && _enableDevLoginFlag;

  /// When true, the [RewardedAdService] uses the mock driver (no real SDK).
  static const bool useMockAds = bool.fromEnvironment(
    'USE_MOCK_ADS',
    defaultValue: true,
  );
}
