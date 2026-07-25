import 'package:cashraja/core/api/models/auth_tokens.dart';
import 'package:cashraja/core/api/models/user.dart';
import 'package:cashraja/core/api/token_store.dart';
import 'package:cashraja/core/providers.dart';
import 'package:cashraja/features/auth/domain/auth_state.dart';
import 'package:cashraja/features/auth/presentation/auth_controller.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fakes.dart';

ProviderContainer _container() {
  final container = ProviderContainer(
    overrides: <Override>[
      tokenStoreProvider.overrideWithValue(InMemoryTokenStore()),
      deviceIdProvider.overrideWithValue(FakeDeviceId()),
      apiClientProvider.overrideWithValue(FakeApiClient()),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  test('isAdult correctly gates on an 18th birthday', () {
    final now = DateTime(2026, 7, 21);
    expect(
      AuthController.isAdult(DateTime(2008, 7, 21), now: now),
      isTrue, // exactly 18 today
    );
    expect(
      AuthController.isAdult(DateTime(2008, 7, 22), now: now),
      isFalse, // 18 tomorrow
    );
    expect(
      AuthController.isAdult(DateTime(2000, 1, 1), now: now),
      isTrue,
    );
  });

  test(
      'dev sign-in exchanges the token, lands on attestation, then attest '
      'authenticates', () async {
    final container = _container();
    final AuthController auth = container.read(authControllerProvider.notifier);

    // Let bootstrap settle (no token → unauthenticated).
    await Future<void>.delayed(Duration.zero);
    expect(container.read(authControllerProvider).status,
        AuthStatus.unauthenticated);

    // Step 1: token exchange happens immediately; a fresh user (fake reports
    // needs_attestation=true) lands on the attestation gate — and a session
    // already exists (tokens persisted).
    await auth.startDevSignIn();
    expect(container.read(authControllerProvider).status,
        AuthStatus.pendingAttestation);
    expect(await container.read(tokenStoreProvider).readAccess(), isNotNull);

    // Step 2: attest against the existing session → authenticated.
    await auth.completeAttestation(dateOfBirth: DateTime(1998, 1, 1));
    final AuthState after = container.read(authControllerProvider);
    expect(after.status, AuthStatus.authenticated);
    expect(after.user?.referralCode, 'RAJA1234');
  });

  test('a returning attested user skips attestation and goes straight to home',
      () async {
    final container = ProviderContainer(
      overrides: <Override>[
        tokenStoreProvider.overrideWithValue(InMemoryTokenStore()),
        deviceIdProvider.overrideWithValue(FakeDeviceId()),
        apiClientProvider.overrideWithValue(
          FakeApiClient(
            // Server reports the user has already attested.
            onLogin: () => const LoginResult(
              tokens: AuthTokens(accessToken: 'a', refreshToken: 'r'),
              user: AuthUser(
                id: 'u1',
                displayName: 'Dev User',
                email: 'dev@cashraja.local',
                coinBalance: 100,
                referralCode: 'RAJA1234',
                needsAttestation: false,
              ),
            ),
          ),
        ),
      ],
    );
    addTearDown(container.dispose);
    final AuthController auth = container.read(authControllerProvider.notifier);
    await Future<void>.delayed(Duration.zero);

    await auth.startDevSignIn();
    // Bug fix: no attestation step — straight to authenticated.
    expect(container.read(authControllerProvider).status,
        AuthStatus.authenticated);
  });

  test('underage attestation is rejected', () async {
    final container = _container();
    final AuthController auth = container.read(authControllerProvider.notifier);
    await Future<void>.delayed(Duration.zero);
    await auth.startDevSignIn();

    expect(
      () => auth.completeAttestation(dateOfBirth: DateTime(2020, 1, 1)),
      throwsA(isA<Object>()),
    );
  });
}
