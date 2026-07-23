import 'enums.dart';

/// A redeemable gift card from `GET /api/gift-cards`.
class GiftCard {
  const GiftCard({
    required this.id,
    required this.brand,
    required this.denomination,
    required this.coinCost,
    required this.isActive,
    this.available = 0,
  });

  final String id;
  final GiftCardBrand brand;
  final int denomination;
  final int coinCost;
  final bool isActive;

  /// Unused inventory codes available for this card (G0.2). 0 ⇒ out of stock.
  final int available;

  bool get inStock => available > 0;

  factory GiftCard.fromJson(Map<String, dynamic> json) {
    return GiftCard(
      id: json['id'] as String,
      brand: GiftCardBrand.fromWire(json['brand'] as String?),
      denomination: (json['denomination'] as num?)?.toInt() ?? 0,
      coinCost: (json['coin_cost'] as num?)?.toInt() ?? 0,
      isActive: (json['is_active'] as bool?) ?? true,
      available: (json['available'] as num?)?.toInt() ?? 0,
    );
  }
}
