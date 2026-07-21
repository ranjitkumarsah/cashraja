/// A catalog offer from `GET /api/offers`.
class Offer {
  const Offer({
    required this.id,
    required this.network,
    required this.title,
    required this.coinReward,
    this.description,
    this.requirements,
  });

  final String id;
  final String network;
  final String title;
  final int coinReward;
  final String? description;
  final Map<String, dynamic>? requirements;

  /// Best-effort minimum playtime hint, if present in requirements.
  int? get minPlaytimeSeconds =>
      (requirements?['min_playtime_seconds'] as num?)?.toInt();

  factory Offer.fromJson(Map<String, dynamic> json) {
    return Offer(
      id: json['id'] as String,
      network: (json['network'] as String?) ?? 'mock',
      title: (json['title'] as String?) ?? 'Offer',
      coinReward: (json['coin_reward'] as num?)?.toInt() ?? 0,
      description: json['description'] as String?,
      requirements: json['requirements'] as Map<String, dynamic>?,
    );
  }
}

/// Result of `POST /api/offers/:id/launch`.
class OfferLaunch {
  const OfferLaunch({required this.launchUrl, required this.expiresInSeconds});

  final String launchUrl;
  final int expiresInSeconds;

  factory OfferLaunch.fromJson(Map<String, dynamic> json) {
    return OfferLaunch(
      launchUrl: json['launch_url'] as String,
      expiresInSeconds: (json['expires_in_seconds'] as num?)?.toInt() ?? 900,
    );
  }
}
