import { randomUUID } from 'node:crypto';
import { FraudAutoAction, FraudFlagStatus, FraudSeverity, UserStatus } from '@prisma/client';
import { AppConfigService } from '../../common/app-config/app-config.service';
import { FakeAppConfig } from '../../common/testing/engagement-fakes';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FraudEngineService } from './fraud-engine.service';
import { FRAUD_RULES } from './fraud-rules';
import { InMemorySlidingWindow } from './sliding-window';

interface FakeFlag {
  id: string;
  userId: string;
  ruleTriggered: string;
  severity: FraudSeverity;
  autoAction: FraudAutoAction;
  status: FraudFlagStatus;
}

class FakeFraudPrisma {
  flags: FakeFlag[] = [];
  users = new Map<string, { id: string; status: UserStatus; deviceId: string | null }>();
  devices: Array<{ userId: string; deviceFingerprint: string }> = [];

  addUser(status: UserStatus = UserStatus.active, deviceId: string | null = null): string {
    const id = randomUUID();
    this.users.set(id, { id, status, deviceId });
    return id;
  }

  link(userId: string, fingerprint: string): void {
    this.devices.push({ userId, deviceFingerprint: fingerprint });
  }

  readonly fraudFlag = {
    findFirst: (args: { where: { userId: string; ruleTriggered: string; status: FraudFlagStatus } }) =>
      Promise.resolve(
        this.flags.find(
          (f) =>
            f.userId === args.where.userId &&
            f.ruleTriggered === args.where.ruleTriggered &&
            f.status === args.where.status,
        ) ?? null,
      ),
    create: (args: {
      data: { userId: string; ruleTriggered: string; severity: FraudSeverity; autoAction: FraudAutoAction };
    }) => {
      const flag: FakeFlag = { id: randomUUID(), status: FraudFlagStatus.open, ...args.data };
      this.flags.push(flag);
      return Promise.resolve({ id: flag.id });
    },
  };

  readonly device = {
    findMany: (args: {
      where: { userId?: string; deviceFingerprint?: { in: string[] } };
      distinct?: string[];
    }) => {
      let rows = this.devices;
      if (args.where.userId) rows = rows.filter((d) => d.userId === args.where.userId);
      if (args.where.deviceFingerprint?.in) {
        const set = new Set(args.where.deviceFingerprint.in);
        rows = rows.filter((d) => set.has(d.deviceFingerprint));
      }
      if (args.distinct?.includes('userId')) {
        const seen = new Set<string>();
        rows = rows.filter((d) => (seen.has(d.userId) ? false : (seen.add(d.userId), true)));
        return Promise.resolve(rows.map((d) => ({ userId: d.userId })));
      }
      return Promise.resolve(rows.map((d) => ({ deviceFingerprint: d.deviceFingerprint })));
    },
  };

  readonly user = {
    findUnique: (args: { where: { id: string } }) => {
      const u = this.users.get(args.where.id);
      return Promise.resolve(u ? { deviceId: u.deviceId } : null);
    },
    updateMany: (args: {
      where: { id: string; status?: UserStatus | { not: UserStatus } };
      data: { status: UserStatus };
    }) => {
      const u = this.users.get(args.where.id);
      if (!u) return Promise.resolve({ count: 0 });
      const cond = args.where.status;
      const matches =
        cond === undefined
          ? true
          : typeof cond === 'object'
            ? u.status !== cond.not
            : u.status === cond;
      if (!matches) return Promise.resolve({ count: 0 });
      u.status = args.data.status;
      return Promise.resolve({ count: 1 });
    },
  };
}

function build(prisma: FakeFraudPrisma, config: FakeAppConfig): FraudEngineService {
  return new FraudEngineService(
    prisma as unknown as PrismaService,
    config as unknown as AppConfigService,
    new InMemorySlidingWindow(),
  );
}

const baseConfig = (): FakeAppConfig =>
  new FakeAppConfig()
    .set('fraud.offer_velocity', { max_completions: 2, window_minutes: 10 })
    .set('fraud.device_account_limits', { flag_over: 2, block_over: 3 })
    .set('fraud.severity_actions', { low: 'none', medium: 'flagged_for_review', high: 'auto_banned' })
    .set('redemption.min_account_age_hours', { hours: 72 });

describe('FraudEngineService', () => {
  let prisma: FakeFraudPrisma;
  let config: FakeAppConfig;
  let engine: FraudEngineService;

  beforeEach(() => {
    prisma = new FakeFraudPrisma();
    config = baseConfig();
    engine = build(prisma, config);
  });

  describe('rule 2 — offer velocity', () => {
    it('holds once completions exceed max_completions in the window', async () => {
      const userId = prisma.addUser();
      expect((await engine.evaluateOfferVelocity(userId)).triggered).toBe(false); // 1
      expect((await engine.evaluateOfferVelocity(userId)).triggered).toBe(false); // 2 (== max)
      const third = await engine.evaluateOfferVelocity(userId); // 3 (> max)
      expect(third.triggered).toBe(true);
      expect(third.hold).toBe(true);
      expect(third.severity).toBe(FraudSeverity.medium);
    });
  });

  describe('rule 1 — device multi-accounting', () => {
    it('flags (no hold) when linked accounts exceed flag_over but not block_over', async () => {
      const a = prisma.addUser();
      const b = prisma.addUser();
      const c = prisma.addUser();
      [a, b, c].forEach((u) => prisma.link(u, 'dev-x')); // 3 accounts > flag_over(2), not > block(3)
      const result = await engine.evaluateMultiAccount(a);
      expect(result.triggered).toBe(true);
      expect(result.hold).toBe(false);
      expect(result.severity).toBe(FraudSeverity.medium);
      expect(result.additionalUserIds).toEqual(expect.arrayContaining([b, c]));
    });

    it('holds (high severity) when linked accounts exceed block_over', async () => {
      const users = [prisma.addUser(), prisma.addUser(), prisma.addUser(), prisma.addUser()];
      users.forEach((u) => prisma.link(u, 'dev-y')); // 4 > block_over(3)
      const result = await engine.evaluateMultiAccount(users[0]);
      expect(result.triggered).toBe(true);
      expect(result.hold).toBe(true);
      expect(result.severity).toBe(FraudSeverity.high);
    });

    it('does not trigger for a lone account', async () => {
      const a = prisma.addUser();
      prisma.link(a, 'dev-solo');
      expect((await engine.evaluateMultiAccount(a)).triggered).toBe(false);
    });
  });

  describe('rule 5 — new-account redemption screen', () => {
    it('forces review + flags a young account requesting the max-value card', async () => {
      const userId = prisma.addUser();
      const result = await engine.screenRedemption({
        userId,
        coinCost: 25_000,
        isMaxValue: true,
        accountAgeHours: 1,
      });
      expect(result.forceReview).toBe(true);
      expect(prisma.flags).toHaveLength(1);
      expect(prisma.flags[0]).toMatchObject({
        ruleTriggered: FRAUD_RULES.REDEMPTION_ABUSE,
        severity: FraudSeverity.low,
      });
    });

    it('reviews (no flag) a young account on a non-max card', async () => {
      const userId = prisma.addUser();
      const result = await engine.screenRedemption({
        userId,
        coinCost: 5_000,
        isMaxValue: false,
        accountAgeHours: 1,
      });
      expect(result.forceReview).toBe(true);
      expect(prisma.flags).toHaveLength(0);
    });

    it('does not review an aged account', async () => {
      const userId = prisma.addUser();
      const result = await engine.screenRedemption({
        userId,
        coinCost: 25_000,
        isMaxValue: true,
        accountAgeHours: 1_000,
      });
      expect(result.forceReview).toBe(false);
      expect(prisma.flags).toHaveLength(0);
    });
  });

  describe('flag persistence + auto-actions', () => {
    it('dedupes open flags per (user, rule)', async () => {
      const userId = prisma.addUser();
      await engine.raiseFlag({ userId, rule: FRAUD_RULES.GAME_FARMING, severity: FraudSeverity.medium });
      await engine.raiseFlag({ userId, rule: FRAUD_RULES.GAME_FARMING, severity: FraudSeverity.medium });
      expect(prisma.flags.filter((f) => f.userId === userId)).toHaveLength(1);
    });

    it('flagged_for_review sets the user to flagged (from active)', async () => {
      const userId = prisma.addUser(UserStatus.active);
      await engine.raiseFlag({ userId, rule: FRAUD_RULES.OFFER_VELOCITY, severity: FraudSeverity.medium });
      expect(prisma.users.get(userId)?.status).toBe(UserStatus.flagged);
      expect(prisma.flags[0].autoAction).toBe(FraudAutoAction.flagged_for_review);
    });

    it('auto_banned bans the user (high severity via config map)', async () => {
      const userId = prisma.addUser(UserStatus.active);
      await engine.raiseFlag({ userId, rule: FRAUD_RULES.MULTI_ACCOUNT, severity: FraudSeverity.high });
      expect(prisma.users.get(userId)?.status).toBe(UserStatus.banned);
      expect(prisma.flags[0].autoAction).toBe(FraudAutoAction.auto_banned);
    });

    it('raiseForMany opens a flag per affected account', async () => {
      const a = prisma.addUser();
      const b = prisma.addUser();
      await engine.raiseForMany([a, b, a], FRAUD_RULES.SELF_REFERRAL, FraudSeverity.medium);
      expect(prisma.flags).toHaveLength(2); // deduped the repeat of `a`
    });
  });
});
