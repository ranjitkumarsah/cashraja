/// `GET /api/streak` — daily login-streak state.
class StreakState {
  const StreakState({
    required this.currentCount,
    required this.claimableToday,
    required this.nextBonus,
    this.lastClaimDate,
  });

  final int currentCount;
  final bool claimableToday;

  /// Coins the next claim will award.
  final int nextBonus;

  /// IST calendar date of the last claim (`yyyy-MM-dd`), or null if never.
  final String? lastClaimDate;

  factory StreakState.fromJson(Map<String, dynamic> json) {
    return StreakState(
      currentCount: (json['current_count'] as num?)?.toInt() ?? 0,
      claimableToday: (json['claimable_today'] as bool?) ?? false,
      nextBonus: (json['next_bonus'] as num?)?.toInt() ?? 0,
      lastClaimDate: json['last_claim_date'] as String?,
    );
  }
}

/// `POST /api/streak/claim` result.
class StreakClaimResult {
  const StreakClaimResult({
    required this.streakCount,
    required this.coinsEarned,
    required this.newBalance,
  });

  final int streakCount;
  final int coinsEarned;
  final int newBalance;

  factory StreakClaimResult.fromJson(Map<String, dynamic> json) {
    return StreakClaimResult(
      streakCount: (json['streak_count'] as num?)?.toInt() ?? 0,
      coinsEarned: (json['coins_earned'] as num?)?.toInt() ?? 0,
      newBalance: (json['new_balance'] as num?)?.toInt() ?? 0,
    );
  }
}
