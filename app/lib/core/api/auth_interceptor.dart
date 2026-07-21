import 'package:dio/dio.dart';

import 'models/auth_tokens.dart';
import 'token_store.dart';

/// Attaches the access JWT to every request, and on a 401 transparently
/// refreshes the token (honouring refresh-token rotation) and retries once.
///
/// Refresh is serialized: concurrent 401s wait on the same refresh future so we
/// never fire multiple `/auth/refresh` calls (which would trip reuse-detection
/// and revoke the whole token chain).
class AuthInterceptor extends QueuedInterceptor {
  // Private fields can't be named-parameter initializing formals, so assign in
  // the initializer list.
  // ignore_for_file: prefer_initializing_formals
  AuthInterceptor({
    required TokenStore store,
    required Dio refreshDio,
    required Future<void> Function() onSessionExpired,
  })  : _store = store,
        _refreshDio = refreshDio,
        _onSessionExpired = onSessionExpired;

  final TokenStore _store;

  /// A bare Dio (no interceptors) used only to hit `/auth/refresh`, avoiding
  /// recursion into this interceptor.
  final Dio _refreshDio;

  final Future<void> Function() _onSessionExpired;

  static const String _retriedFlag = 'cr_retried';

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (options.extra['skipAuth'] != true) {
      final String? access = await _store.readAccess();
      if (access != null && access.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $access';
      }
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final RequestOptions request = err.requestOptions;
    final bool is401 = err.response?.statusCode == 401;
    final bool alreadyRetried = request.extra[_retriedFlag] == true;
    final bool skipAuth = request.extra['skipAuth'] == true;

    if (!is401 || alreadyRetried || skipAuth) {
      return handler.next(err);
    }

    final String? refresh = await _store.readRefresh();
    if (refresh == null || refresh.isEmpty) {
      await _onSessionExpired();
      return handler.next(err);
    }

    try {
      final Response<dynamic> res = await _refreshDio.post<dynamic>(
        '/auth/refresh',
        data: <String, dynamic>{'refresh_token': refresh},
      );
      final Map<String, dynamic> body = res.data as Map<String, dynamic>;
      final String newAccess = body['access_token'] as String;
      final String? newRefresh = body['refresh_token'] as String?;

      // Persist rotated tokens.
      if (newRefresh != null && newRefresh.isNotEmpty) {
        await _store.saveTokens(
          AuthTokens(accessToken: newAccess, refreshToken: newRefresh),
        );
      } else {
        await _store.updateAccess(newAccess);
      }

      // Retry the original request once with the fresh access token.
      request.extra[_retriedFlag] = true;
      request.headers['Authorization'] = 'Bearer $newAccess';
      final Response<dynamic> retried = await _refreshDio.fetch<dynamic>(request);
      return handler.resolve(retried);
    } on DioException catch (_) {
      // Refresh failed (expired/rotated/reused) → session is dead.
      await _store.clear();
      await _onSessionExpired();
      return handler.next(err);
    }
  }
}
