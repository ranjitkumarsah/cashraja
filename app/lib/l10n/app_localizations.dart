import 'package:flutter/material.dart';

/// Lightweight, self-contained localization.
///
/// English strings ship today; a Hindi (`hi`) slot is wired and ready — drop a
/// `_hi` map in and add `'hi'` to [supportedLocales]. This mirrors the shape a
/// generated `flutter_intl`/`gen-l10n` `AppLocalizations` would expose, so it
/// can be swapped for codegen later without touching call sites.
class AppLocalizations {
  AppLocalizations(this.locale);

  final Locale locale;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations) ??
        AppLocalizations(const Locale('en'));
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    // Locale('hi'), // ready — enable once _hi strings are translated
  ];

  static const Map<String, String> _en = <String, String>{
    'appName': 'Cash Raja',
    'tagline': 'Play. Earn. Redeem.',
    'continueWithGoogle': 'Continue with Google',
    'devSignIn': 'Dev sign-in',
    'home': 'Home',
    'tasks': 'Tasks',
    'wallet': 'Wallet',
    'rewards': 'Rewards',
    'profile': 'Profile',
    'play': 'Play',
    'invite': 'Invite',
    'balance': 'Balance',
    'redeem': 'Redeem',
    'signOut': 'Sign out',
    'deleteAccount': 'Delete account',
    'comingSoon': 'Coming soon',
  };

  // Hindi slot — intentionally empty; English is used until translated.
  static const Map<String, Map<String, String>> _tables =
      <String, Map<String, String>>{
    'en': _en,
    // 'hi': _hi,
  };

  String _t(String key) {
    final Map<String, String> table = _tables[locale.languageCode] ?? _en;
    return table[key] ?? _en[key] ?? key;
  }

  String get appName => _t('appName');
  String get tagline => _t('tagline');
  String get continueWithGoogle => _t('continueWithGoogle');
  String get devSignIn => _t('devSignIn');
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) =>
      AppLocalizations.supportedLocales
          .map((Locale l) => l.languageCode)
          .contains(locale.languageCode);

  @override
  Future<AppLocalizations> load(Locale locale) async =>
      AppLocalizations(locale);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}
