import 'package:flutter/material.dart';

import '../../../core/api/models/enums.dart';

/// Visual identity for a gift-card brand used by the brand grid + detail header.
///
/// IMPORTANT: we deliberately do NOT bundle official/copyrighted brand logos.
/// Each brand is represented by a branded COLOR card plus a generic gift-card
/// [Icon]. If real, licensed brand logos become available they can be dropped
/// in here later (e.g. swap [icon] for an asset image) without touching the
/// grid/detail layouts.
class BrandStyle {
  const BrandStyle({
    required this.label,
    required this.gradient,
    required this.accent,
    required this.onColor,
    required this.icon,
  });

  final String label;
  final LinearGradient gradient;

  /// Accent used for chips/denominations on the light card surface.
  final Color accent;

  /// Foreground color that reads well on top of [gradient].
  final Color onColor;
  final IconData icon;

  static BrandStyle of(GiftCardBrand brand) {
    switch (brand) {
      case GiftCardBrand.amazon:
        // Amazon — dark slate + signature orange.
        return const BrandStyle(
          label: 'Amazon',
          gradient: LinearGradient(
            colors: <Color>[Color(0xFF232F3E), Color(0xFF37475A)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          accent: Color(0xFFFF9900),
          onColor: Colors.white,
          icon: Icons.card_giftcard_rounded,
        );
      case GiftCardBrand.flipkart:
        // Flipkart — brand blue with a yellow accent.
        return const BrandStyle(
          label: 'Flipkart',
          gradient: LinearGradient(
            colors: <Color>[Color(0xFF2874F0), Color(0xFF1B54B3)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          accent: Color(0xFFFFE11B),
          onColor: Colors.white,
          icon: Icons.shopping_bag_rounded,
        );
      case GiftCardBrand.googlePlay:
        // Google Play — multi-accent play triangle vibe on a clean surface.
        return const BrandStyle(
          label: 'Google Play',
          gradient: LinearGradient(
            colors: <Color>[Color(0xFF00A0FF), Color(0xFF00D67E)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          accent: Color(0xFFEA4335),
          onColor: Colors.white,
          icon: Icons.play_arrow_rounded,
        );
      case GiftCardBrand.unknown:
        return const BrandStyle(
          label: 'Gift card',
          gradient: LinearGradient(
            colors: <Color>[Color(0xFF3A377A), Color(0xFF262251)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          accent: Color(0xFFD4AF37),
          onColor: Colors.white,
          icon: Icons.card_giftcard_rounded,
        );
    }
  }
}
