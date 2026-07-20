import './test-env'; // MUST precede the AppModule import (env validated at import time)
import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { AdminRole, GiftCardBrand, LedgerSourceType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { ADMIN_AUDIENCE, APP_AUDIENCE } from '../../src/common/auth';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { LedgerService } from '../../src/modules/ledger/ledger.service';

/**
 * Harness for the Phase C admin + redemption HTTP suites: boots the real
 * AppModule against live Postgres/Redis with helpers to mint users (with a
 * starting balance), admin tokens per role (signed directly — the TOTP login
 * flow is covered in Phase A), gift cards and inventory. Tracks everything it
 * creates for FK-safe teardown.
 */
export interface AdminTestApp {
  app: INestApplication;
  prisma: PrismaService;
  ledger: LedgerService;
  server: unknown;
  createUser(opts?: { balance?: number; createdAt?: Date }): Promise<string>;
  appJwtFor(userId: string): Promise<string>;
  createAdmin(role: AdminRole): Promise<{ id: string; token: string }>;
  adminTokenFor(adminId: string, role: AdminRole): Promise<string>;
  createGiftCard(
    brand: GiftCardBrand,
    denomination: number,
    coinCost: number,
    isActive?: boolean,
  ): Promise<string>;
  trackConfigKey(key: string): void;
  /** Clear the rate-limiter's counters so a suite's many same-IP calls don't 429. */
  resetThrottle(): void;
  close(): Promise<void>;
}

export async function createAdminTestApp(): Promise<AdminTestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ rawBody: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api', { exclude: ['healthz', 'readyz'] });
  await app.init();

  const prisma = app.get(PrismaService);
  const ledger = app.get(LedgerService);
  const config = app.get(ConfigService);
  const jwt = app.get(JwtService);
  // Rate limiting is exercised by its own Phase B suite; these HTTP suites fire
  // many calls from one IP, so we clear the limiter's counters between tests
  // (the global APP_GUARD ThrottlerGuard can't be overridden via useClass).
  const throttleStorage = app.get<ThrottlerStorage>(ThrottlerStorage, { strict: false });

  const userIds: string[] = [];
  const adminIds: string[] = [];
  const giftCardIds: string[] = [];
  const configKeys: string[] = [];

  const adminTokenFor = (adminId: string, role: AdminRole): Promise<string> =>
    jwt.signAsync(
      { sub: adminId, role },
      { secret: config.get<string>('JWT_ADMIN_SECRET'), audience: ADMIN_AUDIENCE, expiresIn: '8h' },
    );

  return {
    app,
    prisma,
    ledger,
    server: app.getHttpServer(),

    async createUser(opts = {}): Promise<string> {
      const id = randomUUID();
      await prisma.user.create({
        data: {
          id,
          googleUid: `ct-${id}`,
          email: `ct-${id}@test.local`,
          displayName: 'Phase C IT',
          country: 'IN',
          referralCode: `CT${id.slice(0, 10)}`,
          ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
        },
      });
      userIds.push(id);
      if (opts.balance && opts.balance > 0) {
        await ledger.record({
          userId: id,
          amount: opts.balance,
          sourceType: LedgerSourceType.admin_adjustment,
          idempotencyKey: `ct-seed:${id}`,
        });
      }
      return id;
    },

    appJwtFor(userId: string): Promise<string> {
      return jwt.signAsync(
        { sub: userId },
        { secret: config.get<string>('JWT_ACCESS_SECRET'), audience: APP_AUDIENCE, expiresIn: '15m' },
      );
    },

    async createAdmin(role: AdminRole): Promise<{ id: string; token: string }> {
      const id = randomUUID();
      await prisma.admin.create({
        data: {
          id,
          email: `admin-${id}@test.local`,
          passwordHash: await bcrypt.hash('irrelevant', 4),
          role,
          status: 'active',
        },
      });
      adminIds.push(id);
      return { id, token: await adminTokenFor(id, role) };
    },

    adminTokenFor,

    async createGiftCard(brand, denomination, coinCost, isActive = true): Promise<string> {
      const card = await prisma.giftCard.create({
        data: { brand, denomination, coinCost, isActive },
      });
      giftCardIds.push(card.id);
      return card.id;
    },

    trackConfigKey(key: string): void {
      configKeys.push(key);
    },

    resetThrottle(): void {
      const store = throttleStorage as unknown as {
        storage?: Map<string, unknown> | Record<string, unknown>;
      };
      if (store.storage instanceof Map) {
        store.storage.clear();
      } else if (store.storage && typeof store.storage === 'object') {
        const record = store.storage;
        for (const key of Object.keys(record)) {
          delete record[key];
        }
      }
    },

    async close(): Promise<void> {
      try {
        await prisma.adminAuditLog.deleteMany({ where: { adminId: { in: adminIds } } });
        await prisma.giftCardInventory.deleteMany({ where: { uploadedByAdminId: { in: adminIds } } });
        await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.fraudFlag.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.redemption.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.device.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.coinLedger.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        await prisma.giftCard.deleteMany({ where: { id: { in: giftCardIds } } });
        if (configKeys.length > 0) {
          await prisma.appConfig.deleteMany({ where: { key: { in: configKeys } } });
        }
        await prisma.admin.deleteMany({ where: { id: { in: adminIds } } });
      } finally {
        await app.close();
      }
    },
  };
}
