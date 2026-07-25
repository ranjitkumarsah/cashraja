/**
 * H4 — feedback/complaint API over HTTP against real Postgres:
 *   - a user submits and reads back only their own submissions
 *   - reviewer (not just super-admin) can view the queue, reply, and resolve
 *   - every admin mutation writes an admin_audit_log row
 *   - RBAC: app token 401 on admin routes (audience separation); no token 401
 *
 * Redis is not required here (no queue work), only Postgres.
 */
import './support/worker-off';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AdminRole } from '@prisma/client';
import { AdminTestApp, createAdminTestApp } from './support/admin-app';
import { isDatabaseReachable } from './support/db-reachable';

const describeIt = isDatabaseReachable() ? describe : describe.skip;
jest.setTimeout(120_000);

describeIt('Feedback API (integration, HTTP + Postgres)', () => {
  let harness: AdminTestApp;
  let server: App;
  let reviewer: { id: string; token: string };

  beforeAll(async () => {
    harness = await createAdminTestApp();
    server = harness.server as App;
    reviewer = await harness.createAdmin(AdminRole.reviewer);
  });

  afterAll(async () => {
    await harness.close();
  });

  const auth = (token: string): [string, string] => ['authorization', `Bearer ${token}`];

  it('user submits, reads back own submissions; reviewer replies + resolves (audited)', async () => {
    const userId = await harness.createUser();
    const userToken = await harness.appJwtFor(userId);

    // submit
    const submitRes = await request(server)
      .post('/api/feedback')
      .set(...auth(userToken))
      .send({ type: 'complaint', subject: 'Coins missing', message: 'Offer did not credit me.' })
      .expect(201);
    const feedbackId = submitRes.body.id as string;
    expect(submitRes.body).toMatchObject({ status: 'open', admin_reply: null });

    // read back own
    const mine = await request(server)
      .get('/api/feedback/mine')
      .set(...auth(userToken))
      .expect(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].id).toBe(feedbackId);

    // reviewer sees it in the open queue
    const queue = await request(server)
      .get('/api/admin/feedback?status=open')
      .set(...auth(reviewer.token))
      .expect(200);
    const queueRows = queue.body as Array<{ id: string }>;
    expect(queueRows.some((r) => r.id === feedbackId)).toBe(true);

    // reviewer replies → in_review
    const replyRes = await request(server)
      .post(`/api/admin/feedback/${feedbackId}/reply`)
      .set(...auth(reviewer.token))
      .send({ reply: 'Thanks — crediting you now.' })
      .expect(200);
    expect(replyRes.body).toMatchObject({ status: 'in_review', admin_reply: 'Thanks — crediting you now.' });

    // reviewer resolves
    const resolveRes = await request(server)
      .post(`/api/admin/feedback/${feedbackId}/resolve`)
      .set(...auth(reviewer.token))
      .expect(200);
    expect(resolveRes.body.status).toBe('resolved');
    expect(resolveRes.body.resolved_by_admin_id).toBe(reviewer.id);

    // user now sees the reply + resolved status
    const after = await request(server)
      .get('/api/feedback/mine')
      .set(...auth(userToken))
      .expect(200);
    expect(after.body[0]).toMatchObject({
      status: 'resolved',
      admin_reply: 'Thanks — crediting you now.',
    });

    // both mutations audited
    const audits = await harness.prisma.adminAuditLog.findMany({
      where: { adminId: reviewer.id, targetId: feedbackId },
    });
    const actions = audits.map((a) => a.action).sort();
    expect(actions).toContain('feedback_replied');
    expect(actions).toContain('feedback_resolved');
  });

  it('rejects an app-user token on the admin queue (401) and no token (401)', async () => {
    const userId = await harness.createUser();
    const appToken = await harness.appJwtFor(userId);
    await request(server).get('/api/admin/feedback').set(...auth(appToken)).expect(401);
    await request(server).get('/api/admin/feedback').expect(401);
  });
});
