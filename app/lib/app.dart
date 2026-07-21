import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/router/app_router.dart';
import 'core/theme/raja_theme.dart';
import 'l10n/app_localizations.dart';

/// Root widget: wires the Raja theme, localization, and the auth-aware router.
class CashRajaApp extends ConsumerWidget {
  const CashRajaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(goRouterProvider);
    return MaterialApp.router(
      title: 'Cash Raja',
      debugShowCheckedModeBanner: false,
      theme: RajaTheme.dark(),
      themeMode: ThemeMode.dark,
      routerConfig: router,
      localizationsDelegates: const <LocalizationsDelegate<dynamic>>[
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
    );
  }
}
