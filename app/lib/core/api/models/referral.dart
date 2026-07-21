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
