import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/auth/data/google_sign_in_service.dart';
import '../features/auth/presentation/auth_controller.dart';
import 'api/api_client.dart';
import 'api/token_store.dart';
import 'device/device_id.dart';

/// Persistent secure token storage. Overridden with an in-memory fake in tests.
final tokenStoreProvider = Provider<TokenStore>((Ref ref) {
  return SecureTokenStore();
});

/// Stable device fingerprint source.
final deviceIdProvider = Provider<DeviceId>((Ref ref) => DeviceId());

/// Real Google/Firebase sign-in service (used by the "Continue with Google"
/// button). The dev "Dev sign-in" button bypasses this and mints a mock token
/// directly in [AuthController.startDevSignIn].
final googleSignInServiceProvider =
    Provider<GoogleSignInService>((Ref ref) => FirebaseGoogleSignInService());

/// The typed API client. Its auth interceptor calls back into [AuthController]
/// when a refresh ultimately fails, dropping the user to the login screen.
final apiClientProvider = Provider<ApiClient>((Ref ref) {
  final TokenStore store = ref.watch(tokenStoreProvider);
  return ApiClient(
    store: store,
    onSessionExpired: () => ref.read(authControllerProvider.notifier).onSessionExpired(),
  );
});
