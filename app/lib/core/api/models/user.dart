/// Reduced user object returned by `POST /api/auth/google`.
class AuthUser {
  const AuthUser({
    required this.id,
    required this.displayName,
    required this.email,
    required this.coinBalance,
    required this.referralCode,
  });

  final String id;
  final String displayName;
  final String email;
  final int coinBalance;
  final String referralCode;

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'] as String,
      displayName: (json['display_name'] as String?) ?? '',
      email: (json['email'] as String?) ?? '',
      coinBalance: (json['coin_balance_cached'] as num?)?.toInt() ?? 0,
      referralCode: (json['referral_code'] as String?) ?? '',
    );
  }

  /// Lightweight session identity derived from a full profile (used when we
  /// resume a session on startup — balance is fetched separately by the wallet).
  factory AuthUser.fromProfile(MeProfile p) => AuthUser(
        id: p.id,
        displayName: p.displayName,
        email: p.email,
        coinBalance: 0,
        referralCode: p.referralCode,
      );
}

/// Full profile returned by `GET /api/me`.
class MeProfile {
  const MeProfile({
    required this.id,
    required this.email,
    required this.displayName,
    required this.status,
    required this.referralCode,
    required this.createdAt,
    this.country,
    this.streakDays,
  });

  final String id;
  final String email;
  final String displayName;
  final String status;
  final String referralCode;
  final DateTime createdAt;
  final String? country;

  /// Backend currently returns `streak: null` (Phase D). Nullable until wired.
  final int? streakDays;

  factory MeProfile.fromJson(Map<String, dynamic> json) {
    final Object? streak = json['streak'];
    return MeProfile(
      id: json['id'] as String,
      email: (json['email'] as String?) ?? '',
      displayName: (json['display_name'] as String?) ?? '',
      status: (json['status'] as String?) ?? 'active',
      referralCode: (json['referral_code'] as String?) ?? '',
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ??
          DateTime.now(),
      country: json['country'] as String?,
      streakDays: streak is Map<String, dynamic>
          ? (streak['current'] as num?)?.toInt()
          : (streak as num?)?.toInt(),
    );
  }
}
