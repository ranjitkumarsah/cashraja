import '../../../core/api/models/user.dart';

enum AuthStatus {
  /// Reading persisted tokens on startup.
  unknown,

  /// No session — show onboarding.
  unauthenticated,

  /// Signed in with Google/mock but must still complete the 18+ attestation +
  /// optional referral step before the token exchange.
  pendingAttestation,

  /// Fully authenticated.
  authenticated,
}

/// Immutable auth session state driving the router.
class AuthState {
  const AuthState({
    required this.status,
    this.user,
    this.pendingToken,
    this.pendingProviderIsMock = false,
  });

  const AuthState.unknown() : this(status: AuthStatus.unknown);
  const AuthState.unauthenticated()
      : this(status: AuthStatus.unauthenticated);

  final AuthStatus status;

  /// Present when [status] is authenticated.
  final AuthUser? user;

  /// The Google/mock token captured before attestation, exchanged on confirm.
  final String? pendingToken;

  final bool pendingProviderIsMock;

  bool get isAuthenticated => status == AuthStatus.authenticated;

  AuthState copyWith({
    AuthStatus? status,
    AuthUser? user,
    String? pendingToken,
    bool? pendingProviderIsMock,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      pendingToken: pendingToken ?? this.pendingToken,
      pendingProviderIsMock:
          pendingProviderIsMock ?? this.pendingProviderIsMock,
    );
  }
}
