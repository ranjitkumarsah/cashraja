import { AppConfigService } from '../../common/app-config/app-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PendingExpiryJob } from './pending-expiry.job';
import { FakePhaseBPrisma } from './testing/fake-phase-b-prisma';

const DAY = 24 * 60 * 60 * 1000;

describe('PendingExpiryJob (B2.3 — 30d pending void)', () => {
  let prisma: FakePhaseBPrisma;
  let job: PendingExpiryJob;
  let userId: string;
  const now = new Date('2026-07-19T12:00:00Z');

  beforeEach(() => {
    prisma = new FakePhaseBPrisma();
    job = new PendingExpiryJob(
      prisma as unknown as PrismaService,
      new AppConfigService(prisma as unknown as PrismaService),
    );
    userId = prisma.addUser();
  });

  it('voids pending completions older than the default 30 days — younger and non-pending untouched', async () => {
    const old = prisma.addCompletion({ userId, createdAt: new Date(now.getTime() - 31 * DAY) });
    const boundary = prisma.addCompletion({
      userId,
      externalTxnId: 'b',
      createdAt: new Date(now.getTime() - 29 * DAY),
    });
    const credited = prisma.addCompletion({
      userId,
      externalTxnId: 'c',
      status: 'credited',
      createdAt: new Date(now.getTime() - 90 * DAY),
    });

    const count = await job.run(now);

    expect(count).toBe(1);
    expect(old).toMatchObject({ status: 'rejected', statusReason: 'expired' });
    expect(boundary.status).toBe('pending');
    expect(credited.status).toBe('credited'); // ledger history never touched
  });

  it('honors app_config offers.pending_expiry_days', async () => {
    prisma.setConfig('offers.pending_expiry_days', { days: 7 });
    const eightDays = prisma.addCompletion({
      userId,
      createdAt: new Date(now.getTime() - 8 * DAY),
    });
    const sixDays = prisma.addCompletion({
      userId,
      externalTxnId: 'b',
      createdAt: new Date(now.getTime() - 6 * DAY),
    });

    const count = await job.run(now);
    expect(count).toBe(1);
    expect(eightDays.status).toBe('rejected');
    expect(sixDays.status).toBe('pending');
  });

  it('held completions (status_reason set) also expire', async () => {
    const held = prisma.addCompletion({
      userId,
      statusReason: 'hold:offer_velocity',
      createdAt: new Date(now.getTime() - 40 * DAY),
    });
    await job.run(now);
    expect(held).toMatchObject({ status: 'rejected', statusReason: 'expired' });
  });
});
