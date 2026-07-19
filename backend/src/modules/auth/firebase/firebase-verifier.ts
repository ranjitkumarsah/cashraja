/**
 * Verification abstraction over Firebase ID tokens (A4.1, ARCHITECTURE_PLAN
 * §2.3). Two drivers, selected by env FIREBASE_VERIFIER:
 *   - mock     — dev/test: accepts "mock:<uid>:<email>" tokens only
 *   - firebase — real Firebase Admin SDK verifyIdToken (checks aud + iss)
 */
export const FIREBASE_VERIFIER = 'FIREBASE_VERIFIER_SERVICE';

export interface VerifiedFirebaseToken {
  uid: string;
  email: string;
  name: string;
}

export interface FirebaseVerifier {
  /** Resolves the verified identity, or throws InvalidFirebaseTokenError. */
  verifyIdToken(idToken: string): Promise<VerifiedFirebaseToken>;
}

export class InvalidFirebaseTokenError extends Error {
  constructor(message = 'Invalid Firebase ID token') {
    super(message);
    this.name = 'InvalidFirebaseTokenError';
  }
}
