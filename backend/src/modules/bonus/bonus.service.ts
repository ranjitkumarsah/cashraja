import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { BonusKind, LedgerSourceType, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { istDayStartUtc } from '../../common/time/ist-day';
import { LedgerService } from '../ledger/ledger.service';
import { NOTIFICATION_HOOK, NotificationHook } from '../notifications/notification-hook';
import { ReferralService } from '../referral/referral.service';
import {
  BONUS_RANDOM_INT,
  distinctPrizes,
  parseWeightedTable,
  RandomIntFn,
  rollWeighted,
} from './bonus-roll';

export interface BonusStateView {
  type: BonusKind;
  attempts_remaining: number;
  attempts_per_day: number;
  unlocked: boolean;
  /** Distinct possible prize amounts — powers the spin-wheel segments. */
  prizes: number[];
}

export interface BonusPlayResult {
  prize_coins: number;
  new_balance: number;
  attempts_remaining: number;
}

/**
 * Result of a spin "roll" — the server has decided (and reserved) the prize but
 * has NOT credited it. The wheel animates to land on [prize_coins]; the coins
 * are only credited when the client calls {@link BonusService.claim} with
 * [reservation_id] after a completed rewarded ad.
 */
export interface BonusRollResult {
  reservation_id: string;
  prize_coins: number;
  attempts_remaining: number;
}

/**
 * Scratch card / spin wheel (D3). The prize is rolled server-side against the
 * versioned bonus_config weighted table using a CSPRNG — the client body can
 * never influence the outcome. Daily attempts are capped per kind; the unlock
 * gate is a stub (always available) that Phase E wires to ad-view / streak
 * milestones.
 */
@Injectable()
export class BonusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly referral: ReferralService,
    @Inject(BONUS_RANDOM_INT) private readonly randomInt: RandomIntFn,
    @Optional() @Inject(NOTIFICATION_HOOK) private readonly notifications?: NotificationHook,
  ) {}

  async getState(userId: string, kind: BonusKind): Promise<BonusStateView> {
    const config = await this.latestConfig(kind);
    const usedToday = await this.countAttemptsToday(userId, kind);
    return {
      type: kind,
      attempts_per_day: config.attemptsPerDay,
      attempts_remaining: Math.max(0, config.attemptsPerDay - usedToday),
      unlocked: true,
      prizes: distinctPrizes(parseWeightedTable(config.weightedTable)),
    };
  }

  /**
   * Step one of the two-step spin (D3/G6). Enforces the daily cap, rolls the
   * prize server-side, and RESERVES it by persisting a {@link BonusAttempt}
   * (which consumes the daily attempt) — but does NOT credit. The client then
   * animates the wheel to land on the returned prize and, only after a completed
   * rewarded ad, calls {@link claim} to bank it. Closing/forfeiting simply never
   * claims, so the reserved prize is never credited. The client body cannot
   * influence the outcome.
   */
  async roll(userId: string, kind: BonusKind): Promise<BonusRollResult> {
    const config = await this.latestConfig(kind);
    const usedToday = await this.countAttemptsToday(userId, kind);
    if (usedToday >= config.attemptsPerDay) {
      throw new HttpException(
        { message: 'bonus_attempt_limit_reached', attempts_remaining: 0 },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const table = parseWeightedTable(config.weightedTable);
    const prizeCoins = rollWeighted(table, this.randomInt);

    const attempt = await this.prisma.bonusAttempt.create({
      data: { userId, kind, resultCoins: prizeCoins },
    });

    return {
      reservation_id: attempt.id,
      prize_coins: prizeCoins,
      attempts_remaining: Math.max(0, config.attemptsPerDay - (usedToday + 1)),
    };
  }

  /**
   * Step two of the two-step spin: credit a prize previously reserved by
   * {@link roll}. Called only after the user watched the rewarded ad. The coin
   * amount comes from the persisted attempt (server-rolled) — never the client.
   * Idempotent: the ledger idempotency key `bonus:<attemptId>` guarantees a
   * given reservation credits at most once even under retries/double-taps.
   */
  async claim(userId: string, reservationId: string): Promise<BonusPlayResult> {
    const attempt = await this.prisma.bonusAttempt.findUnique({
      where: { id: reservationId },
    });
    if (!attempt || attempt.userId !== userId) {
      throw new NotFoundException('bonus_reservation_not_found');
    }
    const config = await this.latestConfig(attempt.kind);
    const usedToday = await this.countAttemptsToday(userId, attempt.kind);
    const prizeCoins = attempt.resultCoins;

    let newBalance: number;
    if (prizeCoins > 0) {
      const credit = await this.ledger.record({
        userId,
        amount: prizeCoins,
        sourceType: LedgerSourceType.bonus,
        sourceRefId: attempt.id,
        idempotencyKey: `bonus:${attempt.id}`,
      });
      newBalance = credit.entry.balanceAfter;
      // Only fan out to referral/notifications on the first (non-duplicate)
      // credit so a re-claim never double-counts.
      if (!credit.duplicate) {
        await this.referral.onUserEarned({ userId, amount: prizeCoins, sourceLedgerId: credit.entry.id });
        await this.notifications?.onCredited({
          userId,
          coins: prizeCoins,
          sourceType: LedgerSourceType.bonus,
          sourceRefId: credit.entry.id,
        });
      }
    } else {
      newBalance = await this.ledger.getCachedBalance(userId);
    }

    return {
      prize_coins: prizeCoins,
      new_balance: newBalance,
      attempts_remaining: Math.max(0, config.attemptsPerDay - usedToday),
    };
  }

  async play(userId: string, kind: BonusKind): Promise<BonusPlayResult> {
    const config = await this.latestConfig(kind);
    const usedToday = await this.countAttemptsToday(userId, kind);
    if (usedToday >= config.attemptsPerDay) {
      throw new HttpException(
        { message: 'bonus_attempt_limit_reached', attempts_remaining: 0 },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    // Unlock gate (ad-view / streak milestone) — stub: always available in Phase D.

    const table = parseWeightedTable(config.weightedTable);
    const prizeCoins = rollWeighted(table, this.randomInt);

    const attempt = await this.prisma.bonusAttempt.create({
      data: { userId, kind, resultCoins: prizeCoins },
    });

    let newBalance: number;
    if (prizeCoins > 0) {
      const credit = await this.ledger.record({
        userId,
        amount: prizeCoins,
        sourceType: LedgerSourceType.bonus,
        sourceRefId: attempt.id,
        idempotencyKey: `bonus:${attempt.id}`,
      });
      newBalance = credit.entry.balanceAfter;
      await this.referral.onUserEarned({ userId, amount: prizeCoins, sourceLedgerId: credit.entry.id });
      await this.notifications?.onCredited({
        userId,
        coins: prizeCoins,
        sourceType: LedgerSourceType.bonus,
        sourceRefId: credit.entry.id,
      });
    } else {
      newBalance = await this.ledger.getCachedBalance(userId);
    }

    return {
      prize_coins: prizeCoins,
      new_balance: newBalance,
      attempts_remaining: Math.max(0, config.attemptsPerDay - (usedToday + 1)),
    };
  }

  private async latestConfig(
    kind: BonusKind,
  ): Promise<{ attemptsPerDay: number; weightedTable: Prisma.JsonValue }> {
    const config = await this.prisma.bonusConfig.findFirst({
      where: { kind },
      orderBy: { version: 'desc' },
      select: { attemptsPerDay: true, weightedTable: true },
    });
    if (!config) {
      throw new NotFoundException(`No bonus_config for ${kind}`);
    }
    return config;
  }

  private async countAttemptsToday(userId: string, kind: BonusKind): Promise<number> {
    return this.prisma.bonusAttempt.count({
      where: { userId, kind, createdAt: { gte: istDayStartUtc() } },
    });
  }
}
