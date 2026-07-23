/// `GET /api/ads/reward-state` — remaining watch-ads count + cooldown (G7).
class AdRewardState {
  const AdRewardState({
    required this.dailyCap,
    required this.rewardsRemainingToday,
    required this.cooldownSeconds,
    required this.cooldownRemainingSeconds,
    required this.coinsPerView,
  });

  final int dailyCap;
  final int rewardsRemainingToday;
  final int cooldownSeconds;
  final int cooldownRemainingSeconds;
  final int coinsPerView;

  bool get capReached => rewardsRemainingToday <= 0;
  bool get onCooldown => cooldownRemainingSeconds > 0;
  bool get canWatch => !capReached && !onCooldown;

  factory AdRewardState.fromJson(Map<String, dynamic> json) {
    return AdRewardState(
      dailyCap: (json['daily_cap'] as num?)?.toInt() ?? 0,
      rewardsRemainingToday: (json['rewards_remaining_today'] as num?)?.toInt() ?? 0,
      cooldownSeconds: (json['cooldown_seconds'] as num?)?.toInt() ?? 0,
      cooldownRemainingSeconds: (json['cooldown_remaining_seconds'] as num?)?.toInt() ?? 0,
      coinsPerView: (json['coins_per_view'] as num?)?.toInt() ?? 0,
    );
  }
}

/// `POST /api/ads/reward` result — server-authoritative rewarded-ad credit (G7).
class AdRewardResult {
  const AdRewardResult({
    required this.coinsEarned,
    required this.newBalance,
    required this.rewardsRemainingToday,
    required this.cooldownSeconds,
  });

  final int coinsEarned;
  final int newBalance;
  final int rewardsRemainingToday;
  final int cooldownSeconds;

  factory AdRewardResult.fromJson(Map<String, dynamic> json) {
    return AdRewardResult(
      coinsEarned: (json['coins_earned'] as num?)?.toInt() ?? 0,
      newBalance: (json['new_balance'] as num?)?.toInt() ?? 0,
      rewardsRemainingToday: (json['rewards_remaining_today'] as num?)?.toInt() ?? 0,
      cooldownSeconds: (json['cooldown_seconds'] as num?)?.toInt() ?? 0,
    );
  }
}
