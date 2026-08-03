import 'package:flutter/services.dart';

/// Thin Dart wrapper over the native PlaytimeAds offerwall SDK (MainActivity
/// platform channel `cashraja/playtime`). Android-only; every call resolves to
/// `false` on other platforms or if the SDK is unavailable, so callers can
/// degrade gracefully. Rewards are credited server-side via the S2S postback.
class PlaytimeSdk {
  const PlaytimeSdk();

  static const MethodChannel _channel = MethodChannel('cashraja/playtime');

  /// Initialize the SDK once with the app key + user id. Safe to call repeatedly
  /// (the native side no-ops when already initialized). Returns true on success.
  Future<bool> init({required String appKey, required String userId}) async {
    try {
      final bool? ok = await _channel.invokeMethod<bool>('init', <String, String>{
        'appKey': appKey,
        'userId': userId,
      });
      return ok ?? false;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }

  /// Open the native offerwall. Returns false if the SDK isn't initialized yet.
  Future<bool> open() async {
    try {
      final bool? ok = await _channel.invokeMethod<bool>('open');
      return ok ?? false;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }
}
