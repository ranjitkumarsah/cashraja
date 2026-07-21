import 'enums.dart';

/// Reduced gift-card snapshot embedded in a redemption.
class RedemptionGiftCard {
  const RedemptionGiftCard({
    required this.id,
    required this.brand,
    required this.denomination,
    required this.coinCost,
  });

  final String id;
  final GiftCardBrand brand;
  final int denomination;
  final int coinCost;

  factory RedemptionGiftCard.fromJson(Map<String, dynamic> json) {
    return RedemptionGiftCard(
      id: json['id'] as String,
      brand: GiftCardBrand.fromWire(json['brand'] as String?),
      denomination: (json['denomination'] as num?)?.toInt() ?? 0,
      coinCost: (json['coin_cost'] as num?)?.toInt() ?? 0,
    );
  }
}

/// A redemption from `GET /api/redemptions/mine` or `POST /api/redemptions`.
class Redemption {
  const Redemption({
    required this.id,
    required this.giftCard,
    required this.coinAmount,
    required this.status,
    required this.createdAt,
    this.rejectionReason,
    this.resolvedAt,
    this.giftCardCode,
  });

  final String id;
  final RedemptionGiftCard giftCard;
  final int coinAmount;
  final RedemptionStatus status;
  final DateTime createdAt;
  final String? rejectionReason;
  final DateTime? resolvedAt;

  /// Present only on the owner view (`/mine`), non-null once `issued`.
  final String? giftCardCode;

  factory Redemption.fromJson(Map<String, dynamic> json) {
    return Redemption(
      id: json['id'] as String,
      giftCard: RedemptionGiftCard.fromJson(
        json['gift_card'] as Map<String, dynamic>,
      ),
      coinAmount: (json['coin_amount'] as num?)?.toInt() ?? 0,
      status: RedemptionStatus.fromWire(json['status'] as String?),
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ??
          DateTime.now(),
      rejectionReason: json['rejection_reason'] as String?,
      resolvedAt: json['resolved_at'] == null
          ? null
          : DateTime.tryParse(json['resolved_at'] as String),
      giftCardCode: json['gift_card_code'] as String?,
    );
  }
}
