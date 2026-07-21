import { PrismaService } from '../../common/prisma/prisma.service';
import { FraudCheckInput, FraudCheckService, FraudVerdict } from '../fraud/fraud-check.service';
import { LedgerService } from '../ledger/ledger.service';
import { CreditNotification, NotificationHook } from '../notifications/notification-hook';
import { ReferralService } from '../referral/referral.service';
import { PostbackProcessorService } from './postback-processor.service';
import { FakeLedgerService, FakePhaseBPrisma } from './testing/fake-phase-b-prisma';

class RecordingNotificationHook implements NotificationHook {
  notifications: CreditNotification[] = [];
  async onCredited(notification: CreditNotification): Promise<void> {
    this.notifications.push(notification);
  }
}

/** Records referral fan-out calls; the real service is unit-tested separately. */
class RecordingReferral {
  calls: Array<{ userId: string; amount: number; sourceLedgerId: string }> = [];
  async onUserEarned(params: {
    userId: string;
    amount: number;
    sourceLedgerId: string;
  }): Promise<void> {
    this.calls.push(params);
  }
}

class ScriptedFraudCheck implements FraudCheckService {
  verdict: FraudVerdict = { verdict: 'allow' };
  inputs: FraudCheckInput[] = [];
  async checkCredit(input: FraudCheckInput): Promise<FraudVerdict> {
    this.inputs.push(input);
    return this.verdict;
  }
}

describe('PostbackProcessorService', () => {
  let prisma: FakePhaseBPrisma;
  let ledger: FakeLedgerService;
  let fraud: ScriptedFraudCheck;
  let notify: RecordingNotificationHook;
  let referral: RecordingReferral;
  let service: PostbackProcessorService;
  let userId: string;

  beforeEach(() => {
    prisma = new FakePhaseBPrisma();
    ledger = new FakeLedgerService();
    fraud = new ScriptedFraudCheck();
    notify = new RecordingNotificationHook();
    referral = new RecordingReferral();
    service = new PostbackProcessorService(
      prisma as unknown as PrismaService,
      ledger as unknown as LedgerService,
      fraud,
      notify,
      referral as unknown as ReferralService,
    );
    userId = prisma.addUser();
  });

  describe('offer completions', () => {
    it('credits via LedgerService with the `${network}:${externalTxnId}` idempotency key and flips status', async () => {
      const completion = prisma.addCompletion({
        userId,
        network: 'mock',
        externalTxnId: 'txn-9',
        coinReward: 150,
      });

      await service.process({ kind: 'offer', completionId: completion.id });

      expect(ledger.calls).toEqual([
        {
          userId,
          amount: 150,
          sourceType: 'offer',
          sourceRefId: completion.id,
          idempotencyKey: 'mock:txn-9',
        },
      ]);
      const updated = prisma.completions[0];
      expect(updated.status).toBe('credited');
      expect(updated.creditedAt).toBeInstanceOf(Date);
      expect(notify.notifications).toEqual([
        { userId, coins: 150, sourceType: 'offer', sourceRefId: completion.id },
      ]);
      // referral fan-out fired for the earning
      expect(referral.calls).toHaveLength(1);
      expect(referral.calls[0]).toMatchObject({ userId, amount: 150 });
    });

    it('re-processing a credited completion is a no-op (no double credit)', async () => {
      const completion = prisma.addCompletion({ userId, coinReward: 100 });
      await service.process({ kind: 'offer', completionId: completion.id });
      await service.process({ kind: 'offer', completionId: completion.id });

      expect(ledger.calls).toHaveLength(1);
      expect(notify.notifications).toHaveLength(1);
    });

    it('fraud hold keeps the completion pending with the reason stored, NO ledger write', async () => {
      fraud.verdict = { verdict: 'hold', reason: 'offer_velocity' };
      const completion = prisma.addCompletion({ userId, coinReward: 100 });

      await service.process({ kind: 'offer', completionId: completion.id });

      const row = prisma.completions[0];
      expect(row.status).toBe('pending');
      expect(row.statusReason).toBe('hold:offer_velocity');
      expect(ledger.calls).toHaveLength(0);
      expect(notify.notifications).toHaveLength(0);
    });

    it('a held completion can later be re-processed and credited (hold released)', async () => {
      fraud.verdict = { verdict: 'hold', reason: 'offer_velocity' };
      const completion = prisma.addCompletion({ userId, coinReward: 100 });
      await service.process({ kind: 'offer', completionId: completion.id });

      fraud.verdict = { verdict: 'allow' };
      await service.process({ kind: 'offer', completionId: completion.id });

      const row = prisma.completions[0];
      expect(row.status).toBe('credited');
      expect(row.statusReason).toBeNull();
      expect(ledger.calls).toHaveLength(1);
    });

    it('non-positive coin_reward is rejected as invalid_amount', async () => {
      const completion = prisma.addCompletion({ userId, coinReward: 0 });
      await service.process({ kind: 'offer', completionId: completion.id });
      expect(prisma.completions[0]).toMatchObject({
        status: 'rejected',
        statusReason: 'invalid_amount',
      });
      expect(ledger.calls).toHaveLength(0);
    });

    it('job for a vanished completion is skipped without throwing', async () => {
      await expect(
        service.process({ kind: 'offer', completionId: '00000000-0000-4000-8000-000000000000' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('ad impressions', () => {
    it('credits with the `ad:${network}:${txn}` idempotency key', async () => {
      const impression = prisma.addImpression({
        userId,
        network: 'mock',
        coinReward: 5,
        ssvPayload: { external_txn_id: 'ad-77' },
      });

      await service.process({ kind: 'ad', impressionId: impression.id });

      expect(ledger.calls).toEqual([
        {
          userId,
          amount: 5,
          sourceType: 'ad',
          sourceRefId: impression.id,
          idempotencyKey: 'ad:mock:ad-77',
        },
      ]);
      expect(notify.notifications).toHaveLength(1);
    });

    it('duplicate ad jobs credit exactly once (ledger idempotency)', async () => {
      const impression = prisma.addImpression({
        userId,
        coinReward: 5,
        ssvPayload: { external_txn_id: 'ad-dup' },
      });
      await service.process({ kind: 'ad', impressionId: impression.id });
      await service.process({ kind: 'ad', impressionId: impression.id });
      expect(ledger.calls).toHaveLength(1);
    });

    it('capped (coin_reward=0) and unverified impressions never credit', async () => {
      const capped = prisma.addImpression({ userId, coinReward: 0 });
      const unverified = prisma.addImpression({ userId, coinReward: 5, verified: false });
      await service.process({ kind: 'ad', impressionId: capped.id });
      await service.process({ kind: 'ad', impressionId: unverified.id });
      expect(ledger.calls).toHaveLength(0);
    });

    it('fraud hold on an ad credit skips the ledger write', async () => {
      fraud.verdict = { verdict: 'hold', reason: 'ad_velocity' };
      const impression = prisma.addImpression({ userId, coinReward: 5 });
      await service.process({ kind: 'ad', impressionId: impression.id });
      expect(ledger.calls).toHaveLength(0);
    });
  });
});
