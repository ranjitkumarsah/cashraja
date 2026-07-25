import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Detects whether Android "Private DNS" is enabled. Some users turn it on to
/// block ads at the DNS layer — which also stops the rewarded ads the app needs
/// to credit rewards. We warn (never block) when it is ON.
///
/// The native side (MainActivity) reads
/// `Settings.Global.getString(resolver, "private_dns_mode")` over the
/// `cashraja/device` [MethodChannel] and returns one of
/// `"off" | "opportunistic" | "hostname"` (or null when unavailable).
class PrivateDnsService {
  const PrivateDnsService({this._channel = _defaultChannel});

  static const MethodChannel _defaultChannel = MethodChannel('cashraja/device');

  final MethodChannel _channel;

  /// Pure parse of the native `private_dns_mode` value. Anything other than
  /// `"off"` (case-insensitive) or null is treated as ON.
  static bool isModeOn(String? mode) {
    if (mode == null) return false;
    return mode.trim().toLowerCase() != 'off';
  }

  /// Returns true when Private DNS is enabled. Non-Android platforms and any
  /// channel failure resolve to `false` (assume off — never block or spam).
  Future<bool> isPrivateDnsOn() async {
    if (defaultTargetPlatform != TargetPlatform.android) return false;
    try {
      final String? mode =
          await _channel.invokeMethod<String>('getPrivateDnsMode');
      return isModeOn(mode);
    } catch (_) {
      return false;
    }
  }

  /// Opens the Android Private DNS settings screen so the user can turn it off.
  /// No-op (returns false) on non-Android platforms or on any channel failure.
  Future<bool> openPrivateDnsSettings() async {
    if (defaultTargetPlatform != TargetPlatform.android) return false;
    try {
      final bool? ok =
          await _channel.invokeMethod<bool>('openPrivateDnsSettings');
      return ok ?? false;
    } catch (_) {
      return false;
    }
  }
}

final privateDnsServiceProvider =
    Provider<PrivateDnsService>((Ref ref) => const PrivateDnsService());
