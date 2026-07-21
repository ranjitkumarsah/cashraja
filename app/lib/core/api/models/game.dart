/// Game difficulty tiers. Wire values are lowercase (`easy|medium|hard`).
enum GameDifficulty {
  easy,
  medium,
  hard;

  String get wire => name;

  static GameDifficulty fromWire(String? v) {
    switch (v) {
      case 'medium':
        return GameDifficulty.medium;
      case 'hard':
        return GameDifficulty.hard;
      case 'easy':
      default:
        return GameDifficulty.easy;
    }
  }

  String get label {
    switch (this) {
      case GameDifficulty.easy:
        return 'Easy';
      case GameDifficulty.medium:
        return 'Medium';
      case GameDifficulty.hard:
        return 'Hard';
    }
  }

  /// Client-side minimum play time per tier, mirroring the backend defaults
  /// (`game.min_play_seconds`: easy 10 / medium 20 / hard 30). The game holds
  /// the round open at least this long before completing so a genuine round is
  /// never rejected as `round_completed_too_fast`. A small buffer is added.
  Duration get minPlayTime {
    switch (this) {
      case GameDifficulty.easy:
        return const Duration(seconds: 11);
      case GameDifficulty.medium:
        return const Duration(seconds: 21);
      case GameDifficulty.hard:
        return const Duration(seconds: 31);
    }
  }

  /// Number of correct taps required to clear a round at this tier.
  int get targets {
    switch (this) {
      case GameDifficulty.easy:
        return 5;
      case GameDifficulty.medium:
        return 7;
      case GameDifficulty.hard:
        return 9;
    }
  }

  /// Grid size (n x n) the player picks from at this tier.
  int get gridSize {
    switch (this) {
      case GameDifficulty.easy:
        return 3;
      case GameDifficulty.medium:
        return 4;
      case GameDifficulty.hard:
        return 5;
    }
  }
}

/// `POST /api/game/round-start` result — a server-issued round.
class GameRound {
  const GameRound({
    required this.roundId,
    required this.difficulty,
    required this.expiresAt,
    required this.dailyCapRemaining,
  });

  final String roundId;
  final GameDifficulty difficulty;
  final DateTime expiresAt;
  final int dailyCapRemaining;

  factory GameRound.fromJson(Map<String, dynamic> json) {
    return GameRound(
      roundId: (json['round_id'] as String?) ?? '',
      difficulty: GameDifficulty.fromWire(json['difficulty'] as String?),
      expiresAt: DateTime.tryParse(json['expires_at'] as String? ?? '') ??
          DateTime.now().add(const Duration(seconds: 120)),
      dailyCapRemaining: (json['daily_cap_remaining'] as num?)?.toInt() ?? 0,
    );
  }
}

/// `POST /api/game/round-complete` result — server-authoritative reward.
class RoundResult {
  const RoundResult({
    required this.coinsEarned,
    required this.newBalance,
    required this.dailyCapRemaining,
  });

  final int coinsEarned;
  final int newBalance;
  final int dailyCapRemaining;

  factory RoundResult.fromJson(Map<String, dynamic> json) {
    return RoundResult(
      coinsEarned: (json['coins_earned'] as num?)?.toInt() ?? 0,
      newBalance: (json['new_balance'] as num?)?.toInt() ?? 0,
      dailyCapRemaining: (json['daily_cap_remaining'] as num?)?.toInt() ?? 0,
    );
  }
}
