/**
 * C2 money-critical flows over HTTP against real Postgres+Redis:
 *   - reserve-debit at request time + insufficient → 400
 *   - concurrent race: only one of N wins (E2E #5)
 *   - reject reverses the reserved debit (E2E #3)
 *   - approve issues a code from inventory + delivers a notification
 *   - out-of-stock keeps a paid redemption approved (never lost) → fulfilled on restock
 *   - banned-after-request is held, never auto-issued (gap P6)
 *   - new account is routed to manual review
 *
 * Worker OFF: the retry BullMQ worker is disabled so out-of-stock redemptions
 * are driven deterministically from the test (no infinite background retry).
 * Auto-skips unless DATABASE_URL + REDIS_URL are reachable.
 */
import './support/worker-off';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AdminRole, GiftCardBrand, RedemptionStatus } from '@prisma/client';
import { RedemptionsService } from '../src/modules/redemptions/redemptions.service';
import { AdminTestApp, createAdminTestApp } from './support/admin-app';
import { isDatabaseReachable } from './support/db-reachable';
import { isRedisReachable } from './support/redis-reachable';

const describeIt = isDatabaseReachable() && isRedisReachable() ? describe : describe.skip;
jest.setTimeout(120_000);

const TEN_DAYS_AGO = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

describeIt('Redemption flow (integration, HTTP + Postgres + Redis)', () => {
  let harness: AdminTestApp;
  let server: App;
  let superAdmin: { id: string; token: string };
  let reviewer: { id: string; token: string };

  beforeAll(async () => {
    harness = await createAdminTestApp();
    server = harness.server as App;
    superAdmin = await harness.createAdmin(AdminRole.super_admin);
    reviewer = await harness.createAdmin(AdminRole.reviewer);
  });

  afterAll(async () => {
    await harness.close();
  });

  beforeEach(() => {
    harness.resetThrottle();
  });

  function uploadInventory(brand: GiftCardBrand, denomination: number, codes: string): request.Test {
    return request(server)
      .post('/api/admin/inventory')
      .set('authorization', `Bearer ${superAdmin.token}`)
      .send({ brand, denomination, codes });
  }

  function requestRedemption(userToken: string, giftCardId: string): request.Test {
    return request(server)
      .post('/api/redemptions')
      .set('authorization', `Bearer ${userToken}`)
      .send({ gift_card_id: giftCardId });
  }

  it('reserves coins at request time and rejects a second request over balance (400)', async () => {
    const userId = await harness.createUser({ balance: 1000, createdAt: TEN_DAYS_AGO });
    const token = await harness.appJwtFor(userId);
    const cardA = await harness.createGiftCard(GiftCardBrand.amazon, 401, 1000);
    const cardB = await harness.createGiftCard(GiftCardBrand.amazon, 402, 1000);

    const first = await requestRedemption(token, cardA).expect(201);
    expect(first.body.status).toBe(RedemptionStatus.requested);
    expect(await harness.ledger.getBalance(userId)).toBe(0); // reserved immediately

    await requestRedemption(token, cardB).expect(400); // insufficient now
  });

  it('concurrent requests for the full balance — exactly one succeeds (E2E #5)', async () => {
    const userId = await harness.createUser({ balance: 1000, createdAt: TEN_DAYS_AGO });
    const token = await harness.appJwtFor(userId);
    const card = await harness.createGiftCard(GiftCardBrand.flipkart, 403, 1000);

    const results = await Promise.all(
      Array.from({ length: 5 }, () => requestRedemption(token, card)),
    );
    const created = results.filter((r) => r.status === 201);
    const rejected = results.filter((r) => r.status === 400);
    expect(created).toHaveLength(1);
    expect(rejected).toHaveLength(4);
    expect(await harness.ledger.getBalance(userId)).toBe(0);

    const rows = await harness.prisma.redemption.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
  });

  it('reject reverses the reserved debit with a compensating row (E2E #3)', async () => {
    const userId = await harness.createUser({ balance: 1000, createdAt: TEN_DAYS_AGO });
    const token = await harness.appJwtFor(userId);
    const card = await harness.createGiftCard(GiftCardBrand.amazon, 404, 1000);

    const created = await requestRedemption(token, card).expect(201);
    const redemptionId = created.body.id as string;
    expect(await harness.ledger.getBalance(userId)).toBe(0);

    const rejected = await request(server)
      .post(`/api/admin/redemptions/${redemptionId}/reject`)
      .set('authorization', `Bearer ${reviewer.token}`)
      .send({ reason: 'suspected fraud' })
      .expect(200);
    expect(rejected.body.status).toBe(RedemptionStatus.rejected);
    expect(rejected.body.rejection_reason).toBe('suspected fraud');

    expect(await harness.ledger.getBalance(userId)).toBe(1000); // coins returned
    const ledgerRows = await harness.prisma.coinLedger.findMany({ where: { userId } });
    // seed credit + reserve debit + reversal credit
    expect(ledgerRows.filter((r) => r.sourceType === 'redemption')).toHaveLength(2);
  });

  it('approve issues a code from inventory and delivers an in-app notification', async () => {
    const userId = await harness.createUser({ balance: 1000, createdAt: TEN_DAYS_AGO });
    const token = await harness.appJwtFor(userId);
    const card = await harness.createGiftCard(GiftCardBrand.amazon, 405, 1000);
    await uploadInventory(GiftCardBrand.amazon, 405, 'AMZN-405-PLAINTEXT').expect(201);

    const created = await requestRedemption(token, card).expect(201);
    const redemptionId = created.body.id as string;

    const approved = await request(server)
      .post(`/api/admin/redemptions/${redemptionId}/approve`)
      .set('authorization', `Bearer ${superAdmin.token}`)
      .expect(200);
    expect(approved.body.outcome).toBe('issued');
    expect(approved.body.redemption.status).toBe(RedemptionStatus.issued);
    expect(approved.body.redemption.has_code).toBe(true);

    // owner sees the decrypted code via /mine; it is NOT plaintext at rest
    const mine = await request(server)
      .get('/api/redemptions/mine')
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(mine.body[0].gift_card_code).toBe('AMZN-405-PLAINTEXT');

    const stored = await harness.prisma.redemption.findUnique({ where: { id: redemptionId } });
    expect(stored?.giftCardCode).not.toContain('AMZN-405-PLAINTEXT'); // encrypted at rest

    const notifications = await harness.prisma.notification.findMany({
      where: { userId, type: 'redemption_issued' },
    });
    expect(notifications).toHaveLength(1);

    const inv = await harness.prisma.giftCardInventory.findFirst({ where: { redemptionId } });
    expect(inv?.status).toBe('issued');
  });

  it('out-of-stock keeps the paid redemption approved (never lost) and fulfils on restock', async () => {
    const userId = await harness.createUser({ balance: 1000, createdAt: TEN_DAYS_AGO });
    const token = await harness.appJwtFor(userId);
    const card = await harness.createGiftCard(GiftCardBrand.flipkart, 406, 1000);

    const created = await requestRedemption(token, card).expect(201);
    const redemptionId = created.body.id as string;

    // No inventory yet → approve cannot issue.
    const approved = await request(server)
      .post(`/api/admin/redemptions/${redemptionId}/approve`)
      .set('authorization', `Bearer ${superAdmin.token}`)
      .expect(200);
    expect(approved.body.outcome).toBe('approved_pending');
    expect(approved.body.redemption.status).toBe(RedemptionStatus.approved);
    expect(await harness.ledger.getBalance(userId)).toBe(0); // still reserved, not refunded

    // Restock + drive the retry path directly (worker is off in this suite).
    await uploadInventory(GiftCardBrand.flipkart, 406, 'FLP-406-CODE').expect(201);
    const service = harness.app.get(RedemptionsService);
    const outcome = await service.attemptFulfillment(redemptionId, superAdmin.id, {
      enqueueOnFailure: false,
    });
    expect(outcome.status).toBe('issued');

    const stored = await harness.prisma.redemption.findUnique({ where: { id: redemptionId } });
    expect(stored?.status).toBe(RedemptionStatus.issued);
  });

  it('a user banned after requesting is held for manual review, never auto-issued (P6)', async () => {
    const userId = await harness.createUser({ balance: 1000, createdAt: TEN_DAYS_AGO });
    const token = await harness.appJwtFor(userId);
    const card = await harness.createGiftCard(GiftCardBrand.amazon, 407, 1000);
    await uploadInventory(GiftCardBrand.amazon, 407, 'AMZN-407-CODE').expect(201);

    const created = await requestRedemption(token, card).expect(201);
    const redemptionId = created.body.id as string;

    await request(server)
      .post(`/api/admin/users/${userId}/ban`)
      .set('authorization', `Bearer ${superAdmin.token}`)
      .send({ reason: 'fraud ring' })
      .expect(200);

    const approved = await request(server)
      .post(`/api/admin/redemptions/${redemptionId}/approve`)
      .set('authorization', `Bearer ${superAdmin.token}`)
      .expect(200);
    expect(approved.body.outcome).toBe('held_banned_user');
    expect(approved.body.redemption.status).toBe(RedemptionStatus.under_review);
    expect(approved.body.redemption.has_code).toBe(false);

    // inventory untouched
    const inv = await harness.prisma.giftCardInventory.findFirst({ where: { redemptionId } });
    expect(inv).toBeNull();
  });

  it('routes a brand-new account to manual review (redemption abuse pre-screen)', async () => {
    const userId = await harness.createUser({ balance: 1000 }); // createdAt = now
    const token = await harness.appJwtFor(userId);
    const card = await harness.createGiftCard(GiftCardBrand.google_play, 408, 1000);

    const created = await requestRedemption(token, card).expect(201);
    expect(created.body.status).toBe(RedemptionStatus.under_review);
  });
});
