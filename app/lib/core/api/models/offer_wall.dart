/// Response of `GET /api/playtime/config` — whether the PlaytimeAds offerwall is
/// enabled and, if so, the SDK app key the app inits the native wall with.
class PlaytimeConfig {
  const PlaytimeConfig({required this.available, this.appKey});

  final bool available;
  final String? appKey;

  factory PlaytimeConfig.fromJson(Map<String, dynamic> json) {
    return PlaytimeConfig(
      available: (json['available'] as bool?) ?? false,
      appKey: json['app_key'] as String? ?? json['appKey'] as String?,
    );
  }
}
