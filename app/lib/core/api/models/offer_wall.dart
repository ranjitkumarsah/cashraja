/// Response of a hosted-offerwall URL endpoint (e.g. `GET /api/playtime/wall`) —
/// the per-user wall URL to open, or `available: false` when not configured.
class OfferWall {
  const OfferWall({required this.available, this.url});

  final bool available;
  final String? url;

  factory OfferWall.fromJson(Map<String, dynamic> json) {
    return OfferWall(
      available: (json['available'] as bool?) ?? false,
      url: json['url'] as String?,
    );
  }
}
