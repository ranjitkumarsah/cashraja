import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { LedgerSourceType } from '@prisma/client';
import { AppConfigService } from '../../common/app-config/app-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  dateColumnToString,
  istDateString,
  istDateStringToDate,
  istYesterdayString,
} from '../../common/time/ist-day';
import { LedgerService } from '../ledger/ledger.service';
import { ReferralService } from '../referral/referral.service';

const STREAK_REWARDS_KEY = 'streak.day_rewards';
const DEFAULT_DAY_REWARDS = [5, 10, 15, 20, 30, 40, 50];

export interface StreakStateView {
  current_count: number;
  last_claim_date: string | null;
  claimable_today: boolean;
  next_bonus: number;
}

export interface StreakClaimResult {
  streak_count: number;
  coins_earned: number;
  new_balance: number;
}

interface StreakRow {
  currentCount: number;
  lastClaimDate: Date;
}

interface NextClaim {
  newCount: number;
  reward: number;
  claimableToday: boolean;
}

/**
 * Daily login streak (D2). Days are IST calendar days. A claim the day after
 * the last one continues the streak; a gap resets it to day 1; a second claim
 * on the same IST day is rejected. The per-day reward cycles day1..N from
 * app_config (streak.day_rewards) and repeats. The `streak:<user>:<IST-date>`
 * ledger idempotency key is the hard guarantee of one claim per day even under
 * concurrent requests.
 */
@Injectable()
export class StreakService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly appConfig: AppConfigService,
    private readonly referral: ReferralService,
  ) {}

  async getState(userId: string): Promise<StreakStateView> {
    const streak = await this.prisma.streak.findUnique({ where: { userId } });
    const rewards = await this.dayRewards();
    const next = this.nextClaim(streak, rewards);
    return {
      current_count: streak?.currentCount ?? 0,
      last_claim_date: streak ? dateColumnToString(streak.lastClaimDate) : null,
      claimable_today: next.claimableToday,
      next_bonus: next.reward,
    };
  }

  async claim(userId: string): Promise<StreakClaimResult> {
    const today = istDateString();
    const rewards = await this.dayRewards();
    const streak = await this.prisma.streak.findUnique({ where: { userId } });
    const next = this.nextClaim(streak, rewards);
    if (!next.claimableToday) {
      throw new HttpException('streak_already_claimed_today', HttpStatus.CONFLICT);
    }

    // Hard idempotency: one credit per user per IST day. A racing second claim
    // gets duplicate=true here and is rejected without bumping the streak.
    const credit = await this.ledger.record({
      userId,
      amount: next.reward,
      sourceType: LedgerSourceType.streak,
      sourceRefId: today,
      idempotencyKey: `streak:${userId}:${today}`,
    });
    if (credit.duplicate) {
      throw new HttpException('streak_already_claimed_today', HttpStatus.CONFLICT);
    }

    await this.prisma.streak.upsert({
      where: { userId },
      create: { userId, currentCount: next.newCount, lastClaimDate: istDateStringToDate(today) },
      update: { currentCount: next.newCount, lastClaimDate: istDateStringToDate(today) },
    });

    await this.referral.onUserEarned({
      userId,
      amount: next.reward,
      sourceLedgerId: credit.entry.id,
    });

    return {
      streak_count: next.newCount,
      coins_earned: next.reward,
      new_balance: credit.entry.balanceAfter,
    };
  }

  /**
   * Determine the outcome of a claim made now, given the stored streak:
   *   - no streak / gap  → resets to day 1
   *   - claimed yesterday → continues (count + 1)
   *   - claimed today     → not claimable; preview the next day's reward
   * The reward cycles through the config array and repeats.
   */
  private nextClaim(streak: StreakRow | null, rewards: number[]): NextClaim {
    const today = istDateString();
    const yesterday = istYesterdayString();

    if (!streak) {
      return { newCount: 1, reward: this.rewardFor(1, rewards), claimableToday: true };
    }
    const lastDate = dateColumnToString(streak.lastClaimDate);
    if (lastDate === today) {
      // already claimed today — preview tomorrow's continuation reward
      const continued = streak.currentCount + 1;
      return { newCount: continued, reward: this.rewardFor(continued, rewards), claimableToday: false };
    }
    if (lastDate === yesterday) {
      const continued = streak.currentCount + 1;
      return { newCount: continued, reward: this.rewardFor(continued, rewards), claimableToday: true };
    }
    // gap of 2+ IST days — streak broke, restart at day 1
    return { newCount: 1, reward: this.rewardFor(1, rewards), claimableToday: true };
  }

  /** Reward for the 1-based streak day, cycling through the config array. */
  private rewardFor(dayCount: number, rewards: number[]): number {
    const index = (dayCount - 1) % rewards.length;
    return rewards[index];
  }

  private async dayRewards(): Promise<number[]> {
    const value = await this.appConfig.get(STREAK_REWARDS_KEY);
    if (value !== null && typeof value === 'object') {
      const days = (value as Record<string, unknown>).days;
      if (Array.isArray(days)) {
        const nums = days.filter((d): d is number => typeof d === 'number');
        if (nums.length > 0 && nums.length === days.length) {
          return nums;
        }
      }
    }
    return DEFAULT_DAY_REWARDS;
  }
}
