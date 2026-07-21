import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/domain/auth_state.dart';
import '../../features/auth/presentation/attestation_screen.dart';
import '../../features/auth/presentation/auth_controller.dart';
import '../../features/auth/presentation/onboarding_screen.dart';
import '../../features/home/presentation/home_shell.dart';
import '../../features/placeholders/placeholder_screens.dart';
import '../../features/splash/splash_screen.dart';

abstract class Routes {
  static const String splash = '/splash';
  static const String onboarding = '/onboarding';
  static const String attestation = '/attestation';
  static const String home = '/home';
  static const String game = '/game';
  static const String spin = '/spin';
  static const String invite = '/invite';
}

/// Bridges the Riverpod auth state into a [Listenable] for go_router refresh.
class _AuthRefresh extends ChangeNotifier {
  _AuthRefresh(this._ref) {
    _ref.listen<AuthState>(
      authControllerProvider,
      (_, _) => notifyListeners(),
    );
  }
  final Ref _ref;
}

final goRouterProvider = Provider<GoRouter>((Ref ref) {
  final _AuthRefresh refresh = _AuthRefresh(ref);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: Routes.splash,
    refreshListenable: refresh,
    redirect: (_, GoRouterState state) {
      final AuthStatus status =
          ref.read(authControllerProvider).status;
      final String loc = state.matchedLocation;

      switch (status) {
        case AuthStatus.unknown:
          return loc == Routes.splash ? null : Routes.splash;
        case AuthStatus.unauthenticated:
          return loc == Routes.onboarding ? null : Routes.onboarding;
        case AuthStatus.pendingAttestation:
          return loc == Routes.attestation ? null : Routes.attestation;
        case AuthStatus.authenticated:
          const Set<String> preAuth = <String>{
            Routes.splash,
            Routes.onboarding,
            Routes.attestation,
          };
          return preAuth.contains(loc) ? Routes.home : null;
      }
    },
    routes: <RouteBase>[
      GoRoute(
        path: Routes.splash,
        builder: (_, _) => const SplashScreen(),
      ),
      GoRoute(
        path: Routes.onboarding,
        builder: (_, _) => const OnboardingScreen(),
      ),
      GoRoute(
        path: Routes.attestation,
        builder: (_, _) => const AttestationScreen(),
      ),
      GoRoute(
        path: Routes.home,
        builder: (_, _) => const HomeShell(),
      ),
      GoRoute(
        path: Routes.game,
        builder: (_, _) => const GamePlaceholderScreen(),
      ),
      GoRoute(
        path: Routes.spin,
        builder: (_, _) => const SpinPlaceholderScreen(),
      ),
      GoRoute(
        path: Routes.invite,
        builder: (_, _) => const InvitePlaceholderScreen(),
      ),
    ],
  );
});
