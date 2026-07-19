import { Injectable } from '@nestjs/common';
import {
  FirebaseVerifier,
  InvalidFirebaseTokenError,
  VerifiedFirebaseToken,
} from './firebase-verifier';

/**
 * Dev/test driver: accepts only tokens of the exact form "mock:<uid>:<email>".
 * Everything else is rejected. Refused at boot in production (env schema).
 */
@Injectable()
export class MockFirebaseVerifier implements FirebaseVerifier {
  async verifyIdToken(idToken: string): Promise<VerifiedFirebaseToken> {
    const parts = idToken.split(':');
    if (parts.length !== 3 || parts[0] !== 'mock') {
      throw new InvalidFirebaseTokenError('Mock verifier expects "mock:<uid>:<email>"');
    }
    const [, uid, email] = parts;
    if (!uid || !email || !email.includes('@')) {
      throw new InvalidFirebaseTokenError('Mock verifier expects "mock:<uid>:<email>"');
    }
    return { uid, email, name: email.split('@')[0] };
  }
}
