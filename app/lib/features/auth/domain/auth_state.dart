import '../../../core/api/models/user.dart';

enum AuthStatus {
  /// Reading persisted tokens on startup.
  unknown,

  /// No session — show onboarding.
  unauthenticated,

  /// A session now exists (token exchanged), but the server still reports the
  /// user must complete the 18+ DOB attestation + optional referral step.
  pendingAttestation,

  /// Fully authenticated (attested).
  authenticated,
}

/// Immutable auth session state driving the router.
class AuthState {
  const AuthState({
    required this.status,
    this.user,
  });

  const AuthState.unknown() : this(status: AuthStatus.unknown);
  const AuthState.unauthenticated()
      : this(status: AuthStatus.unauthenticated);

  final AuthStatus status;

  /// Present once a session exists (both [pendingAttestation] and
  /// [authenticated]).
  final AuthUser? user;

  bool get isAuthenticated => status == AuthStatus.authenticated;

  AuthState copyWith({
    AuthStatus? status,
    AuthUser? user,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
    );
  }
}
