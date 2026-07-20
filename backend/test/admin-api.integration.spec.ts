/**
 * C1/C3/C4 admin API over HTTP against real Postgres:
 *   - RBAC enforced at the SERVER (reviewer 403 on super-admin routes; app
 *     token 401 by audience; no token 401) — not just the UI
 *   - balance-adjust writes ledger + audit atomically (+ rollback on failure)
 *   - config versioning (append-only versions)
 *   - gift-card code masking everywhere + audited super-admin reveal
 *   - account deletion anonymizes PII but preserves the ledger
 *   - dashboard metrics accuracy vs raw queries
 *
 * Redis is not required here (no queue work), only Postgres.
 */
import './support/worker-off';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AdminRole, GiftCardBrand, LedgerSourceType, UserStatus } from '@prisma/client';
import { AdminUsersService } from '../src/modules/admin/admin-users.service';
import { MetricsService } from '../src/modules/metrics/metrics.service';
import { AdminTestApp, createAdminTestApp } from './support/admin-app';
import { isDatabaseReachable } from './support/db-reachable';

const describeIt = isDatabaseReachable() ? describe : describe.skip;
jest.setTimeout(120_000);

const OLD = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

describeIt('Admin API (integration, HTTP + Postgres)', () => {
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

  const auth = (token: string): [string, string] => ['authorization', `Bearer ${token}`];

  describe('RBAC — server-side enforcement', () => {
    it('reviewer is BLOCKED (403) on super-admin-only routes', async () => {
      const userId = await harness.createUser({ createdAt: OLD });
      const card = await harness.createGiftCard(GiftCardBrand.amazon, 501, 1000);
      const routes: Array<{ method: 'post' | 'patch' | 'get'; path: string; body?: object }> = [
        { method: 'post', path: `/api/admin/users/${userId}/adjust-balance`, body: { amount: 100, reason: 'x' } },
        { method: 'post', path: `/api/admin/users/${userId}/ban`, body: {} },
        { method: 'patch', path: `/api/admin/offers/${randomUUID()}`, body: { is_active: false } },
        { method: 'patch', path: '/api/admin/config/test.blocked', body: { value: { a: 1 } } },
        { method: 'post', path: '/api/admin/inventory', body: { brand: 'amazon', denomination: 501, codes: 'X' } },
        { method: 'get', path: `/api/admin/inventory/${randomUUID()}/reveal` },
        { method: 'post', path: '/api/admin/admins', body: { email: 'x@y.z', role: 'reviewer' } },
        { method: 'patch', path: `/api/admin/gift-cards/${card}`, body: { is_active: false } },
      ];
      for (const route of routes) {
        await request(server)
          [route.method](route.path)
          .set(...auth(reviewer.token))
          .send(route.body ?? {})
          .expect(403);
      }
    });

    it('reviewer IS allowed on view/queue/export/approve routes', async () => {
      await request(server).get('/api/admin/users').set(...auth(reviewer.token)).expect(200);
      await request(server).get('/api/admin/redemptions').set(...auth(reviewer.token)).expect(200);
      await request(server).get('/api/admin/fraud-flags').set(...auth(reviewer.token)).expect(200);
      await request(server).get('/api/admin/redemptions/export').set(...auth(reviewer.token)).expect(200);
    });

    it('an app-user token is rejected on admin routes (audience separation, 401)', async () => {
      const userId = await harness.createUser();
      const appToken = await harness.appJwtFor(userId);
      await request(server).get('/api/admin/users').set(...auth(appToken)).expect(401);
    });

    it('no token → 401 on admin routes', async () => {
      await request(server).get('/api/admin/users').expect(401);
    });
  });

  describe('balance adjust (C3.2)', () => {
    it('writes ledger + audit in one transaction and requires a reason', async () => {
      const userId = await harness.createUser({ balance: 100, createdAt: OLD });

      await request(server)
        .post(`/api/admin/users/${userId}/adjust-balance`)
        .set(...auth(superAdmin.token))
        .send({ amount: 250 }) // missing reason
        .expect(400);

      const res = await request(server)
        .post(`/api/admin/users/${userId}/adjust-balance`)
        .set(...auth(superAdmin.token))
        .send({ amount: 250, reason: 'goodwill credit' })
        .expect(200);
      expect(res.body.balance_after).toBe(350);

      const ledgerRows = await harness.prisma.coinLedger.findMany({
        where: { userId, sourceType: LedgerSourceType.admin_adjustment },
      });
      expect(ledgerRows.some((r) => r.amount === 250)).toBe(true);
      const audit = await harness.prisma.adminAuditLog.findFirst({
        where: { adminId: superAdmin.id, action: 'balance_adjusted', targetId: userId },
      });
      expect(audit?.reason).toContain('goodwill credit');
    });

    it('rolls back the ledger write when the audit write fails (atomic)', async () => {
      const userId = await harness.createUser({ balance: 500, createdAt: OLD });
      const service = harness.app.get(AdminUsersService);
      const bogusAdminId = randomUUID(); // not in admins → audit FK violation

      await expect(service.adjustBalance(bogusAdminId, userId, 999, 'should roll back')).rejects.toThrow();

      // No adjustment row, balance untouched.
      const adj = await harness.prisma.coinLedger.findMany({
        where: { userId, sourceType: LedgerSourceType.admin_adjustment, amount: 999 },
      });
      expect(adj).toHaveLength(0);
      expect(await harness.ledger.getBalance(userId)).toBe(500);
    });
  });

  describe('config versioning (C3.5)', () => {
    it('appends a new version per write; GET returns the latest', async () => {
      const key = `test.phasec.${randomUUID().slice(0, 8)}`;
      harness.trackConfigKey(key);

      const v1 = await request(server)
        .patch(`/api/admin/config/${key}`)
        .set(...auth(superAdmin.token))
        .send({ value: { percent: 10 } })
        .expect(200);
      expect(v1.body.version).toBe(1);

      const v2 = await request(server)
        .patch(`/api/admin/config/${key}`)
        .set(...auth(superAdmin.token))
        .send({ value: { percent: 15 } })
        .expect(200);
      expect(v2.body.version).toBe(2);

      // both versions preserved (append-only)
      const rows = await harness.prisma.appConfig.findMany({ where: { key } });
      expect(rows).toHaveLength(2);

      const all = await request(server).get('/api/admin/config').set(...auth(superAdmin.token)).expect(200);
      const current = (all.body as Array<{ key: string; value: { percent: number }; version: number }>).find(
        (c) => c.key === key,
      );
      expect(current?.version).toBe(2);
      expect(current?.value.percent).toBe(15);
    });
  });

  describe('gift-card inventory: masking + audited reveal (C1.4)', () => {
    it('masks codes in listings and reveals only for super-admin (audited)', async () => {
      await request(server)
        .post('/api/admin/inventory')
        .set(...auth(superAdmin.token))
        .send({ brand: GiftCardBrand.amazon, denomination: 502, codes: 'REVEAL-502-SECRET' })
        .expect(201);

      const list = await request(server)
        .get('/api/admin/inventory?brand=amazon&denomination=502')
        .set(...auth(superAdmin.token))
        .expect(200);
      expect(list.body[0].code_masked).toBe('****');
      const inventoryId = list.body[0].id as string;

      // reviewer cannot reveal
      await request(server)
        .get(`/api/admin/inventory/${inventoryId}/reveal`)
        .set(...auth(reviewer.token))
        .expect(403);

      const reveal = await request(server)
        .get(`/api/admin/inventory/${inventoryId}/reveal`)
        .set(...auth(superAdmin.token))
        .expect(200);
      expect(reveal.body.code).toBe('REVEAL-502-SECRET');

      const audit = await harness.prisma.adminAuditLog.findFirst({
        where: { action: 'inventory_code_revealed', targetId: inventoryId },
      });
      expect(audit).not.toBeNull();
    });
  });

  describe('account deletion (C3.8)', () => {
    it('anonymizes PII in place but preserves the ledger and revokes tokens', async () => {
      const userId = await harness.createUser({ balance: 777, createdAt: OLD });
      await harness.prisma.refreshToken.create({
        data: {
          tokenHash: `hash-${userId}`,
          userId,
          expiresAt: new Date(Date.now() + 1_000_000),
        },
      });
      const token = await harness.appJwtFor(userId);

      const res = await request(server).delete('/api/account').set(...auth(token)).expect(200);
      expect(res.body.deleted).toBe(true);

      const user = await harness.prisma.user.findUnique({ where: { id: userId } });
      expect(user?.email).toBe(`deleted+${userId}@deleted.invalid`);
      expect(user?.displayName).toBe('Deleted User');
      expect(user?.googleUid).toBe(`deleted:${userId}`);
      expect(user?.status).toBe(UserStatus.banned);

      // ledger preserved
      expect(await harness.ledger.getBalance(userId)).toBe(777);
      // token revoked
      const rt = await harness.prisma.refreshToken.findFirst({ where: { userId } });
      expect(rt?.revokedAt).not.toBeNull();
    });
  });

  describe('admin management (C3.6)', () => {
    it('creates an admin with a one-time temp password, lists (no secrets), disables', async () => {
      const email = `new-${randomUUID()}@test.local`;
      const created = await request(server)
        .post('/api/admin/admins')
        .set(...auth(superAdmin.token))
        .send({ email, role: 'reviewer' })
        .expect(201);
      expect(created.body.temp_password).toBeTruthy();
      expect(created.body.role).toBe('reviewer');
      const newId = created.body.id as string;
      try {
        const list = await request(server).get('/api/admin/admins').set(...auth(superAdmin.token)).expect(200);
        const found = (list.body as Array<Record<string, unknown>>).find((a) => a.id === newId);
        expect(found).toBeDefined();
        expect(found).not.toHaveProperty('password_hash');
        expect(found).not.toHaveProperty('totp_secret');

        const disabled = await request(server)
          .post(`/api/admin/admins/${newId}/disable`)
          .set(...auth(superAdmin.token))
          .expect(200);
        expect(disabled.body.status).toBe('disabled');
      } finally {
        await harness.prisma.adminAuditLog.deleteMany({ where: { targetId: newId } });
        await harness.prisma.admin.delete({ where: { id: newId } }).catch(() => undefined);
      }
    });

    it('a super-admin cannot disable their own account', async () => {
      await request(server)
        .post(`/api/admin/admins/${superAdmin.id}/disable`)
        .set(...auth(superAdmin.token))
        .expect(400);
    });
  });

  describe('fraud review (C3.7)', () => {
    it('resolving a flag with ban_user bans the user; both actions audited', async () => {
      const userId = await harness.createUser({ createdAt: OLD });
      const flag = await harness.prisma.fraudFlag.create({
        data: { userId, ruleTriggered: 'multi_account', severity: 'high' },
      });
      const res = await request(server)
        .post(`/api/admin/fraud-flags/${flag.id}/resolve`)
        .set(...auth(reviewer.token))
        .send({ action: 'ban_user', note: 'confirmed ring' })
        .expect(200);
      expect(res.body.status).toBe('resolved');

      const user = await harness.prisma.user.findUnique({ where: { id: userId } });
      expect(user?.status).toBe(UserStatus.banned);

      const audits = await harness.prisma.adminAuditLog.findMany({
        where: { adminId: reviewer.id, targetId: { in: [flag.id, userId] } },
      });
      expect(audits.map((a) => a.action).sort()).toEqual(['fraud_flag_resolved', 'user_banned']);
    });
  });

  describe('gift-card catalog (C1.1)', () => {
    it('super-admin creates a catalog entry; public list shows only active cards', async () => {
      const active = await request(server)
        .post('/api/admin/gift-cards')
        .set(...auth(superAdmin.token))
        .send({ brand: GiftCardBrand.amazon, denomination: 611, coin_cost: 61100 })
        .expect(201);
      const activeId = active.body.id as string;
      const inactiveId = await harness.createGiftCard(GiftCardBrand.flipkart, 612, 61200, false);

      try {
        const userId = await harness.createUser();
        const token = await harness.appJwtFor(userId);
        const list = await request(server).get('/api/gift-cards').set(...auth(token)).expect(200);
        const ids = (list.body as Array<{ id: string }>).map((c) => c.id);
        expect(ids).toContain(activeId);
        expect(ids).not.toContain(inactiveId);
      } finally {
        await harness.prisma.adminAuditLog.deleteMany({ where: { targetId: activeId } });
        await harness.prisma.giftCard.delete({ where: { id: activeId } }).catch(() => undefined);
      }
    });
  });

  describe('dashboard metrics accuracy (C4.3)', () => {
    it('current aggregates match raw queries against the same data', async () => {
      const metrics = harness.app.get(MetricsService);
      const current = await metrics.compute();

      const issuedRaw = await harness.prisma.coinLedger.aggregate({
        where: { amount: { gt: 0 } },
        _sum: { amount: true },
      });
      const outstandingRaw = await harness.prisma.redemption.aggregate({
        where: { status: { in: ['requested', 'under_review', 'approved'] } },
        _sum: { coinAmount: true },
      });
      expect(current.coins_issued).toBe(issuedRaw._sum.amount ?? 0);
      expect(current.outstanding_liability).toBe(outstandingRaw._sum.coinAmount ?? 0);
      expect(current.offer_completion_rate).toBeGreaterThanOrEqual(0);
      expect(current.offer_completion_rate).toBeLessThanOrEqual(1);

      // the dashboard endpoint returns the same current block
      const res = await request(server)
        .get('/api/admin/dashboard/metrics')
        .set(...auth(reviewer.token))
        .expect(200);
      expect(res.body.current.coins_issued).toBe(current.coins_issued);
      expect(Array.isArray(res.body.series)).toBe(true);
    });
  });
});
