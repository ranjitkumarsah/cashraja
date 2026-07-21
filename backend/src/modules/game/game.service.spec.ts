import { randomUUID } from 'node:crypto';
import { GameRoundStatus } from '@prisma/client';
import { AppConfigService } from '../../common/app-config/app-config.service';
import {
  FakeAppConfig,
  FakeEngagementLedger,
  RecordingFraudSignal,
  RecordingReferral,
} from '../../common/testing/engagement-fakes';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { ReferralService } from '../referral/referral.service';
import { GameDifficulty } from './dto/round-start.dto';
import { GameService } from './game.service';

interface FakeRound {
  id: string;
  userId: string;
  difficulty: string;
  status: GameRoundStatus;
  issuedAt: Date;
  expiresAt: Date | null;
  completedAt: Date | null;
}

/** Minimal in-memory prisma.gameRound surface used by GameService. */
class FakeGamePrisma {
  rounds: FakeRound[] = [];

  seedRound(partial: Partial<FakeRound> & { userId: string }): FakeRound {
    const round: FakeRound = {
      id: randomUUID(),
      difficulty: GameDifficulty.easy,
      status: GameRoundStatus.issued,
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 120_000),
      completedAt: null,
      ...partial,
    };
    this.rounds.push(round);
    return round;
  }

  readonly gameRound = {
    create: (args: { data: Omit<FakeRound, 'id' | 'completedAt'> }) => {
      const round: FakeRound = { id: randomUUID(), completedAt: null, ...args.data };
      this.rounds.push(round);
      return Promise.resolve({ ...round });
    },
    findUnique: (args: { where: { id: string } }) =>
      Promise.resolve(this.rounds.find((r) => r.id === args.where.id) ?? null),
    updateMany: (args: {
      where: { id: string; status: GameRoundStatus };
      data: Partial<FakeRound>;
    }) => {
      let count = 0;
      for (const r of this.rounds) {
        if (r.id === args.where.id && r.status === args.where.status) {
          Object.assign(r, args.data);
          count += 1;
        }
      }
      return Promise.resolve({ count });
    },
    count: (args: { where: { userId: string; issuedAt: { gte: Date } } }) =>
      Promise.resolve(
        this.rounds.filter(
          (r) => r.userId === args.where.userId && r.issuedAt >= args.where.issuedAt.gte,
        ).length,
      ),
  };
}

describe('GameService', () => {
  let prisma: FakeGamePrisma;
  let ledger: FakeEngagementLedger;
  let config: FakeAppConfig;
  let referral: RecordingReferral;
  let fraud: RecordingFraudSignal;
  let service: GameService;
  const userId = randomUUID();

  beforeEach(() => {
    prisma = new FakeGamePrisma();
    ledger = new FakeEngagementLedger();
    config = new FakeAppConfig()
      .set('game.daily_round_cap', { rounds: 3 })
      .set('game.coins_per_round', { easy: 5, medium: 10, hard: 20 })
      .set('game.min_play_seconds', { easy: 10, medium: 20, hard: 30 })
      .set('game.round_expiry_seconds', { seconds: 120 });
    referral = new RecordingReferral();
    fraud = new RecordingFraudSignal();
    service = new GameService(
      prisma as unknown as PrismaService,
      ledger as unknown as LedgerService,
      config as unknown as AppConfigService,
      referral as unknown as ReferralService,
      fraud,
    );
  });

  const startedRoundAgo = (seconds: number, difficulty = GameDifficulty.easy): FakeRound =>
    prisma.seedRound({
      userId,
      difficulty,
      issuedAt: new Date(Date.now() - seconds * 1000),
      expiresAt: new Date(Date.now() + 60_000),
    });

  it('round-start issues a round with a future expiry and decrements remaining', async () => {
    const result = await service.roundStart(userId, GameDifficulty.medium);
    expect(result.round_id).toBeDefined();
    expect(result.difficulty).toBe(GameDifficulty.medium);
    expect(new Date(result.expires_at).getTime()).toBeGreaterThan(Date.now());
    expect(result.daily_cap_remaining).toBe(2); // cap 3, one issued
    expect(prisma.rounds).toHaveLength(1);
    expect(prisma.rounds[0].status).toBe(GameRoundStatus.issued);
  });

  it('enforces the daily round cap at start (429)', async () => {
    await service.roundStart(userId, GameDifficulty.easy);
    await service.roundStart(userId, GameDifficulty.easy);
    await service.roundStart(userId, GameDifficulty.easy);
    await expect(service.roundStart(userId, GameDifficulty.easy)).rejects.toMatchObject({
      status: 429,
    });
    expect(prisma.rounds).toHaveLength(3);
  });

  it('completes a round after min-play-time and credits difficulty-scaled coins', async () => {
    const round = startedRoundAgo(35, GameDifficulty.hard); // hard min is 30s
    const result = await service.roundComplete(userId, round.id, 999);
    expect(result.coins_earned).toBe(20); // hard
    expect(result.new_balance).toBe(20);
    expect(ledger.calls[0].idempotencyKey).toBe(`game:${round.id}`);
    expect(prisma.rounds[0].status).toBe(GameRoundStatus.completed);
    // referral fan-out fired for the earning
    expect(referral.calls).toHaveLength(1);
    expect(referral.calls[0]).toMatchObject({ userId, amount: 20 });
    expect(referral.calls[0].sourceLedgerId).toEqual(expect.any(String));
  });

  it('rejects replay: a completed round cannot be completed again (409)', async () => {
    const round = startedRoundAgo(15);
    await service.roundComplete(userId, round.id, 100);
    await expect(service.roundComplete(userId, round.id, 100)).rejects.toMatchObject({
      status: 409,
    });
    expect(ledger.calls).toHaveLength(1); // credited exactly once
  });

  it('rejects a too-fast completion and fires the game_farming fraud signal', async () => {
    const round = startedRoundAgo(2); // < 10s min for easy
    await expect(service.roundComplete(userId, round.id, 100)).rejects.toMatchObject({
      status: 400,
    });
    expect(ledger.calls).toHaveLength(0); // no credit
    expect(fraud.signals).toHaveLength(1);
    expect(fraud.signals[0]).toMatchObject({ userId, rule: 'game_farming' });
    expect(prisma.rounds[0].status).toBe(GameRoundStatus.issued); // still open
  });

  it('rejects an expired round and marks it expired (410)', async () => {
    const round = prisma.seedRound({
      userId,
      issuedAt: new Date(Date.now() - 300_000),
      expiresAt: new Date(Date.now() - 60_000),
    });
    await expect(service.roundComplete(userId, round.id, 100)).rejects.toMatchObject({
      status: 410,
    });
    expect(prisma.rounds[0].status).toBe(GameRoundStatus.expired);
    expect(ledger.calls).toHaveLength(0);
  });

  it('rejects completing another user’s round (403)', async () => {
    const round = startedRoundAgo(15);
    round.userId = randomUUID(); // belongs to someone else
    await expect(service.roundComplete(userId, round.id, 100)).rejects.toMatchObject({
      status: 403,
    });
    expect(ledger.calls).toHaveLength(0);
  });

  it('rejects an unknown round (404)', async () => {
    await expect(service.roundComplete(userId, randomUUID(), 100)).rejects.toMatchObject({
      status: 404,
    });
  });
});
