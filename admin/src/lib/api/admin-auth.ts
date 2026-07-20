import { api } from './client';
import type {
  AdminLoginRequest,
  AdminSessionResult,
  LoginResponse,
  TotpVerifyRequest,
} from './types';

/** POST /api/admin-auth/login — password check → TOTP challenge (or session). */
export async function login(body: AdminLoginRequest): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/admin-auth/login', body);
  return data;
}

/** POST /api/admin-auth/totp — existing-secret second factor. */
export async function verifyTotp(body: TotpVerifyRequest): Promise<AdminSessionResult> {
  const { data } = await api.post<AdminSessionResult>('/admin-auth/totp', body);
  return data;
}

/** POST /api/admin-auth/totp-setup — first-login secret enrolment. */
export async function setupTotp(body: TotpVerifyRequest): Promise<AdminSessionResult> {
  const { data } = await api.post<AdminSessionResult>('/admin-auth/totp-setup', body);
  return data;
}
