import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { webApi } from './web-api';
import { webTokens } from './web-token-store';

export interface WebUser {
  id: string;
  displayName: string;
  email: string;
  coinBalance: number;
  referralCode: string;
}

/**
 * Google sign-in for the web: Firebase popup → backend exchange
 * (POST /api/auth/google). Stores the returned user JWT + refresh token and
 * reports whether the 18+ attestation step is still required.
 */
export async function signInWithGoogle(): Promise<{ needsAttestation: boolean }> {
  const cred = await signInWithPopup(auth, googleProvider);
  const idToken = await cred.user.getIdToken();
  const { data } = await webApi.post(
    '/auth/google',
    { id_token: idToken, device_fingerprint: webTokens.deviceId() },
    { headers: { 'skip-auth': 'true' } },
  );
  webTokens.set(data.access_token, data.refresh_token);
  return { needsAttestation: !!data.needs_attestation };
}

/** Server-authoritative 18+ attestation (+ optional referral) for a new user. */
export async function attest(dateOfBirthISO: string, referralCode?: string): Promise<void> {
  await webApi.post('/auth/attest', {
    date_of_birth: dateOfBirthISO,
    ...(referralCode ? { referral_code: referralCode } : {}),
  });
}

export async function fetchMe(): Promise<WebUser> {
  const { data } = await webApi.get('/me');
  return {
    id: data.id,
    displayName: data.display_name ?? '',
    email: data.email ?? '',
    coinBalance: 0,
    referralCode: data.referral_code ?? '',
  };
}

export function webSignOut(): void {
  webTokens.clear();
  void auth.signOut().catch(() => undefined);
}

export function isWebAuthed(): boolean {
  return webTokens.isAuthed();
}
