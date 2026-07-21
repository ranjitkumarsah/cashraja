/**
 * Phase D (engagement) over HTTP against real Postgres:
 *   - streak claim credits + rejects a same-day double-claim
 *   - bonus play credits a server-rolled prize and enforces the daily cap
 *   - game round-complete credits, is anti-replay, and rejects a foreign round
 *   - referral fan-out: a referred user's earning credits the referrer the
 *     snapshot percent, keyed on the source earning (idempotent)
 *   - referral my-code / stats endpoints
 *
 * Auto-skips unless DATABASE_URL is reachable. Redis is not required (no queue
 * work here); the app boots with the worker disabled.
 */
import './support/worker-off';
import './support/test-env';
import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';
import { BonusKind, GameRoundStatus, LedgerSourceType, UserStatus } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { APP_AUDIENCE } from '../src/common/auth';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { LedgerService } from '../src/modules/ledger/ledger.service';
import { isDatabaseReachable } from './support/db-reachable';

const describeIt = isDatabaseReachable() ? describe : describe.skip;
jest.setTimeout(120_000);

describeIt('Engagement (integration, HTTP + Postgres)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ledger: LedgerService;
  let jwt: JwtService;
  let config: ConfigService;
  let server: App;
  const userIds: string[] = [];

  const jwtFor = (userId: string): Promise<string> =>
    jwt.signAsync(
      { sub: userId },
      { secret: config.get<string>('JWT_ACCESS_SECRET'), audience: APP_AUDIENCE, expiresIn: '15m' },
    );

  async function makeUser(status: UserStatus = UserStatus.active): Promise<string> {
    const id = randomUUID();
    await prisma.user.create({
      data: {
        id,
        googleUid: `eng-${id}`,
        email: `eng-${id}@test.local`,
        displayName: 'Engagement IT',
        country: 'IN',
        status,
        referralCode: `EG${id.slice(0, 10)}`,
      },
    });
    userIds.push(id);
    return id;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api', { exclude: ['healthz', 'readyz'] });
    await app.init();
    prisma = app.get(PrismaService);
    ledger = app.get(LedgerService);
    jwt = app.get(JwtService);
    config = app.get(ConfigService);
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    try {
      await prisma.referralEarning.deleteMany({
        where: { referral: { referrerId: { in: userIds } } },
      });
      await prisma.referral.deleteMany({
        where: { OR: [{ referrerId: { in: userIds } }, { referredId: { in: userIds } }] },
      });
      await prisma.gameRound.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.streak.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.bonusAttempt.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.coinLedger.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await app.close();
    }
  });

  it('streak claim credits, then rejects a same-day double-claim', async () => {
    const userId = await makeUser();
    const token = await jwtFor(userId);

    const first = await request(server)
      .post('/api/streak/claim')
      .set('authorization', `Bearer ${token}`)
      .expect(201);
    expect(first.body.streak_count).toBe(1);
    expect(first.body.coins_earned).toBeGreaterThan(0);
    expect(first.body.new_balance).toBe(first.body.coins_earned);

    await request(server)
      .post('/api/streak/claim')
      .set('authorization', `Bearer ${token}`)
      .expect(409);

    const state = await request(server)
      .get('/api/streak')
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(state.body.claimable_today).toBe(false);
    expect(state.body.current_count).toBe(1);
  });

  it('bonus play credits a server-rolled prize and enforces the daily cap', async () => {
    const userId = await makeUser();
    const token = await jwtFor(userId);

    // scratch is seeded with 3 attempts/day.
    const state = await request(server)
      .get('/api/bonus/scratch')
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    const perDay: number = state.body.attempts_per_day;
    expect(perDay).toBeGreaterThan(0);

    for (let i = 0; i < perDay; i++) {
      const play = await request(server)
        .post('/api/bonus/scratch/play')
        .set('authorization', `Bearer ${token}`)
        .expect(201);
      expect(play.body.prize_coins).toBeGreaterThanOrEqual(0);
    }
    // over the cap now
    await request(server)
      .post('/api/bonus/scratch/play')
      .set('authorization', `Bearer ${token}`)
      .expect(429);

    const attempts = await prisma.bonusAttempt.count({ where: { userId, kind: BonusKind.scratch } });
    expect(attempts).toBe(perDay);
  });

  it('game round-complete credits once, is anti-replay, and rejects a foreign round', async () => {
    const userId = await makeUser();
    const token = await jwtFor(userId);

    // Insert a round issued well in the past so min-play-time passes deterministically.
    const round = await prisma.gameRound.create({
      data: {
        userId,
        difficulty: 'hard',
        status: GameRoundStatus.issued,
        issuedAt: new Date(Date.now() - 5 * 60_000),
        expiresAt: new Date(Date.now() + 5 * 60_000),
      },
    });

    const done = await request(server)
      .post('/api/game/round-complete')
      .set('authorization', `Bearer ${token}`)
      .send({ round_id: round.id, client_score: 4242 })
      .expect(201);
    expect(done.body.coins_earned).toBeGreaterThan(0);
    expect(done.body.new_balance).toBe(done.body.coins_earned);

    // replay → 409, no second credit
    await request(server)
      .post('/api/game/round-complete')
      .set('authorization', `Bearer ${token}`)
      .send({ round_id: round.id, client_score: 4242 })
      .expect(409);

    // another user cannot complete this round
    const strangerToken = await jwtFor(await makeUser());
    const strangerRound = await prisma.gameRound.create({
      data: {
        userId,
        difficulty: 'easy',
        status: GameRoundStatus.issued,
        issuedAt: new Date(Date.now() - 5 * 60_000),
        expiresAt: new Date(Date.now() + 5 * 60_000),
      },
    });
    await request(server)
      .post('/api/game/round-complete')
      .set('authorization', `Bearer ${strangerToken}`)
      .send({ round_id: strangerRound.id, client_score: 1 })
      .expect(403);

    expect(await ledger.getBalance(userId)).toBe(done.body.coins_earned);
  });

  it('referral fan-out credits the referrer the snapshot percent of a referred earning', async () => {
    const referrerId = await makeUser();
    const referredId = await makeUser();
    // 50% snapshot so a small streak reward still floors to a positive bonus.
    await prisma.referral.create({
      data: {
        referrerId,
        referredId,
        bonusPercent: 50,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    const referredToken = await jwtFor(referredId);

    const claim = await request(server)
      .post('/api/streak/claim')
      .set('authorization', `Bearer ${referredToken}`)
      .expect(201);
    const earned: number = claim.body.coins_earned;
    const expectedBonus = Math.floor((earned * 50) / 100);

    // fan-out is awaited inside the credit path, so it is visible immediately.
    expect(await ledger.getBalance(referrerId)).toBe(expectedBonus);
    const earnings = await prisma.referralEarning.findMany({
      where: { referral: { referrerId } },
    });
    expect(earnings).toHaveLength(1);

    // referrer's referral-source ledger row exists exactly once (idempotent)
    const refCredits = await prisma.coinLedger.count({
      where: { userId: referrerId, sourceType: LedgerSourceType.referral },
    });
    expect(refCredits).toBe(1);

    // stats endpoint reflects it
    const referrerToken = await jwtFor(referrerId);
    const stats = await request(server)
      .get('/api/referral/stats')
      .set('authorization', `Bearer ${referrerToken}`)
      .expect(200);
    expect(stats.body).toMatchObject({
      referred_count: 1,
      active_referrals: 1,
      total_earned_from_referrals: expectedBonus,
    });

    const myCode = await request(server)
      .get('/api/referral/my-code')
      .set('authorization', `Bearer ${referrerToken}`)
      .expect(200);
    expect(typeof myCode.body.code).toBe('string');
  });
});
