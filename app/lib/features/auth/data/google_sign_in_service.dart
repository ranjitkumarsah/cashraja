import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../../../core/api/api_exception.dart';

/// Produces a token the backend's `POST /api/auth/google` can verify.
///
/// - Real path: Firebase + Google Sign-In → Firebase ID token.
/// - Dev/mock path: a `mock:<uid>:<email>` string the backend's mock verifier
///   accepts (guarded in the UI behind kDebugMode + a dart-define flag).
abstract class GoogleSignInService {
  /// Returns the token to send to the backend, or null if the user cancelled.
  Future<String?> signIn();

  /// Clears the local Google/Firebase session.
  Future<void> signOut();
}

/// Real implementation. Requires Firebase to be initialized and a device wired
/// to Google Play services. Not exercised in unit tests.
class FirebaseGoogleSignInService implements GoogleSignInService {
  FirebaseGoogleSignInService({
    FirebaseAuth? auth,
    GoogleSignIn? googleSignIn,
  })  : _authOverride = auth,
        _googleSignInOverride = googleSignIn;

  final FirebaseAuth? _authOverride;
  final GoogleSignIn? _googleSignInOverride;

  // Resolved lazily so constructing the service never touches an uninitialized
  // Firebase app (keeps the dev/offline flow working).
  FirebaseAuth get _auth => _authOverride ?? FirebaseAuth.instance;
  GoogleSignIn get _googleSignIn => _googleSignInOverride ?? GoogleSignIn();

  @override
  Future<String?> signIn() async {
    try {
      final GoogleSignInAccount? account = await _googleSignIn.signIn();
      if (account == null) return null; // user cancelled
      final GoogleSignInAuthentication gAuth = await account.authentication;
      final OAuthCredential credential = GoogleAuthProvider.credential(
        idToken: gAuth.idToken,
        accessToken: gAuth.accessToken,
      );
      final UserCredential cred = await _auth.signInWithCredential(credential);
      final String? idToken = await cred.user?.getIdToken();
      if (idToken == null) {
        throw const ApiException('Could not obtain a Google sign-in token.');
      }
      return idToken;
    } on FirebaseAuthException catch (e) {
      throw ApiException(e.message ?? 'Google sign-in failed.');
    }
  }

  @override
  Future<void> signOut() async {
    await _googleSignIn.signOut();
    await _auth.signOut();
  }
}

/// Dev-only mock — returns a `mock:<uid>:<email>` token the backend accepts in
/// development. Never used in release (UI gates it behind kDebugMode).
class MockGoogleSignInService implements GoogleSignInService {
  MockGoogleSignInService({this.uid = 'devuser', this.email = 'dev@cashraja.local'});

  final String uid;
  final String email;

  @override
  Future<String?> signIn() async => 'mock:$uid:$email';

  @override
  Future<void> signOut() async {}
}
