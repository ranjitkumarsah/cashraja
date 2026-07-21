import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Provides a stable per-install device fingerprint, generated once and kept in
/// secure storage. Sent to the backend as `device_fingerprint` at login (used
/// for multi-account fraud checks server-side).
class DeviceId {
  DeviceId([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  static const String _key = 'cr_device_id';

  String? _cached;

  Future<String> get() async {
    if (_cached != null) return _cached!;
    final String? existing = await _storage.read(key: _key);
    if (existing != null && existing.length >= 8) {
      _cached = existing;
      return existing;
    }
    final String generated = _random();
    await _storage.write(key: _key, value: generated);
    _cached = generated;
    return generated;
  }

  static String _random() {
    final Random rng = Random.secure();
    final StringBuffer sb = StringBuffer();
    for (int i = 0; i < 32; i++) {
      sb.write(rng.nextInt(16).toRadixString(16));
    }
    return sb.toString();
  }
}
