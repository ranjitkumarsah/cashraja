import { PrismaService } from '../common/prisma/prisma.service';
import { AlertPayload, AlertService } from '../common/alerts/alert.service';
import { LedgerService } from '../modules/ledger/ledger.service';
import { FakeLedgerPrisma } from '../modules/ledger/testing/fake-prisma';
import { LedgerReconciliationJob } from './ledger-reconciliation.job';

const U1 = 'bbbbbbbb-0000-4000-8000-000000000001';
const U2 = 'bbbbbbbb-0000-4000-8000-000000000002';
const U3 = 'bbbbbbbb-0000-4000-8000-000000000003';

class CapturingAlertService implements AlertService {
  alerts: AlertPayload[] = [];
  async alert(payload: AlertPayload): Promise<void> {
    this.alerts.push(payload);
  }
}

describe('LedgerReconciliationJob', () => {
  let fake: FakeLedgerPrisma;
  let ledger: LedgerService;
  let alerts: CapturingAlertService;
  let job: LedgerReconciliationJob;

  beforeEach(async () => {
    fake = new FakeLedgerPrisma();
    ledger = new LedgerService(fake as unknown as PrismaService);
    alerts = new CapturingAlertService();
    job = new LedgerReconciliationJob(fake as unknown as PrismaService, alerts);

    fake.addUser(U1);
    fake.addUser(U2);
    fake.addUser(U3);
    await ledger.record({ userId: U1, amount: 100, sourceType: 'offer', idempotencyKey: 'a' });
    await ledger.record({ userId: U1, amount: -30, sourceType: 'redemption', idempotencyKey: 'b' });
    await ledger.record({ userId: U2, amount: 40, sourceType: 'game', idempotencyKey: 'c' });
    // U3 has no ledger rows — cached must be 0
  });

  it('reports zero drift and raises no alert when caches match the ledger', async () => {
    const report = await job.run();

    expect(report.usersChecked).toBe(3);
    expect(report.driftCount).toBe(0);
    expect(alerts.alerts).toHaveLength(0);
  });

  it('detects drift (including ledger-less users) and alerts with details', async () => {
    fake.corruptCachedBalance(U1, 999);
    fake.corruptCachedBalance(U3, 5);

    const report = await job.run();

    expect(report.driftCount).toBe(2);
    expect(report.drifts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: U1, cached: 999, ledgerSum: 70, drift: 929 }),
        expect.objectContaining({ userId: U3, cached: 5, ledgerSum: 0, drift: 5 }),
      ]),
    );
    expect(alerts.alerts).toHaveLength(1);
    expect(alerts.alerts[0].type).toBe('ledger_drift');
    expect(alerts.alerts[0].details).toMatchObject({ driftCount: 2 });
  });

  it('does not silently mutate the cache when drift is found', async () => {
    fake.corruptCachedBalance(U2, 12345);
    await job.run();
    expect(fake.cachedBalanceOf(U2)).toBe(12345); // humans investigate; the job never "fixes"
  });
});
