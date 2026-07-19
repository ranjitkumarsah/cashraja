import { randomUUID } from 'node:crypto';
import { Prisma, Referral, RefreshToken, User, UserStatus } from '@prisma/client';

interface FakeDevice {
  id: string;
  userId: string;
  deviceFingerprint: string;
  firstSeen: Date;
  lastSeen: Date;
}

interface FakeAppConfig {
  key: string;
  value: unknown;
  version: number;
}

/**
 * In-memory stand-in for the Prisma surface AuthService touches
 * (user / device / refreshToken / referral / appConfig). Simulates the
 * unique constraints the auth design leans on: users.google_uid,
 * users.referral_code, refresh_tokens.token_hash, referrals.referred_id and
 * devices (user_id, device_fingerprint). $transaction is a pass-through
 * (rotation only needs sequential writes here).
 */
export class FakeAuthPrisma {
  usersStore: User[] = [];
  devicesStore: FakeDevice[] = [];
  refreshTokensStore: RefreshToken[] = [];
  referralsStore: Referral[] = [];
  appConfigStore: FakeAppConfig[] = [];

  // ─── test helpers ───

  seedUser(partial: Partial<User> & { googleUid: string; referralCode: string }): User {
    const user: User = {
      id: partial.id ?? randomUUID(),
      googleUid: partial.googleUid,
      email: partial.email ?? 'seed@example.com',
      displayName: partial.displayName ?? 'Seed User',
      country: partial.country ?? null,
      deviceId: partial.deviceId ?? null,
      status: partial.status ?? UserStatus.active,
      coinBalanceCached: partial.coinBalanceCached ?? 0,
      referralCode: partial.referralCode,
      createdAt: partial.createdAt ?? new Date(),
      lastSeenAt: partial.lastSeenAt ?? new Date(),
    };
    this.usersStore.push(user);
    return user;
  }

  seedAppConfig(key: string, value: unknown, version = 1): void {
    this.appConfigStore.push({ key, value, version });
  }

  tokenRowByHash(tokenHash: string): RefreshToken | undefined {
    return this.refreshTokensStore.find((t) => t.tokenHash === tokenHash);
  }

  // ─── Prisma surface ───

  async $transaction<T>(fn: (tx: this) => Promise<T>): Promise<T> {
    return fn(this);
  }

  readonly user = {
    findUnique: (args: {
      where: { id?: string; googleUid?: string; referralCode?: string };
    }): Promise<User | null> => {
      const { id, googleUid, referralCode } = args.where;
      const found =
        this.usersStore.find(
          (u) =>
            (id !== undefined && u.id === id) ||
            (googleUid !== undefined && u.googleUid === googleUid) ||
            (referralCode !== undefined && u.referralCode === referralCode),
        ) ?? null;
      return Promise.resolve(found);
    },
    create: (args: { data: Prisma.UserUncheckedCreateInput }): Promise<User> => {
      const { data } = args;
      if (this.usersStore.some((u) => u.googleUid === data.googleUid)) {
        throw uniqueViolation(['google_uid']);
      }
      if (this.usersStore.some((u) => u.referralCode === data.referralCode)) {
        throw uniqueViolation(['referral_code']);
      }
      const user: User = {
        id: randomUUID(),
        googleUid: data.googleUid,
        email: data.email,
        displayName: data.displayName,
        country: data.country ?? null,
        deviceId: data.deviceId ?? null,
        status: (data.status) ?? UserStatus.active,
        coinBalanceCached: data.coinBalanceCached ?? 0,
        referralCode: data.referralCode,
        createdAt: new Date(),
        lastSeenAt: new Date(),
      };
      this.usersStore.push(user);
      return Promise.resolve(user);
    },
    update: (args: {
      where: { id: string };
      data: { lastSeenAt?: Date };
    }): Promise<User> => {
      const user = this.usersStore.find((u) => u.id === args.where.id);
      if (!user) throw notFound();
      if (args.data.lastSeenAt) user.lastSeenAt = args.data.lastSeenAt;
      return Promise.resolve(user);
    },
  };

  readonly device = {
    upsert: (args: {
      where: { userId_deviceFingerprint: { userId: string; deviceFingerprint: string } };
      update: { lastSeen: Date };
      create: { userId: string; deviceFingerprint: string };
    }): Promise<FakeDevice> => {
      const { userId, deviceFingerprint } = args.where.userId_deviceFingerprint;
      const existing = this.devicesStore.find(
        (d) => d.userId === userId && d.deviceFingerprint === deviceFingerprint,
      );
      if (existing) {
        existing.lastSeen = args.update.lastSeen;
        return Promise.resolve(existing);
      }
      const device: FakeDevice = {
        id: randomUUID(),
        userId,
        deviceFingerprint,
        firstSeen: new Date(),
        lastSeen: new Date(),
      };
      this.devicesStore.push(device);
      return Promise.resolve(device);
    },
  };

  readonly refreshToken = {
    create: (args: { data: Prisma.RefreshTokenUncheckedCreateInput }): Promise<RefreshToken> => {
      const { data } = args;
      if (this.refreshTokensStore.some((t) => t.tokenHash === data.tokenHash)) {
        throw uniqueViolation(['token_hash']);
      }
      const row: RefreshToken = {
        id: randomUUID(),
        tokenHash: data.tokenHash,
        userId: data.userId,
        expiresAt: new Date(data.expiresAt),
        rotatedFromId: data.rotatedFromId ?? null,
        revokedAt: null,
        createdAt: new Date(),
      };
      this.refreshTokensStore.push(row);
      return Promise.resolve(row);
    },
    findUnique: (args: { where: { tokenHash: string } }): Promise<RefreshToken | null> =>
      Promise.resolve(this.tokenRowByHash(args.where.tokenHash) ?? null),
    findFirst: (args: { where: { rotatedFromId: string } }): Promise<RefreshToken | null> =>
      Promise.resolve(
        this.refreshTokensStore.find((t) => t.rotatedFromId === args.where.rotatedFromId) ?? null,
      ),
    update: (args: {
      where: { id: string };
      data: { revokedAt?: Date };
    }): Promise<RefreshToken> => {
      const row = this.refreshTokensStore.find((t) => t.id === args.where.id);
      if (!row) throw notFound();
      if (args.data.revokedAt) row.revokedAt = args.data.revokedAt;
      return Promise.resolve(row);
    },
    updateMany: (args: {
      where: { userId: string; revokedAt: null };
      data: { revokedAt: Date };
    }): Promise<{ count: number }> => {
      let count = 0;
      for (const row of this.refreshTokensStore) {
        if (row.userId === args.where.userId && row.revokedAt === null) {
          row.revokedAt = args.data.revokedAt;
          count++;
        }
      }
      return Promise.resolve({ count });
    },
  };

  readonly referral = {
    create: (args: { data: Prisma.ReferralUncheckedCreateInput }): Promise<Referral> => {
      const { data } = args;
      if (this.referralsStore.some((r) => r.referredId === data.referredId)) {
        throw uniqueViolation(['referred_id']);
      }
      const row: Referral = {
        id: randomUUID(),
        referrerId: data.referrerId,
        referredId: data.referredId,
        bonusPercent: new Prisma.Decimal(data.bonusPercent as number),
        validUntil: new Date(data.validUntil),
        createdAt: new Date(),
      };
      this.referralsStore.push(row);
      return Promise.resolve(row);
    },
  };

  readonly appConfig = {
    findFirst: (args: {
      where: { key: string };
      orderBy: { version: 'desc' };
    }): Promise<FakeAppConfig | null> => {
      const rows = this.appConfigStore
        .filter((c) => c.key === args.where.key)
        .sort((a, b) => b.version - a.version);
      return Promise.resolve(rows[0] ?? null);
    },
  };
}

function uniqueViolation(target: string[]): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    `Unique constraint failed on the fields: (\`${target.join('`,`')}\`)`,
    { code: 'P2002', clientVersion: 'fake', meta: { target } },
  );
}

function notFound(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
    clientVersion: 'fake',
  });
}
