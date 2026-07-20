/**
 * B2.4 / B3.3 — full postback pipeline over HTTP against real Postgres+Redis:
 * signed POST → completion row → BullMQ worker drains → ledger credited →
 * wallet reflects it; replay dedupe (E2E #4, via HTTP this time); bad
 * signature → 401 and NO row; ad SSV flow with the daily cap.
 *
 * Auto-skips unless DATABASE_URL and REDIS_URL are set and reachable:
 *   docker compose up -d postgres redis && npx prisma migrate deploy
 *   then run tests with DATABASE_URL/REDIS_URL exported (see backend/.env).
 */
import './support/worker-on'; // in-process worker drains the queue (must precede postback-app)
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { OfferCompletionStatus, OfferNetwork } from '@prisma/client';
import { AppConfigService } from '../src/common/app-config/app-config.service';
import { MOCK_SIGNATURE_HEADER } from '../src/providers/offerwall/mock-offerwall.adapter';
import { MOCK_AD_SIGNATURE_HEADER } from '../src/providers/ad-ssv/mock-ad-ssv.adapter';
import { isDatabaseReachable } from './support/db-reachable';
import { isRedisReachable } from './support/redis-reachable';
import {
  createPostbackTestApp,
  eventually,
  PostbackTestApp,
  signAdSsvBody,
  signOfferwallBody,
} from './support/postback-app';

const describeIt = isDatabaseReachable() && isRedisReachable() ? describe : describe.skip;

jest.setTimeout(120_000);

describeIt('Postback pipeline (integration, HTTP + Postgres + Redis)', () => {
  let harness: PostbackTestApp;
  let server: App;

  beforeAll(async () => {
    harness = await createPostbackTestApp();
    server = harness.server as App;
  });

  afterAll(async () => {
    await harness.close();
  });

  function postOfferwall(
    body: Record<string, unknown>,
    opts: { badSig?: boolean } = {},
  ): request.Test {
    const json = JSON.stringify(body);
    let sig = signOfferwallBody(json, harness.offerwallSecret);
    if (opts.badSig) sig = sig.replace(/^./, sig.startsWith('0') ? '1' : '0');
    return request(server)
      .post('/api/webhooks/offerwall/mock')
      .set('content-type', 'application/json')
      .set(MOCK_SIGNATURE_HEADER, sig)
      .send(json);
  }

  function postAd(body: Record<string, unknown>): request.Test {
    const json = JSON.stringify(body);
    return request(server)
      .post('/api/webhooks/ads/mock')
      .set('content-type', 'application/json')
      .set(MOCK_AD_SIGNATURE_HEADER, signAdSsvBody(json, harness.adSsvSecret))
      .send(json);
  }

  it('signed postback → pending row → worker credits → wallet reflects it', async () => {
    const userId = await harness.createUser();
    const txn = `it-${randomUUID()}`;

    const res = await postOfferwall({ user_id: userId, txn_id: txn, coins: 130 }).expect(200);
    expect(res.body).toMatchObject({ status: 'accepted' });

    // Row was durable before the 200 (fast-accept contract)
    const row = await harness.prisma.offerCompletion.findUnique({
      where: { network_externalTxnId: { network: 'mock', externalTxnId: txn } },
    });
    expect(row).toMatchObject({ userId, coinReward: 130 });

    // Worker drains async → credited + ledger row with the canonical key
    const credited = await eventually(
      () =>
        harness.prisma.offerCompletion.findFirst({
          where: { id: row!.id, status: OfferCompletionStatus.credited },
        }),
      'completion credited',
    );
    expect(credited.creditedAt).not.toBeNull();

    const ledger = await harness.prisma.coinLedger.findUnique({
      where: { idempotencyKey: `mock:${txn}` },
    });
    expect(ledger).toMatchObject({ userId, amount: 130, sourceType: 'offer' });

    const token = await harness.appJwtFor(userId);
    const wallet = await request(server)
      .get('/api/wallet')
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(wallet.body).toMatchObject({ coin_balance: 130, pending_offer_credits: 0 });
    expect(wallet.body.recent_ledger_entries[0]).toMatchObject({
      amount: 130,
      source_type: 'offer',
    });
  });

  it('replayed postback (same txn) credits exactly once — E2E #4 via HTTP', async () => {
    const userId = await harness.createUser();
    const txn = `it-${randomUUID()}`;
    const body = { user_id: userId, txn_id: txn, coins: 75 };

    const first = await postOfferwall(body).expect(200);
    expect(first.body.status).toBe('accepted');

    // Concurrent + sequential replays, all 200
    const replays = await Promise.all([postOfferwall(body), postOfferwall(body)]);
    for (const replay of replays) {
      expect(replay.status).toBe(200);
      expect(['accepted', 'duplicate']).toContain((replay.body as { status: string }).status);
    }
    const third = await postOfferwall(body).expect(200);
    expect(third.body.status).toBe('duplicate');

    await eventually(
      () => harness.prisma.coinLedger.findUnique({ where: { idempotencyKey: `mock:${txn}` } }),
      'ledger credit',
    );
    // Give any duplicate jobs a moment, then assert single row + single credit
    await new Promise((resolve) => setTimeout(resolve, 1_000));

    const completions = await harness.prisma.offerCompletion.findMany({
      where: { userId, externalTxnId: txn },
    });
    expect(completions).toHaveLength(1);
    const ledgerRows = await harness.prisma.coinLedger.findMany({ where: { userId } });
    expect(ledgerRows).toHaveLength(1);
    expect(ledgerRows[0].amount).toBe(75);
  });

  it('bad signature → 401 and NO completion row', async () => {
    const userId = await harness.createUser();
    const txn = `it-${randomUUID()}`;

    await postOfferwall({ user_id: userId, txn_id: txn, coins: 999 }, { badSig: true }).expect(401);
    await request(server).post('/api/webhooks/offerwall/mock').send({ any: 'thing' }).expect(401);

    const row = await harness.prisma.offerCompletion.findUnique({
      where: { network_externalTxnId: { network: 'mock', externalTxnId: txn } },
    });
    expect(row).toBeNull();
  });

  it('unknown/disabled network → 404; unknown user → 200 rejected without a row', async () => {
    await request(server).post('/api/webhooks/offerwall/no-such-net').send({}).expect(404);
    await request(server).post('/api/webhooks/offerwall/adjoe').send({}).expect(404); // disabled

    const unknownUser = await postOfferwall({
      user_id: randomUUID(), // valid uuid, no such user
      txn_id: `it-${randomUUID()}`,
      coins: 10,
    }).expect(200);
    expect(unknownUser.body).toEqual({ status: 'rejected', reason: 'unknown_user' });
  });

  it('offers list + launch → postback with offer_id links the completion (B3 E2E)', async () => {
    const userId = await harness.createUser('IN');
    const externalOfferId = `it-offer-${randomUUID().slice(0, 8)}`;
    const offer = await harness.prisma.offer.create({
      data: {
        network: OfferNetwork.mock,
        externalOfferId,
        title: 'IT offer',
        coinReward: 200,
        requirements: { countries: ['IN'] },
        isActive: true,
      },
    });

    try {
      const token = await harness.appJwtFor(userId);
      const list = await request(server)
        .get('/api/offers')
        .set('authorization', `Bearer ${token}`)
        .expect(200);
      const listed = (list.body as Array<{ id: string; coin_reward: number }>).find(
        (o) => o.id === offer.id,
      );
      expect(listed).toMatchObject({ coin_reward: 200 });

      const launch = await request(server)
        .post(`/api/offers/${offer.id}/launch`)
        .set('authorization', `Bearer ${token}`)
        .expect(201);
      const launchUrl = new URL((launch.body as { launch_url: string }).launch_url);
      expect(launchUrl.searchParams.get('user')).toBe(userId);
      expect(launchUrl.searchParams.get('offer')).toBe(externalOfferId);

      // Unauthenticated access is rejected
      await request(server).get('/api/offers').expect(401);

      const txn = `it-${randomUUID()}`;
      await postOfferwall({
        user_id: userId,
        txn_id: txn,
        coins: 200,
        offer_id: externalOfferId,
      }).expect(200);

      const completion = await eventually(
        () =>
          harness.prisma.offerCompletion.findFirst({
            where: { userId, externalTxnId: txn, status: OfferCompletionStatus.credited },
          }),
        'linked completion credited',
      );
      expect(completion.offerId).toBe(offer.id);

      // Completed offer disappears from the eligible list
      const relist = await request(server)
        .get('/api/offers')
        .set('authorization', `Bearer ${token}`)
        .expect(200);
      expect((relist.body as Array<{ id: string }>).some((o) => o.id === offer.id)).toBe(false);
    } finally {
      await harness.prisma.offerCompletion.deleteMany({ where: { offerId: offer.id } });
      await harness.prisma.offer.delete({ where: { id: offer.id } });
    }
  });

  it('ad SSV flow: verified impressions credit until the daily cap, then record-only', async () => {
    const userId = await harness.createUser();

    // Tighten the cap to 2 via a high-version config row; drop the read cache.
    const configRow = await harness.prisma.appConfig.create({
      data: { key: 'ads.daily_reward_cap', value: { views: 2 }, version: 9_999 },
    });
    harness.app.get(AppConfigService).clearCache();

    try {
      const txns = [randomUUID(), randomUUID(), randomUUID()].map((t) => `it-ad-${t}`);
      const first = await postAd({
        user_id: userId,
        txn_id: txns[0],
        ad_unit_id: 'mock-rewarded',
      }).expect(200);
      expect(first.body.status).toBe('accepted');
      const second = await postAd({
        user_id: userId,
        txn_id: txns[1],
        ad_unit_id: 'mock-rewarded',
      }).expect(200);
      expect(second.body.status).toBe('accepted');
      const third = await postAd({
        user_id: userId,
        txn_id: txns[2],
        ad_unit_id: 'mock-rewarded',
      }).expect(200);
      expect(third.body.status).toBe('capped');

      // both credits land (default 5 coins each), the capped one never does
      await eventually(async () => {
        const sum = await harness.prisma.coinLedger.aggregate({
          where: { userId },
          _sum: { amount: true },
        });
        return (sum._sum.amount ?? 0) >= 10 ? sum : null;
      }, 'two ad credits');
      await new Promise((resolve) => setTimeout(resolve, 500));

      const impressions = await harness.prisma.adImpression.findMany({ where: { userId } });
      expect(impressions).toHaveLength(3);
      expect(impressions.filter((i) => i.coinReward > 0)).toHaveLength(2);
      expect(impressions.every((i) => i.verified)).toBe(true);

      const ledgerRows = await harness.prisma.coinLedger.findMany({ where: { userId } });
      expect(ledgerRows.map((r) => r.amount)).toEqual([5, 5]);

      // replayed SSV callback → duplicate, still exactly two credits
      const replay = await postAd({
        user_id: userId,
        txn_id: txns[0],
        ad_unit_id: 'mock-rewarded',
      }).expect(200);
      expect(replay.body.status).toBe('duplicate');
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(await harness.prisma.coinLedger.count({ where: { userId } })).toBe(2);

      // bad SSV signature → 401, nothing recorded
      const badJson = JSON.stringify({ user_id: userId, txn_id: 'nope', ad_unit_id: 'x' });
      await request(server)
        .post('/api/webhooks/ads/mock')
        .set('content-type', 'application/json')
        .set(MOCK_AD_SIGNATURE_HEADER, 'f'.repeat(64))
        .send(badJson)
        .expect(401);
    } finally {
      await harness.prisma.appConfig.delete({ where: { id: configRow.id } });
      harness.app.get(AppConfigService).clearCache();
    }
  });

  it('GET /api/me returns profile + referral code with streak placeholder', async () => {
    const userId = await harness.createUser();
    const token = await harness.appJwtFor(userId);
    const me = await request(server)
      .get('/api/me')
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body).toMatchObject({ id: userId, country: 'IN', streak: null });
    expect(typeof me.body.referral_code).toBe('string');
  });

  it('GET /api/wallet/ledger pages by cursor over real rows', async () => {
    const userId = await harness.createUser();
    const token = await harness.appJwtFor(userId);
    for (let i = 0; i < 5; i += 1) {
      await postOfferwall({ user_id: userId, txn_id: `it-pg-${userId}-${i}`, coins: 10 + i });
    }
    await eventually(async () => {
      const count = await harness.prisma.coinLedger.count({ where: { userId } });
      return count === 5 ? count : null;
    }, 'five credits');

    const page1 = await request(server)
      .get('/api/wallet/ledger?limit=2')
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(page1.body.entries).toHaveLength(2);
    expect(page1.body.next_cursor).toBeTruthy();

    const page2 = await request(server)
      .get(`/api/wallet/ledger?limit=2&cursor=${encodeURIComponent((page1.body as { next_cursor: string }).next_cursor)}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    const page3 = await request(server)
      .get(`/api/wallet/ledger?limit=2&cursor=${encodeURIComponent((page2.body as { next_cursor: string }).next_cursor)}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    const ids = [
      ...page1.body.entries,
      ...page2.body.entries,
      ...page3.body.entries,
    ].map((e: { id: string }) => e.id);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    expect(page3.body.next_cursor).toBeNull();

    // limit above the max is rejected by validation
    await request(server)
      .get('/api/wallet/ledger?limit=101')
      .set('authorization', `Bearer ${token}`)
      .expect(400);
  });
});
