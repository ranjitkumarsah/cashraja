import 'package:flutter/material.dart';

/// The "Raja" palette — deep royal indigo surfaces, regal gold accents.
/// Dark-first (the app is dark by default).
abstract class RajaColors {
  // Royal indigo surfaces
  static const Color indigoDeep = Color(0xFF1E1B4B);
  static const Color indigo = Color(0xFF312E81);
  static const Color indigoSoft = Color(0xFF3A377A);

  // Elevated surface / cards (slightly lifted from the background)
  static const Color surface = Color(0xFF262251);
  static const Color surfaceHigh = Color(0xFF322E63);

  // Regal gold accent (coins, primary CTAs)
  static const Color gold = Color(0xFFD4AF37);
  static const Color goldLight = Color(0xFFF5C518);
  static const Color goldDeep = Color(0xFFB8860B);

  // Semantic
  static const Color emerald = Color(0xFF10B981);
  static const Color rose = Color(0xFFE11D48);
  static const Color amber = Color(0xFFF59E0B);
  static const Color sky = Color(0xFF38BDF8);

  // Text
  static const Color textPrimary = Color(0xFFF5F3FF);
  static const Color textSecondary = Color(0xFFB8B4D9);
  static const Color textMuted = Color(0xFF8683A8);

  // Hairlines / borders
  static const Color border = Color(0x1FFFFFFF);

  /// Amber gradient used for coins and primary CTAs.
  static const LinearGradient goldGradient = LinearGradient(
    colors: <Color>[goldLight, goldDeep],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Deep indigo background gradient for full-screen surfaces.
  static const LinearGradient royalGradient = LinearGradient(
    colors: <Color>[indigoDeep, indigo],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );
}
