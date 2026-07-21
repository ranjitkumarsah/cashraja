import 'package:cashraja/core/api/api_client.dart';
import 'package:cashraja/core/api/models/auth_tokens.dart';
import 'package:cashraja/core/api/models/bonus.dart';
import 'package:cashraja/core/api/models/game.dart';
import 'package:cashraja/core/api/models/gift_card.dart';
import 'package:cashraja/core/api/models/offer.dart';
import 'package:cashraja/core/api/models/redemption.dart';
import 'package:cashraja/core/api/models/referral.dart';
import 'package:cashraja/core/api/models/streak.dart';
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
    this.referralCodeData,
    this.referralStatsData,
    this.streakData,
    this.onClaimStreak,
    this.onStartRound,
    this.onCompleteRound,
    this.bonusStateData,
    this.onPlayBonus,
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
  final ReferralCode? referralCodeData;
  final ReferralStats? referralStatsData;
  final StreakState? streakData;
  final StreakClaimResult Function()? onClaimStreak;
  final GameRound Function(GameDifficulty difficulty)? onStartRound;
  final RoundResult Function(String roundId)? onCompleteRound;
  final BonusState Function(BonusKind kind)? bonusStateData;
  final BonusPlayResult Function(BonusKind kind)? onPlayBonus;

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
      referralCodeData ?? const ReferralCode(code: 'RAJA1234');

  @override
  Future<ReferralStats> referralStats() async =>
      referralStatsData ??
      const ReferralStats(
        code: 'RAJA1234',
        referredCount: 0,
        activeReferrals: 0,
        totalEarned: 0,
      );

  @override
  Future<StreakState> streak() async =>
      streakData ??
      const StreakState(
        currentCount: 0,
        claimableToday: true,
        nextBonus: 5,
      );

  @override
  Future<StreakClaimResult> claimStreak() async {
    if (onClaimStreak != null) return onClaimStreak!();
    return const StreakClaimResult(
      streakCount: 1,
      coinsEarned: 5,
      newBalance: 105,
    );
  }

  @override
  Future<GameRound> startGameRound(GameDifficulty difficulty) async {
    if (onStartRound != null) return onStartRound!(difficulty);
    return GameRound(
      roundId: 'round-1',
      difficulty: difficulty,
      expiresAt: DateTime.now().add(const Duration(seconds: 120)),
      dailyCapRemaining: 19,
    );
  }

  @override
  Future<RoundResult> completeGameRound(
    String roundId, {
    required int clientScore,
  }) async {
    if (onCompleteRound != null) return onCompleteRound!(roundId);
    return const RoundResult(
      coinsEarned: 5,
      newBalance: 105,
      dailyCapRemaining: 19,
    );
  }

  @override
  Future<BonusState> bonusState(BonusKind kind) async {
    if (bonusStateData != null) return bonusStateData!(kind);
    return BonusState(
      kind: kind,
      attemptsRemaining: 1,
      attemptsPerDay: 1,
      unlocked: true,
    );
  }

  @override
  Future<BonusPlayResult> playBonus(BonusKind kind) async {
    if (onPlayBonus != null) return onPlayBonus!(kind);
    return const BonusPlayResult(
      prizeCoins: 25,
      newBalance: 125,
      attemptsRemaining: 0,
    );
  }
}

/// Device id that never touches secure storage.
class FakeDeviceId extends DeviceId {
  @override
  Future<String> get() async => 'test-device-000000000000';
}
