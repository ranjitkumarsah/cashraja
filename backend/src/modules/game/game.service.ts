import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { GameRoundStatus, LedgerSourceType } from '@prisma/client';
import { AppConfigService } from '../../common/app-config/app-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { istDayStartUtc } from '../../common/time/ist-day';
import { FRAUD_SIGNAL_HOOK, FraudSignalHook } from '../fraud/fraud-signal.hook';
import { LedgerService } from '../ledger/ledger.service';
import { ReferralService } from '../referral/referral.service';
import { GameDifficulty } from './dto/round-start.dto';

const CFG = {
  dailyCap: 'game.daily_round_cap',
  coinsPerRound: 'game.coins_per_round',
  minPlaySeconds: 'game.min_play_seconds',
  roundExpirySeconds: 'game.round_expiry_seconds',
};

const DEFAULTS = {
  dailyCap: 20,
  coinsPerRound: { easy: 5, medium: 10, hard: 20 },
  minPlaySeconds: { easy: 10, medium: 20, hard: 30 },
  roundExpirySeconds: 120,
};

export interface RoundStartResult {
  round_id: string;
  difficulty: GameDifficulty;
  expires_at: string;
  daily_cap_remaining: number;
}

export interface RoundCompleteResult {
  coins_earned: number;
  new_balance: number;
  daily_cap_remaining: number;
}

/**
 * Number-pattern game (D1). Rounds are entirely server-issued and
 * server-scored: the client only reports a score for analytics, never for
 * rewards. Anti-abuse: per-IST-day cap enforced at start, single-use rounds
 * (anti-replay), expiry window, and a minimum play time that fires a
 * game-farming fraud signal when violated.
 */
@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly appConfig: AppConfigService,
    private readonly referral: ReferralService,
    @Inject(FRAUD_SIGNAL_HOOK) private readonly fraudSignal: FraudSignalHook,
  ) {}

  async roundStart(userId: string, difficulty: GameDifficulty): Promise<RoundStartResult> {
    const cap = await this.appConfig.getNumber(CFG.dailyCap, 'rounds', DEFAULTS.dailyCap);
    const usedToday = await this.countRoundsToday(userId);
    if (usedToday >= cap) {
      throw new HttpException(
        { message: 'daily_round_cap_reached', daily_cap_remaining: 0 },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const expirySeconds = await this.appConfig.getNumber(
      CFG.roundExpirySeconds,
      'seconds',
      DEFAULTS.roundExpirySeconds,
    );
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + expirySeconds * 1000);

    const round = await this.prisma.gameRound.create({
      data: {
        userId,
        difficulty,
        status: GameRoundStatus.issued,
        issuedAt,
        expiresAt,
      },
    });

    return {
      round_id: round.id,
      difficulty,
      expires_at: expiresAt.toISOString(),
      daily_cap_remaining: Math.max(0, cap - (usedToday + 1)),
    };
  }

  async roundComplete(
    userId: string,
    roundId: string,
    _clientScore: number,
  ): Promise<RoundCompleteResult> {
    const round = await this.prisma.gameRound.findUnique({ where: { id: roundId } });
    if (!round) {
      throw new NotFoundException('Round not found');
    }
    if (round.userId !== userId) {
      // Never act on another user's round.
      throw new ForbiddenException('Round does not belong to this user');
    }
    if (round.status !== GameRoundStatus.issued) {
      // Anti-replay: already completed (or expired) rounds cannot be re-claimed.
      throw new HttpException('round_not_active', HttpStatus.CONFLICT);
    }

    const now = new Date();
    if (round.expiresAt && now.getTime() > round.expiresAt.getTime()) {
      await this.markExpired(roundId);
      throw new HttpException('round_expired', HttpStatus.GONE);
    }

    const difficulty = this.normalizeDifficulty(round.difficulty);
    const minSeconds = await this.appConfig.getNumber(
      CFG.minPlaySeconds,
      difficulty,
      DEFAULTS.minPlaySeconds[difficulty],
    );
    const elapsedSeconds = (now.getTime() - round.issuedAt.getTime()) / 1000;
    if (elapsedSeconds < minSeconds) {
      // Game-farming signal: completion faster than the minimum play time.
      await this.fraudSignal.report({
        userId,
        rule: 'game_farming',
        details: { roundId, elapsedSeconds, minSeconds },
      });
      throw new BadRequestException('round_completed_too_fast');
    }

    const coins = await this.appConfig.getNumber(
      CFG.coinsPerRound,
      difficulty,
      DEFAULTS.coinsPerRound[difficulty],
    );

    const credit = await this.ledger.record({
      userId,
      amount: coins,
      sourceType: LedgerSourceType.game,
      sourceRefId: roundId,
      idempotencyKey: `game:${roundId}`,
    });

    // Atomically flip issued → completed (guards against a concurrent double).
    await this.prisma.gameRound.updateMany({
      where: { id: roundId, status: GameRoundStatus.issued },
      data: { status: GameRoundStatus.completed, completedAt: now },
    });

    // Referral fan-out on the earning (best-effort, idempotent).
    await this.referral.onUserEarned({ userId, amount: coins, sourceLedgerId: credit.entry.id });

    const usedToday = await this.countRoundsToday(userId);
    const cap = await this.appConfig.getNumber(CFG.dailyCap, 'rounds', DEFAULTS.dailyCap);
    return {
      coins_earned: coins,
      new_balance: credit.entry.balanceAfter,
      daily_cap_remaining: Math.max(0, cap - usedToday),
    };
  }

  private async countRoundsToday(userId: string): Promise<number> {
    return this.prisma.gameRound.count({
      where: { userId, issuedAt: { gte: istDayStartUtc() } },
    });
  }

  private async markExpired(roundId: string): Promise<void> {
    await this.prisma.gameRound.updateMany({
      where: { id: roundId, status: GameRoundStatus.issued },
      data: { status: GameRoundStatus.expired },
    });
  }

  private static readonly KNOWN_DIFFICULTIES: ReadonlySet<string> = new Set([
    GameDifficulty.easy,
    GameDifficulty.medium,
    GameDifficulty.hard,
  ]);

  private normalizeDifficulty(value: string): GameDifficulty {
    return GameService.KNOWN_DIFFICULTIES.has(value)
      ? (value as GameDifficulty)
      : GameDifficulty.easy;
  }
}
