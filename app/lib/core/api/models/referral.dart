/// `GET /api/referral/my-code`.
class ReferralCode {
  const ReferralCode({required this.code});

  final String code;

  factory ReferralCode.fromJson(Map<String, dynamic> json) =>
      ReferralCode(code: (json['code'] as String?) ?? '');
}

/// `GET /api/referral/stats`.
class ReferralStats {
  const ReferralStats({
    required this.code,
    required this.referredCount,
    required this.activeReferrals,
    required this.totalEarned,
  });

  final String code;
  final int referredCount;
  final int activeReferrals;
  final int totalEarned;

  factory ReferralStats.fromJson(Map<String, dynamic> json) {
    return ReferralStats(
      code: (json['code'] as String?) ?? '',
      referredCount: (json['referred_count'] as num?)?.toInt() ?? 0,
      activeReferrals: (json['active_referrals'] as num?)?.toInt() ?? 0,
      totalEarned:
          (json['total_earned_from_referrals'] as num?)?.toInt() ?? 0,
    );
  }
}

/// One referred user in `GET /api/referral/breakdown`.
class ReferredUser {
  const ReferredUser({
    required this.displayName,
    required this.joinedAt,
    required this.theirEarningsTotal,
    required this.commissionEarnedByMe,
    required this.windowActive,
    required this.validUntil,
  });

  final String displayName;
  final DateTime joinedAt;

  /// Coins the referred user earned inside the referral window.
  final int theirEarningsTotal;

  /// Coins the caller earned as commission from this user.
  final int commissionEarnedByMe;
  final bool windowActive;
  final DateTime validUntil;

  factory ReferredUser.fromJson(Map<String, dynamic> json) {
    return ReferredUser(
      displayName: (json['display_name'] as String?) ?? 'Player',
      joinedAt:
          DateTime.tryParse((json['joined_at'] as String?) ?? '') ??
              DateTime.fromMillisecondsSinceEpoch(0),
      theirEarningsTotal: (json['their_earnings_total'] as num?)?.toInt() ?? 0,
      commissionEarnedByMe:
          (json['commission_earned_by_me'] as num?)?.toInt() ?? 0,
      windowActive: (json['window_active'] as bool?) ?? false,
      validUntil:
          DateTime.tryParse((json['valid_until'] as String?) ?? '') ??
              DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}

/// `GET /api/referral/breakdown` — per-referred-user detail plus totals + the
/// current bonus percent / window config.
class ReferralBreakdown {
  const ReferralBreakdown({
    required this.referred,
    required this.referredCount,
    required this.activeCount,
    required this.totalCommission,
    required this.bonusPercent,
    required this.windowDays,
  });

  final List<ReferredUser> referred;
  final int referredCount;
  final int activeCount;
  final int totalCommission;
  final int bonusPercent;
  final int windowDays;

  factory ReferralBreakdown.fromJson(Map<String, dynamic> json) {
    final List<dynamic> rows =
        (json['referred'] as List<dynamic>?) ?? <dynamic>[];
    final Map<String, dynamic> totals =
        (json['totals'] as Map<String, dynamic>?) ?? <String, dynamic>{};
    final Map<String, dynamic> config =
        (json['config'] as Map<String, dynamic>?) ?? <String, dynamic>{};
    return ReferralBreakdown(
      referred: rows
          .map((dynamic e) => ReferredUser.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
      referredCount: (totals['referred_count'] as num?)?.toInt() ?? 0,
      activeCount: (totals['active_count'] as num?)?.toInt() ?? 0,
      totalCommission: (totals['total_commission'] as num?)?.toInt() ?? 0,
      bonusPercent: (config['bonus_percent'] as num?)?.toInt() ?? 0,
      windowDays: (config['window_days'] as num?)?.toInt() ?? 0,
    );
  }
}
