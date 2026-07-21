import 'user.dart';

/// Access + refresh token pair.
class AuthTokens {
  const AuthTokens({required this.accessToken, required this.refreshToken});

  final String accessToken;
  final String refreshToken;

  factory AuthTokens.fromJson(Map<String, dynamic> json) {
    return AuthTokens(
      accessToken: json['access_token'] as String,
      refreshToken: json['refresh_token'] as String,
    );
  }
}

/// Result of a login (`POST /api/auth/google`): tokens plus the reduced user.
class LoginResult {
  const LoginResult({required this.tokens, required this.user});

  final AuthTokens tokens;
  final AuthUser user;

  factory LoginResult.fromJson(Map<String, dynamic> json) {
    return LoginResult(
      tokens: AuthTokens.fromJson(json),
      user: AuthUser.fromJson(json['user'] as Map<String, dynamic>),
    );
  }
}
