import 'package:flutter/material.dart';

import 'raja_colors.dart';

/// Builds the dark-first "Raja" [ThemeData].
///
/// Uses the bundled Manrope variable font. All numeric/coin displays should use
/// [RajaTheme.tabularFigures] so balances line up column-perfect.
abstract class RajaTheme {
  static const String fontFamily = 'Manrope';

  /// Font feature list that enables tabular (monospaced) figures.
  static const List<FontFeature> tabularFigures = <FontFeature>[
    FontFeature.tabularFigures(),
  ];

  static ThemeData dark() {
    const ColorScheme scheme = ColorScheme.dark(
      primary: RajaColors.gold,
      onPrimary: Color(0xFF1A1300),
      secondary: RajaColors.indigoSoft,
      onSecondary: RajaColors.textPrimary,
      surface: RajaColors.surface,
      onSurface: RajaColors.textPrimary,
      error: RajaColors.rose,
      onError: Colors.white,
    );

    final TextTheme base = _textTheme();

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      fontFamily: fontFamily,
      colorScheme: scheme,
      scaffoldBackgroundColor: RajaColors.indigoDeep,
      canvasColor: RajaColors.indigoDeep,
      textTheme: base,
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        foregroundColor: RajaColors.textPrimary,
        titleTextStyle: TextStyle(
          fontFamily: fontFamily,
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: RajaColors.textPrimary,
        ),
      ),
      cardTheme: CardThemeData(
        color: RajaColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: RajaColors.border),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: RajaColors.border,
        thickness: 1,
        space: 1,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: RajaColors.surfaceHigh,
        hintStyle: const TextStyle(color: RajaColors.textMuted),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: RajaColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: RajaColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: RajaColors.gold, width: 1.5),
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: RajaColors.indigo,
        selectedItemColor: RajaColors.gold,
        unselectedItemColor: RajaColors.textMuted,
        type: BottomNavigationBarType.fixed,
        showUnselectedLabels: true,
      ),
      snackBarTheme: const SnackBarThemeData(
        backgroundColor: RajaColors.surfaceHigh,
        contentTextStyle: TextStyle(color: RajaColors.textPrimary),
        behavior: SnackBarBehavior.floating,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: RajaColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
        ),
      ),
    );
  }

  static TextTheme _textTheme() {
    const Color primary = RajaColors.textPrimary;
    const Color secondary = RajaColors.textSecondary;
    return const TextTheme(
      displaySmall: TextStyle(fontWeight: FontWeight.w800, color: primary),
      headlineMedium: TextStyle(fontWeight: FontWeight.w800, color: primary),
      headlineSmall: TextStyle(fontWeight: FontWeight.w700, color: primary),
      titleLarge: TextStyle(fontWeight: FontWeight.w700, color: primary),
      titleMedium: TextStyle(fontWeight: FontWeight.w600, color: primary),
      titleSmall: TextStyle(fontWeight: FontWeight.w600, color: secondary),
      bodyLarge: TextStyle(fontWeight: FontWeight.w500, color: primary),
      bodyMedium: TextStyle(fontWeight: FontWeight.w400, color: secondary),
      bodySmall: TextStyle(fontWeight: FontWeight.w400, color: RajaColors.textMuted),
      labelLarge: TextStyle(fontWeight: FontWeight.w700, color: primary),
    );
  }
}
