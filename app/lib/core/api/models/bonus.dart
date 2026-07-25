/// Daily-bonus kind. Wire values are lowercase (`scratch|spin`) and are used
/// directly as the `:type` path segment.
enum BonusKind {
  scratch,
  spin;

  String get wire => name;

  String get label {
    switch (this) {
      case BonusKind.scratch:
        return 'Scratch';
      case BonusKind.spin:
        return 'Spin';
    }
  }
}

/// `GET /api/bonus/:type` — remaining attempts + unlock state + the real prize
/// set (so the spin wheel can render one segment per possible prize).
class BonusState {
  const BonusState({
    required this.kind,
    required this.attemptsRemaining,
    required this.attemptsPerDay,
    required this.unlocked,
    this.prizes = const <int>[],
  });

  final BonusKind kind;
  final int attemptsRemaining;
  final int attemptsPerDay;
  final bool unlocked;

  /// Distinct possible prize amounts (coins) from the server bonus_config —
  /// drives the labelled spin-wheel segments. Empty when unknown.
  final List<int> prizes;

  bool get canPlay => unlocked && attemptsRemaining > 0;

  BonusState copyWith({int? attemptsRemaining}) => BonusState(
        kind: kind,
        attemptsRemaining: attemptsRemaining ?? this.attemptsRemaining,
        attemptsPerDay: attemptsPerDay,
        unlocked: unlocked,
        prizes: prizes,
      );

  factory BonusState.fromJson(Map<String, dynamic> json, BonusKind kind) {
    return BonusState(
      kind: kind,
      attemptsRemaining: (json['attempts_remaining'] as num?)?.toInt() ?? 0,
      attemptsPerDay: (json['attempts_per_day'] as num?)?.toInt() ?? 0,
      unlocked: (json['unlocked'] as bool?) ?? false,
      prizes: ((json['prizes'] as List<dynamic>?) ?? <dynamic>[])
          .map((dynamic e) => (e as num).toInt())
          .toList(growable: false),
    );
  }
}

/// `POST /api/bonus/spin/roll` result — the server-reserved prize the wheel
/// lands on. Coins are NOT yet credited; [reservationId] is banked via
/// `POST /api/bonus/spin/claim` after the rewarded ad.
class BonusRollResult {
  const BonusRollResult({
    required this.reservationId,
    required this.prizeCoins,
    required this.attemptsRemaining,
  });

  final String reservationId;
  final int prizeCoins;
  final int attemptsRemaining;

  bool get isWin => prizeCoins > 0;

  factory BonusRollResult.fromJson(Map<String, dynamic> json) {
    return BonusRollResult(
      reservationId: (json['reservation_id'] as String?) ?? '',
      prizeCoins: (json['prize_coins'] as num?)?.toInt() ?? 0,
      attemptsRemaining: (json['attempts_remaining'] as num?)?.toInt() ?? 0,
    );
  }
}

/// `POST /api/bonus/:type/play` result — the server-rolled prize.
class BonusPlayResult {
  const BonusPlayResult({
    required this.prizeCoins,
    required this.newBalance,
    required this.attemptsRemaining,
  });

  final int prizeCoins;
  final int newBalance;
  final int attemptsRemaining;

  bool get isWin => prizeCoins > 0;

  factory BonusPlayResult.fromJson(Map<String, dynamic> json) {
    return BonusPlayResult(
      prizeCoins: (json['prize_coins'] as num?)?.toInt() ?? 0,
      newBalance: (json['new_balance'] as num?)?.toInt() ?? 0,
      attemptsRemaining: (json['attempts_remaining'] as num?)?.toInt() ?? 0,
    );
  }
}
