/// Response of `GET /api/surveys/cpx` — the signed CPX survey-wall URL for the
/// current user, or `available: false` when the network isn't configured.
class SurveyWall {
  const SurveyWall({required this.available, this.url});

  final bool available;
  final String? url;

  factory SurveyWall.fromJson(Map<String, dynamic> json) {
    return SurveyWall(
      available: (json['available'] as bool?) ?? false,
      url: json['url'] as String?,
    );
  }
}
