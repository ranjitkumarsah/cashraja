import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'models/auth_tokens.dart';

/// Abstraction over persistent token storage so tests can inject a fake and the
/// interceptor stays platform-agnostic.
abstract class TokenStore {
  Future<String?> readAccess();
  Future<String?> readRefresh();
  Future<void> saveTokens(AuthTokens tokens);
  Future<void> updateAccess(String accessToken);
  Future<void> clear();
}

/// Encrypted, on-device token storage backed by the platform keystore/keychain.
class SecureTokenStore implements TokenStore {
  SecureTokenStore([FlutterSecureStorage? storage])
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  final FlutterSecureStorage _storage;

  static const String _kAccess = 'cr_access_token';
  static const String _kRefresh = 'cr_refresh_token';

  @override
  Future<String?> readAccess() => _storage.read(key: _kAccess);

  @override
  Future<String?> readRefresh() => _storage.read(key: _kRefresh);

  @override
  Future<void> saveTokens(AuthTokens tokens) async {
    await _storage.write(key: _kAccess, value: tokens.accessToken);
    await _storage.write(key: _kRefresh, value: tokens.refreshToken);
  }

  @override
  Future<void> updateAccess(String accessToken) =>
      _storage.write(key: _kAccess, value: accessToken);

  @override
  Future<void> clear() async {
    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
  }
}

/// In-memory store — used in tests and never persisted.
class InMemoryTokenStore implements TokenStore {
  // Private fields can't be named-parameter initializing formals.
  InMemoryTokenStore({String? access, String? refresh})
      // ignore: prefer_initializing_formals
      : _access = access,
        // ignore: prefer_initializing_formals
        _refresh = refresh;

  String? _access;
  String? _refresh;

  @override
  Future<String?> readAccess() async => _access;

  @override
  Future<String?> readRefresh() async => _refresh;

  @override
  Future<void> saveTokens(AuthTokens tokens) async {
    _access = tokens.accessToken;
    _refresh = tokens.refreshToken;
  }

  @override
  Future<void> updateAccess(String accessToken) async => _access = accessToken;

  @override
  Future<void> clear() async {
    _access = null;
    _refresh = null;
  }
}
