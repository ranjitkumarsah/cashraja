import 'dart:async';

import 'package:cashraja/core/api/api_client.dart';
import 'package:cashraja/core/api/models/ad_reward.dart';
import 'package:cashraja/core/api/models/auth_tokens.dart';
import 'package:cashraja/core/api/models/bonus.dart';
import 'package:cashraja/core/api/models/feedback.dart';
import 'package:cashraja/core/api/models/game.dart';
import 'package:cashraja/core/api/models/gift_card.dart';
import 'package:cashraja/core/api/models/manual_offer.dart';
import 'package:cashraja/core/api/models/offer.dart';
import 'package:cashraja/core/api/models/redemption.dart';
import 'package:cashraja/core/api/models/referral.dart';
import 'package:cashraja/core/api/models/streak.dart';
import 'package:cashraja/core/api/models/user.dart';
import 'package:cashraja/core/api/models/wallet.dart';
import 'package:cashraja/core/api/token_store.dart';
import 'package:cashraja/core/device/device_id.dart';
import 'package:cashraja/features/ads/rewarded_ad_service.dart';
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
    this.onAttest,
    this.onRedeem,
    this.referralCodeData,
    this.referralStatsData,
    this.referralBreakdownData,
    this.myFeedbackData,
    this.onSubmitFeedback,
    this.manualOffersData,
    this.myManualOfferSubmissionsData,
    this.onSubmitManualOfferProof,
    this.streakData,
    this.onClaimStreak,
    this.onStartRound,
    this.onCompleteRound,
    this.bonusStateData,
    this.onPlayBonus,
    this.onRollBonus,
    this.onClaimBonus,
    this.adRewardStateData,
    this.onClaimAdReward,
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
  final AuthUser Function(DateTime dateOfBirth, String? referralCode)? onAttest;
  final Redemption Function(String giftCardId)? onRedeem;
  final ReferralCode? referralCodeData;
  final ReferralStats? referralStatsData;
  final ReferralBreakdown? referralBreakdownData;
  final List<FeedbackEntry>? myFeedbackData;
  final FeedbackEntry Function(
      FeedbackType type, String subject, String message)? onSubmitFeedback;
  final List<ManualOffer>? manualOffersData;
  final List<ManualOfferSubmission>? myManualOfferSubmissionsData;
  final ManualOfferSubmission Function(String offerId, String proofText)?
      onSubmitManualOfferProof;
  final StreakState? streakData;
  final StreakClaimResult Function()? onClaimStreak;
  final GameRound Function(GameDifficulty difficulty)? onStartRound;
  final RoundResult Function(String roundId)? onCompleteRound;
  final BonusState Function(BonusKind kind)? bonusStateData;
  final BonusPlayResult Function(BonusKind kind)? onPlayBonus;
  final BonusRollResult Function(BonusKind kind)? onRollBonus;
  final BonusPlayResult Function(BonusKind kind, String reservationId)?
      onClaimBonus;
  final AdRewardState? adRewardStateData;
  final AdRewardResult Function()? onClaimAdReward;

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
  }) async {
    if (onLogin != null) return onLogin!();
    // A fresh user by default: the server still needs the 18+ attestation.
    return const LoginResult(
      tokens: AuthTokens(accessToken: 'a', refreshToken: 'r'),
      user: AuthUser(
        id: 'u1',
        displayName: 'Dev User',
        email: 'dev@cashraja.local',
        coinBalance: 100,
        referralCode: 'RAJA1234',
        needsAttestation: true,
      ),
    );
  }

  @override
  Future<AuthUser> attest({
    required DateTime dateOfBirth,
    String? referralCode,
  }) async {
    if (onAttest != null) return onAttest!(dateOfBirth, referralCode);
    return const AuthUser(
      id: 'u1',
      displayName: 'Dev User',
      email: 'dev@cashraja.local',
      coinBalance: 100,
      referralCode: 'RAJA1234',
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
  Future<ReferralBreakdown> referralBreakdown() async =>
      referralBreakdownData ??
      const ReferralBreakdown(
        referred: <ReferredUser>[],
        referredCount: 0,
        activeCount: 0,
        totalCommission: 0,
        bonusPercent: 10,
        windowDays: 30,
      );

  @override
  Future<List<FeedbackEntry>> myFeedback() async =>
      myFeedbackData ?? <FeedbackEntry>[];

  @override
  Future<FeedbackEntry> submitFeedback({
    required FeedbackType type,
    required String subject,
    required String message,
  }) async {
    if (onSubmitFeedback != null) {
      return onSubmitFeedback!(type, subject, message);
    }
    return FeedbackEntry(
      id: 'fb-1',
      type: type,
      subject: subject,
      message: message,
      status: 'open',
      adminReply: null,
      createdAt: DateTime(2026, 7, 25),
      resolvedAt: null,
    );
  }

  @override
  Future<List<ManualOffer>> manualOffers() async =>
      manualOffersData ?? <ManualOffer>[];

  @override
  Future<List<ManualOfferSubmission>> myManualOfferSubmissions() async =>
      myManualOfferSubmissionsData ?? <ManualOfferSubmission>[];

  @override
  Future<ManualOfferSubmission> submitManualOfferProof(
    String offerId,
    String proofText,
  ) async {
    if (onSubmitManualOfferProof != null) {
      return onSubmitManualOfferProof!(offerId, proofText);
    }
    return ManualOfferSubmission(
      id: 'sub-1',
      offerId: offerId,
      offerTitle: 'Offer',
      coinReward: 50,
      proofText: proofText,
      status: 'pending',
      reviewReason: null,
      createdAt: DateTime(2026, 7, 25),
      reviewedAt: null,
    );
  }

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
      prizes: const <int>[0, 5, 25, 100],
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

  @override
  Future<BonusRollResult> rollBonus(BonusKind kind) async {
    if (onRollBonus != null) return onRollBonus!(kind);
    return const BonusRollResult(
      reservationId: 'res-1',
      prizeCoins: 25,
      attemptsRemaining: 0,
    );
  }

  @override
  Future<BonusPlayResult> claimBonus(BonusKind kind, String reservationId) async {
    if (onClaimBonus != null) return onClaimBonus!(kind, reservationId);
    return const BonusPlayResult(
      prizeCoins: 25,
      newBalance: 125,
      attemptsRemaining: 0,
    );
  }

  @override
  Future<AdRewardState> adRewardState() async =>
      adRewardStateData ??
      const AdRewardState(
        dailyCap: 10,
        rewardsRemainingToday: 10,
        cooldownSeconds: 60,
        cooldownRemainingSeconds: 0,
        coinsPerView: 5,
      );

  @override
  Future<AdRewardResult> claimAdReward() async {
    if (onClaimAdReward != null) return onClaimAdReward!();
    return const AdRewardResult(
      coinsEarned: 5,
      newBalance: 105,
      rewardsRemainingToday: 9,
      cooldownSeconds: 60,
    );
  }
}

/// A [RewardedAdService] that resolves immediately with a fixed [AdResult] —
/// lets widget tests exercise the watched vs not-watched ad-gated flows without
/// the mock driver's simulated delay.
class FakeRewardedAdService implements RewardedAdService {
  FakeRewardedAdService(this.result);

  final AdResult result;

  @override
  Future<void> load() async {}

  @override
  Future<AdResult> show() async => result;
}

/// A [RewardedAdService] whose [show] stays pending until [complete] is called —
/// lets tests observe the in-flight loading state (spinner + disabled controls)
/// before the ad resolves.
class DeferredRewardedAdService implements RewardedAdService {
  final Completer<AdResult> _completer = Completer<AdResult>();

  @override
  Future<void> load() async {}

  @override
  Future<AdResult> show() => _completer.future;

  void complete(AdResult result) => _completer.complete(result);
}

/// Device id that never touches secure storage.
class FakeDeviceId extends DeviceId {
  @override
  Future<String> get() async => 'test-device-000000000000';
}
