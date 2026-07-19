import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import {
  FirebaseVerifier,
  InvalidFirebaseTokenError,
  VerifiedFirebaseToken,
} from './firebase-verifier';

const APP_NAME = 'cash-raja-auth';

/**
 * Real driver: Firebase Admin SDK verifyIdToken — the SDK checks signature,
 * expiry, aud (project id) and iss (securetoken.google.com/<project>) per
 * TRD §8. Credentials come from FIREBASE_SERVICE_ACCOUNT_JSON (single-line
 * service-account JSON) or, when empty, Application Default Credentials.
 */
@Injectable()
export class FirebaseAdminVerifier implements FirebaseVerifier {
  private readonly logger = new Logger(FirebaseAdminVerifier.name);
  private app: admin.app.App | null = null;

  constructor(private readonly config: ConfigService) {}

  async verifyIdToken(idToken: string): Promise<VerifiedFirebaseToken> {
    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await this.getApp().auth().verifyIdToken(idToken);
    } catch (err) {
      this.logger.debug(`Firebase ID token rejected: ${(err as Error).message}`);
      throw new InvalidFirebaseTokenError();
    }

    const email = typeof decoded.email === 'string' ? decoded.email : '';
    const rawName = (decoded as { name?: unknown }).name;
    const name = typeof rawName === 'string' && rawName ? rawName : email || decoded.uid;
    return { uid: decoded.uid, email, name };
  }

  private getApp(): admin.app.App {
    if (this.app) return this.app;

    const existing = admin.apps.find((a) => a?.name === APP_NAME);
    if (existing) {
      this.app = existing;
      return existing;
    }

    const serviceAccountJson = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON') ?? '';
    const credential = serviceAccountJson
      ? admin.credential.cert(JSON.parse(serviceAccountJson) as admin.ServiceAccount)
      : admin.credential.applicationDefault();
    this.app = admin.initializeApp({ credential }, APP_NAME);
    return this.app;
  }
}
