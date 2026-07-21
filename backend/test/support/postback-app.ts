import './test-env'; // MUST precede the AppModule import (env validated at import time)
import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { APP_AUDIENCE } from '../../src/common/auth';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { MockOfferwallAdapter } from '../../src/providers/offerwall/mock-offerwall.adapter';
import { MockAdSsvAdapter } from '../../src/providers/ad-ssv/mock-ad-ssv.adapter';

/**
 * Shared harness for HTTP-level pipeline integration suites: boots the REAL
 * AppModule (rawBody on, same pipes/prefix as main.ts) against live
 * Postgres + Redis, with helpers to create users, sign mock postbacks and
 * poll for async worker outcomes.
 */

export interface PostbackTestApp {
  app: INestApplication;
  prisma: PrismaService;
  server: unknown;
  offerwallSecret: string;
  adSsvSecret: string;
  createdUserIds: string[];
  createUser(country?: string): Promise<string>;
  appJwtFor(userId: string): Promise<string>;
  close(): Promise<void>;
}

export async function createPostbackTestApp(): Promise<PostbackTestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ rawBody: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api', { exclude: ['healthz', 'readyz'] });
  await app.init();

  const prisma = app.get(PrismaService);
  const config = app.get(ConfigService);
  const jwt = app.get(JwtService);
  const createdUserIds: string[] = [];

  return {
    app,
    prisma,
    server: app.getHttpServer(),
    offerwallSecret: config.get<string>('MOCK_OFFERWALL_SECRET') ?? '',
    adSsvSecret: config.get<string>('MOCK_AD_SSV_SECRET') ?? '',
    createdUserIds,

    async createUser(country = 'IN'): Promise<string> {
      const id = randomUUID();
      await prisma.user.create({
        data: {
          id,
          googleUid: `pb-${id}`,
          email: `pb-${id}@test.local`,
          displayName: 'Postback IT',
          country,
          referralCode: `PB${id.slice(0, 10)}`,
        },
      });
      createdUserIds.push(id);
      return id;
    },

    async appJwtFor(userId: string): Promise<string> {
      return jwt.signAsync(
        { sub: userId },
        {
          secret: config.get<string>('JWT_ACCESS_SECRET'),
          audience: APP_AUDIENCE,
          expiresIn: '15m',
        },
      );
    },

    async close(): Promise<void> {
      try {
        // Retry cleanup a few times: late worker retries can insert ledger
        // rows between deleteMany calls (FK violation on users otherwise).
        for (let attempt = 1; createdUserIds.length > 0; attempt += 1) {
          try {
            await prisma.offerCompletion.deleteMany({ where: { userId: { in: createdUserIds } } });
            await prisma.adImpression.deleteMany({ where: { userId: { in: createdUserIds } } });
            // Phase E: credit paths now emit notifications + may open fraud flags.
            await prisma.notification.deleteMany({ where: { userId: { in: createdUserIds } } });
            await prisma.fcmToken.deleteMany({ where: { userId: { in: createdUserIds } } });
            await prisma.fraudFlag.deleteMany({ where: { userId: { in: createdUserIds } } });
            await prisma.coinLedger.deleteMany({ where: { userId: { in: createdUserIds } } });
            await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
            break;
          } catch (err) {
            if (attempt >= 5) throw err;
            await new Promise((resolve) => setTimeout(resolve, 2_000));
          }
        }
      } finally {
        // Always release DB/Redis handles, even when cleanup failed —
        // otherwise jest hangs on open connections.
        await app.close();
      }
    },
  };
}

export function signOfferwallBody(body: string, secret: string): string {
  return MockOfferwallAdapter.sign(body, secret);
}

export function signAdSsvBody(body: string, secret: string): string {
  return MockAdSsvAdapter.sign(body, secret);
}

/** Poll until `probe` returns non-null, else throw after `timeoutMs`. */
export async function eventually<T>(
  probe: () => Promise<T | null>,
  what: string,
  timeoutMs = 20_000,
  intervalMs = 100,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await probe();
    if (result !== null) return result;
    if (Date.now() > deadline) {
      throw new Error(`Timed out after ${timeoutMs}ms waiting for: ${what}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
