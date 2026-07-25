import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/api/models/auth_tokens.dart';
import '../../../core/api/models/user.dart';
import '../../../core/device/device_id.dart';
import '../../../core/providers.dart';
import '../data/google_sign_in_service.dart';
import '../domain/auth_state.dart';

/// Owns the auth session lifecycle: bootstrap → sign-in → attestation →
/// token exchange → authenticated, plus sign-out and session expiry.
class AuthController extends Notifier<AuthState> {
  ApiClient get _api => ref.read(apiClientProvider);
  DeviceId get _device => ref.read(deviceIdProvider);

  @override
  AuthState build() {
    // Kick off bootstrap; state starts as unknown and resolves asynchronously.
    Future<void>.microtask(_bootstrap);
    return const AuthState.unknown();
  }

  Future<void> _bootstrap() async {
    final String? access = await ref.read(tokenStoreProvider).readAccess();
    if (access == null || access.isEmpty) {
      state = const AuthState.unauthenticated();
      return;
    }
    // We have a token — try to load the profile. On failure the interceptor
    // handles refresh; a hard failure drops us to unauthenticated. Honor the
    // server's needs_attestation flag so a user who abandoned attestation and
    // reopened the app still lands on the attestation screen.
    try {
      final profile = await _api.me();
      final AuthUser user = AuthUser.fromProfile(profile);
      state = AuthState(
        status: profile.needsAttestation
            ? AuthStatus.pendingAttestation
            : AuthStatus.authenticated,
        user: user,
      );
    } on ApiException {
      await ref.read(tokenStoreProvider).clear();
      state = const AuthState.unauthenticated();
    }
  }

  /// Step 1a — real Google sign-in. Immediately exchanges the token for a
  /// session; the server tells us whether attestation is still needed. Throws
  /// [ApiException] on failure; returns false if the user cancelled.
  Future<bool> startGoogleSignIn() async {
    final GoogleSignInService svc = ref.read(googleSignInServiceProvider);
    final String? token = await svc.signIn();
    if (token == null) return false;
    await _exchangeToken(token);
    return true;
  }

  /// Step 1b — dev/mock sign-in (debug builds only). Same two-call flow.
  Future<void> startDevSignIn({
    String uid = 'devuser',
    String email = 'dev@cashraja.local',
  }) async {
    assert(kDebugMode, 'Dev sign-in must never run in release');
    await _exchangeToken('mock:$uid:$email');
  }

  /// Exchange a provider token for an app session (no referral here) and route
  /// on the server's needs_attestation flag. THIS is what fixes the bug: a
  /// returning, already-attested user skips the attestation screen entirely.
  Future<void> _exchangeToken(String token) async {
    final String fingerprint = await _device.get();
    final result = await _api.googleLogin(
      idToken: token,
      deviceFingerprint: fingerprint,
    );
    await ref.read(tokenStoreProvider).saveTokens(
          AuthTokens(
            accessToken: result.tokens.accessToken,
            refreshToken: result.tokens.refreshToken,
          ),
        );
    state = AuthState(
      status: result.user.needsAttestation
          ? AuthStatus.pendingAttestation
          : AuthStatus.authenticated,
      user: result.user,
    );
  }

  /// Step 2 — complete the 18+ attestation against the (already authenticated)
  /// session. [dateOfBirth] must make the user 18+; enforced client-side for
  /// fast UX and re-enforced server-side.
  Future<void> completeAttestation({
    required DateTime dateOfBirth,
    String? referralCode,
  }) async {
    if (state.status != AuthStatus.pendingAttestation) {
      throw const ApiException('Sign-in expired. Please try again.');
    }
    if (!isAdult(dateOfBirth)) {
      throw const ApiException('You must be 18 or older to use Cash Raja.');
    }

    final AuthUser user = await _api.attest(
      dateOfBirth: dateOfBirth,
      referralCode: referralCode,
    );
    state = AuthState(status: AuthStatus.authenticated, user: user);
  }

  /// Abort the attestation flow (e.g. user backs out). A session exists at this
  /// point, so clear it too.
  Future<void> cancelPending() async {
    await ref.read(googleSignInServiceProvider).signOut();
    await ref.read(tokenStoreProvider).clear();
    state = const AuthState.unauthenticated();
  }

  Future<void> signOut() async {
    await ref.read(googleSignInServiceProvider).signOut();
    await ref.read(tokenStoreProvider).clear();
    state = const AuthState.unauthenticated();
  }

  /// Called by the API layer when refresh fails — session is dead.
  Future<void> onSessionExpired() async {
    if (state.status == AuthStatus.authenticated) {
      state = const AuthState.unauthenticated();
    }
  }

  static bool isAdult(DateTime dob, {DateTime? now}) {
    final DateTime today = now ?? DateTime.now();
    final DateTime eighteenth =
        DateTime(dob.year + 18, dob.month, dob.day);
    return !eighteenth.isAfter(today);
  }
}

final authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);
