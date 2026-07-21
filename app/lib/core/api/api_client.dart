import 'package:dio/dio.dart';

import '../config/app_config.dart';
import 'api_exception.dart';
import 'auth_interceptor.dart';
import 'models/auth_tokens.dart';
import 'models/gift_card.dart';
import 'models/offer.dart';
import 'models/redemption.dart';
import 'models/referral.dart';
import 'models/user.dart';
import 'models/wallet.dart';
import 'token_store.dart';

/// Typed client mirroring the committed backend contracts. All wire fields are
/// snake_case; DTOs live under `models/`. Structured so it can later be
/// regenerated from an OpenAPI spec (one method per endpoint).
class ApiClient {
  ApiClient({
    required TokenStore store,
    required Future<void> Function() onSessionExpired,
    Dio? dio,
    String? baseUrl,
  }) {
    final String base = baseUrl ?? AppConfig.apiBaseUrl;
    final BaseOptions options = BaseOptions(
      baseUrl: base,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 20),
      contentType: Headers.jsonContentType,
    );

    _dio = dio ?? Dio(options);
    if (dio == null) {
      // A bare Dio for the refresh call + retries (no auth interceptor).
      final Dio refreshDio = Dio(options);
      _dio.interceptors.add(
        AuthInterceptor(
          store: store,
          refreshDio: refreshDio,
          onSessionExpired: onSessionExpired,
        ),
      );
    }
  }

  late final Dio _dio;

  Dio get dio => _dio;

  // ---- Auth (no bearer token) -------------------------------------------

  Future<LoginResult> googleLogin({
    required String idToken,
    required String deviceFingerprint,
    String? referralCode,
  }) async {
    final Map<String, dynamic> data = <String, dynamic>{
      'id_token': idToken,
      'device_fingerprint': deviceFingerprint,
      if (referralCode != null && referralCode.isNotEmpty)
        'referral_code': referralCode,
    };
    final Map<String, dynamic> body = await _post(
      '/auth/google',
      data: data,
      skipAuth: true,
    );
    return LoginResult.fromJson(body);
  }

  Future<AuthTokens> refresh(String refreshToken) async {
    final Map<String, dynamic> body = await _post(
      '/auth/refresh',
      data: <String, dynamic>{'refresh_token': refreshToken},
      skipAuth: true,
    );
    return AuthTokens.fromJson(body);
  }

  // ---- Profile -----------------------------------------------------------

  Future<MeProfile> me() async {
    final Map<String, dynamic> body = await _get('/me');
    return MeProfile.fromJson(body);
  }

  Future<Map<String, dynamic>> deleteAccount() async {
    return _delete('/account');
  }

  // ---- Wallet ------------------------------------------------------------

  Future<WalletSummary> wallet() async {
    final Map<String, dynamic> body = await _get('/wallet');
    return WalletSummary.fromJson(body);
  }

  Future<LedgerPage> ledger({String? cursor, int limit = 20}) async {
    final Map<String, dynamic> body = await _get(
      '/wallet/ledger',
      query: <String, dynamic>{
        'cursor': ?cursor,
        'limit': limit,
      },
    );
    return LedgerPage.fromJson(body);
  }

  // ---- Offers ------------------------------------------------------------

  Future<List<Offer>> offers() async {
    final List<dynamic> body = await _getList('/offers');
    return body
        .map((dynamic e) => Offer.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<OfferLaunch> launchOffer(String offerId) async {
    final Map<String, dynamic> body = await _post('/offers/$offerId/launch');
    return OfferLaunch.fromJson(body);
  }

  // ---- Gift cards + redemptions -----------------------------------------

  Future<List<GiftCard>> giftCards() async {
    final List<dynamic> body = await _getList('/gift-cards');
    return body
        .map((dynamic e) => GiftCard.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<Redemption> createRedemption(String giftCardId) async {
    final Map<String, dynamic> body = await _post(
      '/redemptions',
      data: <String, dynamic>{'gift_card_id': giftCardId},
    );
    return Redemption.fromJson(body);
  }

  Future<List<Redemption>> myRedemptions() async {
    final List<dynamic> body = await _getList('/redemptions/mine');
    return body
        .map((dynamic e) => Redemption.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
  }

  // ---- Referral ----------------------------------------------------------

  Future<ReferralCode> referralCode() async {
    final Map<String, dynamic> body = await _get('/referral/my-code');
    return ReferralCode.fromJson(body);
  }

  Future<ReferralStats> referralStats() async {
    final Map<String, dynamic> body = await _get('/referral/stats');
    return ReferralStats.fromJson(body);
  }

  // ---- Low-level helpers -------------------------------------------------

  Future<Map<String, dynamic>> _get(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    try {
      final Response<dynamic> res = await _dio.get<dynamic>(
        path,
        queryParameters: query,
      );
      return _asMap(res.data);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<dynamic>> _getList(String path) async {
    try {
      final Response<dynamic> res = await _dio.get<dynamic>(path);
      return (res.data as List<dynamic>?) ?? <dynamic>[];
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Map<String, dynamic>> _post(
    String path, {
    Object? data,
    bool skipAuth = false,
  }) async {
    try {
      final Response<dynamic> res = await _dio.post<dynamic>(
        path,
        data: data,
        options: Options(extra: <String, dynamic>{'skipAuth': skipAuth}),
      );
      return _asMap(res.data);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Map<String, dynamic>> _delete(String path) async {
    try {
      final Response<dynamic> res = await _dio.delete<dynamic>(path);
      return _asMap(res.data);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  static Map<String, dynamic> _asMap(dynamic data) {
    if (data is Map<String, dynamic>) return data;
    return <String, dynamic>{};
  }
}
