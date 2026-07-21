import '../../widgets/status_chip.dart';

/// Ledger entry source. Wire values are lowercase snake_case.
enum LedgerSourceType {
  game,
  offer,
  ad,
  referral,
  redemption,
  adminAdjustment,
  streak,
  bonus,
  unknown;

  static LedgerSourceType fromWire(String? v) {
    switch (v) {
      case 'game':
        return LedgerSourceType.game;
      case 'offer':
        return LedgerSourceType.offer;
      case 'ad':
        return LedgerSourceType.ad;
      case 'referral':
        return LedgerSourceType.referral;
      case 'redemption':
        return LedgerSourceType.redemption;
      case 'admin_adjustment':
        return LedgerSourceType.adminAdjustment;
      case 'streak':
        return LedgerSourceType.streak;
      case 'bonus':
        return LedgerSourceType.bonus;
      default:
        return LedgerSourceType.unknown;
    }
  }

  String get label {
    switch (this) {
      case LedgerSourceType.game:
        return 'Game';
      case LedgerSourceType.offer:
        return 'Offer';
      case LedgerSourceType.ad:
        return 'Ad reward';
      case LedgerSourceType.referral:
        return 'Referral';
      case LedgerSourceType.redemption:
        return 'Redemption';
      case LedgerSourceType.adminAdjustment:
        return 'Adjustment';
      case LedgerSourceType.streak:
        return 'Streak';
      case LedgerSourceType.bonus:
        return 'Bonus';
      case LedgerSourceType.unknown:
        return 'Activity';
    }
  }
}

/// Gift-card brand. Wire values lowercase.
enum GiftCardBrand {
  amazon,
  flipkart,
  googlePlay,
  unknown;

  static GiftCardBrand fromWire(String? v) {
    switch (v) {
      case 'amazon':
        return GiftCardBrand.amazon;
      case 'flipkart':
        return GiftCardBrand.flipkart;
      case 'google_play':
        return GiftCardBrand.googlePlay;
      default:
        return GiftCardBrand.unknown;
    }
  }

  String get label {
    switch (this) {
      case GiftCardBrand.amazon:
        return 'Amazon';
      case GiftCardBrand.flipkart:
        return 'Flipkart';
      case GiftCardBrand.googlePlay:
        return 'Google Play';
      case GiftCardBrand.unknown:
        return 'Gift card';
    }
  }
}

/// Redemption lifecycle status. Wire values lowercase snake_case.
enum RedemptionStatus {
  requested,
  underReview,
  approved,
  rejected,
  issued,
  unknown;

  static RedemptionStatus fromWire(String? v) {
    switch (v) {
      case 'requested':
        return RedemptionStatus.requested;
      case 'under_review':
        return RedemptionStatus.underReview;
      case 'approved':
        return RedemptionStatus.approved;
      case 'rejected':
        return RedemptionStatus.rejected;
      case 'issued':
        return RedemptionStatus.issued;
      default:
        return RedemptionStatus.unknown;
    }
  }

  String get label {
    switch (this) {
      case RedemptionStatus.requested:
        return 'Requested';
      case RedemptionStatus.underReview:
        return 'Under review';
      case RedemptionStatus.approved:
        return 'Approved';
      case RedemptionStatus.rejected:
        return 'Rejected';
      case RedemptionStatus.issued:
        return 'Issued';
      case RedemptionStatus.unknown:
        return 'Unknown';
    }
  }

  StatusTone get tone {
    switch (this) {
      case RedemptionStatus.requested:
      case RedemptionStatus.underReview:
        return StatusTone.pending;
      case RedemptionStatus.approved:
        return StatusTone.info;
      case RedemptionStatus.issued:
        return StatusTone.success;
      case RedemptionStatus.rejected:
        return StatusTone.danger;
      case RedemptionStatus.unknown:
        return StatusTone.neutral;
    }
  }

  bool get isTerminal =>
      this == RedemptionStatus.issued || this == RedemptionStatus.rejected;
}
