/**
 * Mirrors of the backend admin-auth contracts. Source of truth:
 * backend/src/modules/admin-auth/admin-auth.{controller,service}.ts and dtos.
 * Keep field names snake_case exactly as the wire format.
 */

/** Prisma `AdminRole` enum. */
export type AdminRole = 'reviewer' | 'super_admin';

export interface AdminSummary {
  id: string;
  email: string;
  role: AdminRole;
}

/** Body of POST /api/admin-auth/login (AdminLoginDto). */
export interface AdminLoginRequest {
  email: string;
  password: string;
}

/** Body of POST /api/admin-auth/totp and /totp-setup (TotpVerifyDto). */
export interface TotpVerifyRequest {
  challenge_token: string;
  code: string;
}

/** Successful second-factor response (AdminSessionResult). */
export interface AdminSessionResult {
  access_token: string;
  admin: AdminSummary;
}

/** Challenge response from POST /api/admin-auth/login (TotpChallengeResult). */
export interface TotpChallengeResult {
  totp_required?: true;
  totp_setup_required?: true;
  challenge_token: string;
  /** Present only on setup: otpauth:// URL for the QR code. */
  otpauth_url?: string;
}

/**
 * The backend currently always returns a TOTP challenge from /login, but we
 * defensively accept a direct session too (covers a future "TOTP optional"
 * admin without a client change).
 */
export type LoginResponse = TotpChallengeResult | AdminSessionResult;

export function isSessionResult(response: LoginResponse): response is AdminSessionResult {
  return 'access_token' in response && typeof response.access_token === 'string';
}
