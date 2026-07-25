/// User feedback / complaint (H4).
enum FeedbackType {
  feedback,
  complaint;

  String get wire => name;

  String get label => this == FeedbackType.complaint ? 'Complaint' : 'Feedback';

  static FeedbackType fromWire(String? value) =>
      value == 'complaint' ? FeedbackType.complaint : FeedbackType.feedback;
}

/// One of the user's own submissions (`POST /api/feedback`,
/// `GET /api/feedback/mine`). Named `FeedbackEntry` to avoid clashing with
/// Flutter's built-in `Feedback` helper.
class FeedbackEntry {
  const FeedbackEntry({
    required this.id,
    required this.type,
    required this.subject,
    required this.message,
    required this.status,
    required this.adminReply,
    required this.createdAt,
    required this.resolvedAt,
  });

  final String id;
  final FeedbackType type;
  final String subject;
  final String message;

  /// One of `open`, `in_review`, `resolved`.
  final String status;
  final String? adminReply;
  final DateTime createdAt;
  final DateTime? resolvedAt;

  factory FeedbackEntry.fromJson(Map<String, dynamic> json) {
    final String? resolved = json['resolved_at'] as String?;
    return FeedbackEntry(
      id: (json['id'] as String?) ?? '',
      type: FeedbackType.fromWire(json['type'] as String?),
      subject: (json['subject'] as String?) ?? '',
      message: (json['message'] as String?) ?? '',
      status: (json['status'] as String?) ?? 'open',
      adminReply: json['admin_reply'] as String?,
      createdAt:
          DateTime.tryParse((json['created_at'] as String?) ?? '') ??
              DateTime.fromMillisecondsSinceEpoch(0),
      resolvedAt: resolved == null ? null : DateTime.tryParse(resolved),
    );
  }
}
