/// A manual offer from `GET /api/manual-offers` (H5). An admin-authored task
/// completed off-platform and proved with free text.
class ManualOffer {
  const ManualOffer({
    required this.id,
    required this.title,
    required this.description,
    required this.instructions,
    required this.coinReward,
    required this.mySubmissionStatus,
  });

  final String id;
  final String title;
  final String description;
  final String instructions;
  final int coinReward;

  /// The caller's most recent submission status for this offer, or null if they
  /// have never submitted. One of `pending`, `approved`, `rejected`.
  final String? mySubmissionStatus;

  /// Whether the user can submit proof right now (no pending/approved submission).
  bool get canSubmit =>
      mySubmissionStatus == null || mySubmissionStatus == 'rejected';

  factory ManualOffer.fromJson(Map<String, dynamic> json) {
    return ManualOffer(
      id: (json['id'] as String?) ?? '',
      title: (json['title'] as String?) ?? 'Offer',
      description: (json['description'] as String?) ?? '',
      instructions: (json['instructions'] as String?) ?? '',
      coinReward: (json['coin_reward'] as num?)?.toInt() ?? 0,
      mySubmissionStatus: json['my_submission_status'] as String?,
    );
  }
}

/// One of the caller's own submissions (`POST /api/manual-offers/:id/submit`,
/// `GET /api/manual-offers/mine`).
class ManualOfferSubmission {
  const ManualOfferSubmission({
    required this.id,
    required this.offerId,
    required this.offerTitle,
    required this.coinReward,
    required this.proofText,
    required this.status,
    required this.reviewReason,
    required this.createdAt,
    required this.reviewedAt,
  });

  final String id;
  final String offerId;
  final String offerTitle;
  final int coinReward;
  final String proofText;

  /// One of `pending`, `approved`, `rejected`.
  final String status;
  final String? reviewReason;
  final DateTime createdAt;
  final DateTime? reviewedAt;

  factory ManualOfferSubmission.fromJson(Map<String, dynamic> json) {
    final String? reviewed = json['reviewed_at'] as String?;
    return ManualOfferSubmission(
      id: (json['id'] as String?) ?? '',
      offerId: (json['offer_id'] as String?) ?? '',
      offerTitle: (json['offer_title'] as String?) ?? '',
      coinReward: (json['coin_reward'] as num?)?.toInt() ?? 0,
      proofText: (json['proof_text'] as String?) ?? '',
      status: (json['status'] as String?) ?? 'pending',
      reviewReason: json['review_reason'] as String?,
      createdAt: DateTime.tryParse((json['created_at'] as String?) ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      reviewedAt: reviewed == null ? null : DateTime.tryParse(reviewed),
    );
  }
}
