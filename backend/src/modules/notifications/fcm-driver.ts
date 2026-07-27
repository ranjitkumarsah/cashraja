import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

/**
 * Push delivery driver behind an interface so the app never hard-depends on
 * FCM/credentials (E2). Selected by env FCM_DRIVER:
 *   - console (default): logs the push — dev/staging without FCM keys
 *   - mock: records sends in-memory — unit/integration assertions
 *   - firebase: real firebase-admin messaging (NEEDS_CREDENTIALS)
 * Delivery is best-effort: a driver failure never propagates to the caller
 * (a credit/redemption must not fail because a push didn't send).
 */
export interface FcmMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

/** Outcome of a single push. `invalidToken` marks a token to prune from fcm_tokens. */
export interface FcmSendResult {
  invalidToken?: boolean;
}

export interface FcmDriver {
  send(message: FcmMessage): Promise<FcmSendResult>;
}

export const FCM_DRIVER = 'FCM_DRIVER';

/** Dev default: structured log, no network. */
@Injectable()
export class ConsoleFcmDriver implements FcmDriver {
  private readonly logger = new Logger('FcmConsole');

  async send(message: FcmMessage): Promise<FcmSendResult> {
    this.logger.log(
      `push → token=${maskToken(message.token)} title="${message.title}" body="${message.body}"`,
    );
    return {};
  }
}

/** Test driver: records every send for assertions. */
export class MockFcmDriver implements FcmDriver {
  readonly sent: FcmMessage[] = [];
  /** tokens the driver should report as invalid (to exercise pruning). */
  invalidTokens = new Set<string>();

  async send(message: FcmMessage): Promise<FcmSendResult> {
    this.sent.push(message);
    return this.invalidTokens.has(message.token) ? { invalidToken: true } : {};
  }
}

const FCM_APP_NAME = 'cash-raja-fcm';

/**
 * firebase-admin messaging error codes that mean the token is permanently dead
 * (uninstalled app / expired / malformed) and should be pruned from fcm_tokens.
 */
const INVALID_TOKEN_CODES = new Set<string>([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
  'messaging/mismatched-credential',
]);

/**
 * Real driver (NEEDS_CREDENTIALS). Reuses the firebase-admin app initialized for
 * auth if present, else initializes from FIREBASE_SERVICE_ACCOUNT_JSON / ADC.
 * Kept dependency-light so console/mock paths never touch firebase-admin at
 * runtime.
 */
@Injectable()
export class FirebaseFcmDriver implements FcmDriver {
  private readonly logger = new Logger('FcmFirebase');
  private app: admin.app.App | null = null;

  constructor(private readonly config: ConfigService) {}

  async send(message: FcmMessage): Promise<FcmSendResult> {
    try {
      await this.getApp()
        .messaging()
        .send({
          token: message.token,
          notification: { title: message.title, body: message.body },
          data: message.data,
        });
      return {};
    } catch (err) {
      const code = (err as { code?: string; errorInfo?: { code?: string } }).code
        ?? (err as { errorInfo?: { code?: string } }).errorInfo?.code
        ?? '';
      if (INVALID_TOKEN_CODES.has(code)) {
        // Permanently dead token — signal the caller to prune it (not an error).
        return { invalidToken: true };
      }
      // Transient/other failure: surface so the caller logs it and moves on.
      throw err;
    }
  }

  private getApp(): admin.app.App {
    if (this.app) return this.app;
    const reusable =
      admin.apps.find((a) => a?.name === 'cash-raja-auth') ??
      admin.apps.find((a) => a?.name === FCM_APP_NAME);
    if (reusable) {
      this.app = reusable;
      return reusable;
    }
    const serviceAccountJson = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON') ?? '';
    const credential = serviceAccountJson
      ? admin.credential.cert(JSON.parse(serviceAccountJson) as admin.ServiceAccount)
      : admin.credential.applicationDefault();
    this.app = admin.initializeApp({ credential }, FCM_APP_NAME);
    return this.app;
  }
}

function maskToken(token: string): string {
  return token.length <= 8 ? '***' : `${token.slice(0, 4)}…${token.slice(-4)}`;
}
