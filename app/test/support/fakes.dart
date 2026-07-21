import 'package:cashraja/core/api/api_client.dart';
import 'package:cashraja/core/api/models/auth_tokens.dart';
import 'package:cashraja/core/api/models/gift_card.dart';
import 'package:cashraja/core/api/models/offer.dart';
import 'package:cashraja/core/api/models/redemption.dart';
import 'package:cashraja/core/api/models/referral.dart';
import 'package:cashraja/core/api/models/user.dart';
import 'package:cashraja/core/api/models/wallet.dart';
import 'package:cashraja/core/api/token_store.dart';
import 'package:cashraja/core/device/device_id.dart';
import 'package:dio/dio.dart';

/// A hand-built [ApiClient] returning canned data. Methods can be overridden
/// per-test via the constructor callbacks.
class FakeApiClient extends ApiClient {
  FakeApiClient({
    this.walletData,
    this.ledgerData,
    this.offersData,
    this.giftCardsData,
    this.redemptionsData,
    this.meData,
    this.onLogin,
    this.onRedeem,
  }) : super(
          store: InMemoryTokenStore(),
          onSessionExpired: _noop,
          dio: Dio(),
        );

  static Future<void> _noop() async {}

  final WalletSummary? walletData;
  final LedgerPage? ledgerData;
  final List<Offer>? offersData;
  final List<GiftCard>? giftCardsData;
  final List<Redemption>? redemptionsData;
  final MeProfile? meData;
  final LoginResult Function()? onLogin;
  final Redemption Function(String giftCardId)? onRedeem;

  @override
  Future<WalletSummary> wallet() async =>
      walletData ??
      const WalletSummary(
        coinBalance: 0,
        pendingOfferCredits: 0,
        recentEntries: <LedgerEntry>[],
      );

  @override
  Future<LedgerPage> ledger({String? cursor, int limit = 20}) async =>
      ledgerData ?? const LedgerPage(entries: <LedgerEntry>[], nextCursor: null);

  @override
  Future<List<Offer>> offers() async => offersData ?? <Offer>[];

  @override
  Future<OfferLaunch> launchOffer(String offerId) async =>
      const OfferLaunch(launchUrl: 'https://example.test/o', expiresInSeconds: 900);

  @override
  Future<List<GiftCard>> giftCards() async => giftCardsData ?? <GiftCard>[];

  @override
  Future<List<Redemption>> myRedemptions() async =>
      redemptionsData ?? <Redemption>[];

  @override
  Future<Redemption> createRedemption(String giftCardId) async {
    if (onRedeem != null) return onRedeem!(giftCardId);
    throw UnimplementedError();
  }

  @override
  Future<MeProfile> me() async =>
      meData ??
      MeProfile(
        id: 'u1',
        email: 'dev@cashraja.local',
        displayName: 'Dev User',
        status: 'active',
        referralCode: 'RAJA1234',
        createdAt: DateTime(2026, 1, 1),
      );

  @override
  Future<Map<String, dynamic>> deleteAccount() async =>
      <String, dynamic>{'deleted': true, 'user_id': 'u1'};

  @override
  Future<LoginResult> googleLogin({
    required String idToken,
    required String deviceFingerprint,
    String? referralCode,
  }) async {
    if (onLogin != null) return onLogin!();
    return const LoginResult(
      tokens: AuthTokens(accessToken: 'a', refreshToken: 'r'),
      user: AuthUser(
        id: 'u1',
        displayName: 'Dev User',
        email: 'dev@cashraja.local',
        coinBalance: 100,
        referralCode: 'RAJA1234',
      ),
    );
  }

  @override
  Future<AuthTokens> refresh(String refreshToken) async =>
      const AuthTokens(accessToken: 'a2', refreshToken: 'r2');

  @override
  Future<ReferralCode> referralCode() async =>
      const ReferralCode(code: 'RAJA1234');

  @override
  Future<ReferralStats> referralStats() async => const ReferralStats(
        code: 'RAJA1234',
        referredCount: 0,
        activeReferrals: 0,
        totalEarned: 0,
      );
}

/// Device id that never touches secure storage.
class FakeDeviceId extends DeviceId {
  @override
  Future<String> get() async => 'test-device-000000000000';
}
