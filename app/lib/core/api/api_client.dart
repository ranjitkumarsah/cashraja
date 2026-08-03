import 'package:dio/dio.dart';

import '../config/app_config.dart';
import 'api_exception.dart';
import 'auth_interceptor.dart';
import 'models/ad_reward.dart';
import 'models/auth_tokens.dart';
import 'models/bonus.dart';
import 'models/feedback.dart';
import 'models/game.dart';
import 'models/gift_card.dart';
import 'models/manual_offer.dart';
import 'models/notification.dart';
import 'models/offer.dart';
import 'models/offer_wall.dart';
import 'models/redemption.dart';
import 'models/referral.dart';
import 'models/streak.dart';
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
      // Generous timeouts: a free-tier host can cold-start (~30-50s) after
      // idling. Short timeouts here would surface as "server unreachable" and,
      // at startup, wrongly look like an expired session.
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 60),
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

  /// Step 1: exchange the Google/Firebase ID token for an app session. No
  /// referral here — attestation (with the optional referral) is a separate,
  /// session-authenticated step. The response's `user.needs_attestation` tells
  /// the app whether the 18+ DOB attestation is still required.
  Future<LoginResult> googleLogin({
    required String idToken,
    required String deviceFingerprint,
  }) async {
    final Map<String, dynamic> data = <String, dynamic>{
      'id_token': idToken,
      'device_fingerprint': deviceFingerprint,
    };
    final Map<String, dynamic> body = await _post(
      '/auth/google',
      data: data,
      skipAuth: true,
    );
    return LoginResult.fromJson(body);
  }

  /// Step 2 (session-authenticated): server-authoritative 18+ attestation.
  /// Persists the DOB and applies the optional referral for a new user; the
  /// server enforces 18+ regardless of the client-side check.
  Future<AuthUser> attest({
    required DateTime dateOfBirth,
    String? referralCode,
  }) async {
    final String isoDate =
        dateOfBirth.toIso8601String().split('T').first; // YYYY-MM-DD
    final Map<String, dynamic> body = await _post(
      '/auth/attest',
      data: <String, dynamic>{
        'date_of_birth': isoDate,
        if (referralCode != null && referralCode.isNotEmpty)
          'referral_code': referralCode,
      },
    );
    final Object? user = body['user'];
    return AuthUser.fromJson(
      user is Map<String, dynamic> ? user : body,
    );
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

  /// PlaytimeAds config: whether the offerwall is enabled + the SDK app key.
  Future<PlaytimeConfig> playtimeConfig() async {
    final Map<String, dynamic> body = await _get('/playtime/config');
    return PlaytimeConfig.fromJson(body);
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

  Future<ReferralBreakdown> referralBreakdown() async {
    final Map<String, dynamic> body = await _get('/referral/breakdown');
    return ReferralBreakdown.fromJson(body);
  }

  // ---- Manual offers (H5) -----------------------------------------------

  Future<List<ManualOffer>> manualOffers() async {
    final List<dynamic> body = await _getList('/manual-offers');
    return body
        .map((dynamic e) => ManualOffer.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<List<ManualOfferSubmission>> myManualOfferSubmissions() async {
    final List<dynamic> body = await _getList('/manual-offers/mine');
    return body
        .map((dynamic e) =>
            ManualOfferSubmission.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<ManualOfferSubmission> submitManualOfferProof(
    String offerId,
    String proofText,
  ) async {
    final Map<String, dynamic> body = await _post(
      '/manual-offers/$offerId/submit',
      data: <String, dynamic>{'proof_text': proofText},
    );
    return ManualOfferSubmission.fromJson(body);
  }

  // ---- Feedback / complaints (H4) ---------------------------------------

  Future<FeedbackEntry> submitFeedback({
    required FeedbackType type,
    required String subject,
    required String message,
  }) async {
    final Map<String, dynamic> body = await _post(
      '/feedback',
      data: <String, dynamic>{
        'type': type.wire,
        'subject': subject,
        'message': message,
      },
    );
    return FeedbackEntry.fromJson(body);
  }

  Future<List<FeedbackEntry>> myFeedback() async {
    final List<dynamic> body = await _getList('/feedback/mine');
    return body
        .map((dynamic e) => FeedbackEntry.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
  }

  // ---- Game (D1) ---------------------------------------------------------

  /// H9 — coins-per-round per difficulty, so the picker reflects admin config.
  Future<GameConfig> gameConfig() async {
    final Map<String, dynamic> body = await _get('/game/config');
    return GameConfig.fromJson(body);
  }

  Future<GameRound> startGameRound(GameDifficulty difficulty) async {
    final Map<String, dynamic> body = await _post(
      '/game/round-start',
      data: <String, dynamic>{'difficulty': difficulty.wire},
    );
    return GameRound.fromJson(body);
  }

  Future<RoundResult> completeGameRound(
    String roundId, {
    required int clientScore,
  }) async {
    final Map<String, dynamic> body = await _post(
      '/game/round-complete',
      data: <String, dynamic>{
        'round_id': roundId,
        'client_score': clientScore,
      },
    );
    return RoundResult.fromJson(body);
  }

  // ---- Streak (D2) -------------------------------------------------------

  Future<StreakState> streak() async {
    final Map<String, dynamic> body = await _get('/streak');
    return StreakState.fromJson(body);
  }

  Future<StreakClaimResult> claimStreak() async {
    final Map<String, dynamic> body = await _post('/streak/claim');
    return StreakClaimResult.fromJson(body);
  }

  // ---- Scratch / Spin bonus (D3) -----------------------------------------

  Future<BonusState> bonusState(BonusKind kind) async {
    final Map<String, dynamic> body = await _get('/bonus/${kind.wire}');
    return BonusState.fromJson(body, kind);
  }

  Future<BonusPlayResult> playBonus(BonusKind kind) async {
    final Map<String, dynamic> body = await _post('/bonus/${kind.wire}/play');
    return BonusPlayResult.fromJson(body);
  }

  /// Step 1 (roll): reserve + reveal the server-picked prize WITHOUT crediting,
  /// so the client can reveal it (scratch card / wheel) before the ad. Credit
  /// happens later via [claimBonus]. Shared by scratch and spin.
  Future<BonusRollResult> rollBonus(BonusKind kind) async {
    final Map<String, dynamic> body = await _post('/bonus/${kind.wire}/roll');
    return BonusRollResult.fromJson(body);
  }

  /// Step 2 (claim): credit the reserved prize after the rewarded ad completes.
  Future<BonusPlayResult> claimBonus(BonusKind kind, String reservationId) async {
    final Map<String, dynamic> body = await _post(
      '/bonus/${kind.wire}/claim',
      data: <String, dynamic>{'reservation_id': reservationId},
    );
    return BonusPlayResult.fromJson(body);
  }

  // ---- Notifications inbox + FCM token (H8) ------------------------------

  /// Keyset-paginated in-app inbox with the total unread count.
  Future<NotificationPage> notifications({String? cursor, int limit = 20}) async {
    final Map<String, dynamic> body = await _get(
      '/notifications',
      query: <String, dynamic>{
        'cursor': ?cursor,
        'limit': limit,
      },
    );
    return NotificationPage.fromJson(body);
  }

  /// Register (upsert) this device's FCM push token. Returns 204; body ignored.
  Future<void> registerFcmToken(String token) async {
    await _post(
      '/notifications/register-token',
      data: <String, dynamic>{'token': token},
    );
  }

  /// Mark a single inbox notification read (owner-scoped, idempotent).
  Future<void> markNotificationRead(String id) async {
    await _post('/notifications/$id/read');
  }

  // ---- Watch-ads reward (G7) ---------------------------------------------

  Future<AdRewardState> adRewardState() async {
    final Map<String, dynamic> body = await _get('/ads/reward-state');
    return AdRewardState.fromJson(body);
  }

  Future<AdRewardResult> claimAdReward() async {
    final Map<String, dynamic> body = await _post('/ads/reward');
    return AdRewardResult.fromJson(body);
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
