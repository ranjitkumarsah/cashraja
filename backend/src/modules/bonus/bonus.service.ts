import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BonusKind, LedgerSourceType, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { istDayStartUtc } from '../../common/time/ist-day';
import { LedgerService } from '../ledger/ledger.service';
import { ReferralService } from '../referral/referral.service';
import {
  BONUS_RANDOM_INT,
  parseWeightedTable,
  RandomIntFn,
  rollWeighted,
} from './bonus-roll';

export interface BonusStateView {
  type: BonusKind;
  attempts_remaining: number;
  attempts_per_day: number;
  unlocked: boolean;
}

export interface BonusPlayResult {
  prize_coins: number;
  new_balance: number;
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
  ) {}

  async getState(userId: string, kind: BonusKind): Promise<BonusStateView> {
    const config = await this.latestConfig(kind);
    const usedToday = await this.countAttemptsToday(userId, kind);
    return {
      type: kind,
      attempts_per_day: config.attemptsPerDay,
      attempts_remaining: Math.max(0, config.attemptsPerDay - usedToday),
      unlocked: true,
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
