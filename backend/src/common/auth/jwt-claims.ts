import { AdminRole } from '@prisma/client';
import { Request } from 'express';

/**
 * Hard audience separation (TRD §8, ARCHITECTURE_PLAN §2.3): app-user tokens,
 * admin tokens and admin TOTP challenge tokens each carry a distinct `aud`
 * claim AND are signed with distinct secrets. A token presented on the wrong
 * guard chain fails verification (401) before any role check runs.
 */
export const APP_AUDIENCE = 'app';
export const ADMIN_AUDIENCE = 'admin';
export const ADMIN_TOTP_AUDIENCE = 'admin-totp';

export const ACCESS_TOKEN_TTL = '15m';
export const ADMIN_TOKEN_TTL = '8h';
export const TOTP_CHALLENGE_TTL = '5m';
export const REFRESH_TOKEN_TTL_DAYS = 30;

export interface AppTokenPayload {
  sub: string;
  aud: string | string[];
}

export interface AdminTokenPayload {
  sub: string;
  role: AdminRole;
  aud: string | string[];
}

export type TotpChallengePurpose = 'totp' | 'totp-setup';

export interface TotpChallengePayload {
  sub: string;
  purpose: TotpChallengePurpose;
  /** Present only on totp-setup challenges: the pending (not yet persisted) secret. */
  totp_secret?: string;
  aud: string | string[];
}

/** Attached to the request by JwtAuthGuard. */
export interface AuthenticatedUser {
  id: string;
}

/** Attached to the request by AdminAuthGuard. */
export interface AuthenticatedAdmin {
  id: string;
  role: AdminRole;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  admin?: AuthenticatedAdmin;
}
