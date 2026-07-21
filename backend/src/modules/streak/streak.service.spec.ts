import { randomUUID } from 'node:crypto';
import { AppConfigService } from '../../common/app-config/app-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  FakeAppConfig,
  FakeEngagementLedger,
  RecordingNotificationHook,
  RecordingReferral,
} from '../../common/testing/engagement-fakes';
import { istDateString, istDateStringToDate, istYesterdayString } from '../../common/time/ist-day';
import { LedgerService } from '../ledger/ledger.service';
import { ReferralService } from '../referral/referral.service';
import { StreakService } from './streak.service';

interface FakeStreak {
  userId: string;
  currentCount: number;
  lastClaimDate: Date;
}

/** Minimal in-memory prisma.streak surface. */
class FakeStreakPrisma {
  streaks = new Map<string, FakeStreak>();

  readonly streak = {
    findUnique: (args: { where: { userId: string } }) =>
      Promise.resolve(this.streaks.get(args.where.userId) ?? null),
    upsert: (args: {
      where: { userId: string };
      create: FakeStreak;
      update: Partial<FakeStreak>;
    }) => {
      const existing = this.streaks.get(args.where.userId);
      if (existing) {
        Object.assign(existing, args.update);
        return Promise.resolve({ ...existing });
      }
      this.streaks.set(args.where.userId, { ...args.create });
      return Promise.resolve({ ...args.create });
    },
  };
}

describe('StreakService', () => {
  let prisma: FakeStreakPrisma;
  let ledger: FakeEngagementLedger;
  let config: FakeAppConfig;
  let referral: RecordingReferral;
  let notifications: RecordingNotificationHook;
  let service: StreakService;
  const userId = randomUUID();
  const REWARDS = [5, 10, 15, 20, 30, 40, 50];

  beforeEach(() => {
    prisma = new FakeStreakPrisma();
    ledger = new FakeEngagementLedger();
    config = new FakeAppConfig().set('streak.day_rewards', { days: REWARDS });
    referral = new RecordingReferral();
    notifications = new RecordingNotificationHook();
    service = new StreakService(
      prisma as unknown as PrismaService,
      ledger as unknown as LedgerService,
      config as unknown as AppConfigService,
      referral as unknown as ReferralService,
      notifications,
    );
  });

  it('first claim starts the streak at day 1 and credits day-1 reward', async () => {
    const result = await service.claim(userId);
    expect(result.streak_count).toBe(1);
    expect(result.coins_earned).toBe(REWARDS[0]);
    expect(result.new_balance).toBe(REWARDS[0]);
    expect(ledger.calls[0].idempotencyKey).toBe(`streak:${userId}:${istDateString()}`);
    expect(referral.calls).toHaveLength(1);
    expect(notifications.credited).toHaveLength(1);
    expect(notifications.credited[0]).toMatchObject({ userId, coins: REWARDS[0], sourceType: 'streak' });
  });

  it('a claim the day after continues the streak (day 2 reward)', async () => {
    prisma.streaks.set(userId, {
      userId,
      currentCount: 1,
      lastClaimDate: istDateStringToDate(istYesterdayString()),
    });
    const result = await service.claim(userId);
    expect(result.streak_count).toBe(2);
    expect(result.coins_earned).toBe(REWARDS[1]);
  });

  it('rejects a second claim on the same IST day (409) with no double credit', async () => {
    await service.claim(userId);
    await expect(service.claim(userId)).rejects.toMatchObject({ status: 409 });
    expect(ledger.calls).toHaveLength(1);
  });

  it('a gap of 2+ days resets the streak to day 1', async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    prisma.streaks.set(userId, {
      userId,
      currentCount: 5,
      lastClaimDate: istDateStringToDate(istDateString(threeDaysAgo)),
    });
    const result = await service.claim(userId);
    expect(result.streak_count).toBe(1);
    expect(result.coins_earned).toBe(REWARDS[0]);
  });

  it('cycles the reward table past day 7 (day 8 == day 1 reward)', async () => {
    prisma.streaks.set(userId, {
      userId,
      currentCount: 7,
      lastClaimDate: istDateStringToDate(istYesterdayString()),
    });
    const result = await service.claim(userId);
    expect(result.streak_count).toBe(8);
    expect(result.coins_earned).toBe(REWARDS[0]); // (8-1) % 7 == 0
  });

  it('getState reports claimable + the next bonus, then not-claimable after claiming', async () => {
    const before = await service.getState(userId);
    expect(before).toMatchObject({
      current_count: 0,
      last_claim_date: null,
      claimable_today: true,
      next_bonus: REWARDS[0],
    });

    await service.claim(userId);

    const after = await service.getState(userId);
    expect(after.current_count).toBe(1);
    expect(after.last_claim_date).toBe(istDateString());
    expect(after.claimable_today).toBe(false);
    expect(after.next_bonus).toBe(REWARDS[1]); // preview of tomorrow's continuation
  });
});
