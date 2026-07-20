import { PrismaService } from '../../common/prisma/prisma.service';
import { CanonicalPostback } from '../../providers/offerwall/offerwall-adapter';
import { PostbackIntakeService } from './postback-intake.service';
import { FakePhaseBPrisma, FakePostbackQueue } from './testing/fake-phase-b-prisma';

function canonical(partial: Partial<CanonicalPostback> = {}): CanonicalPostback {
  return {
    networkUserId: 'not-set',
    externalTxnId: 'txn-1',
    coins: 100,
    raw: { via: 'unit' },
    ...partial,
  };
}

describe('PostbackIntakeService', () => {
  let prisma: FakePhaseBPrisma;
  let queue: FakePostbackQueue;
  let service: PostbackIntakeService;
  let userId: string;

  beforeEach(() => {
    prisma = new FakePhaseBPrisma();
    queue = new FakePostbackQueue();
    service = new PostbackIntakeService(
      prisma as unknown as PrismaService,
      queue,
    );
    userId = prisma.addUser();
  });

  it('persists a pending completion and enqueues exactly one job', async () => {
    const result = await service.intakeOffer('mock', canonical({ networkUserId: userId }));

    expect(result.status).toBe('accepted');
    expect(prisma.completions).toHaveLength(1);
    const row = prisma.completions[0];
    expect(row).toMatchObject({
      userId,
      network: 'mock',
      externalTxnId: 'txn-1',
      status: 'pending',
      coinReward: 100,
    });
    expect(row.networkPayload).toEqual({ via: 'unit' });
    expect(queue.jobs).toEqual([{ kind: 'offer', completionId: row.id }]);
  });

  it('links the completion to a known offer via (network, external_offer_id)', async () => {
    const offer = prisma.addOffer({ externalOfferId: 'mock-1', network: 'mock' });
    await service.intakeOffer(
      'mock',
      canonical({ networkUserId: userId, externalOfferId: 'mock-1' }),
    );
    expect(prisma.completions[0].offerId).toBe(offer.id);
  });

  it('replayed txn short-circuits as duplicate with a single row, and re-enqueues while pending', async () => {
    await service.intakeOffer('mock', canonical({ networkUserId: userId }));
    queue.jobs = [];

    const replay = await service.intakeOffer('mock', canonical({ networkUserId: userId }));
    expect(replay.status).toBe('duplicate');
    expect(prisma.completions).toHaveLength(1);
    // still pending → job re-enqueued (self-heal after a lost job)
    expect(queue.jobs).toHaveLength(1);
  });

  it('replayed txn on an already-credited completion does NOT re-enqueue', async () => {
    await service.intakeOffer('mock', canonical({ networkUserId: userId }));
    prisma.completions[0].status = 'credited';
    queue.jobs = [];

    const replay = await service.intakeOffer('mock', canonical({ networkUserId: userId }));
    expect(replay.status).toBe('duplicate');
    expect(queue.jobs).toHaveLength(0);
  });

  it('same txn id on DIFFERENT networks is not a duplicate', async () => {
    await service.intakeOffer('mock', canonical({ networkUserId: userId }));
    const other = await service.intakeOffer('adjoe', canonical({ networkUserId: userId }));
    expect(other.status).toBe('accepted');
    expect(prisma.completions).toHaveLength(2);
  });

  it('rejects unknown users (incl. malformed uuid) without creating rows', async () => {
    const unknown = await service.intakeOffer(
      'mock',
      canonical({ networkUserId: '00000000-0000-4000-8000-000000000000' }),
    );
    expect(unknown).toEqual({ status: 'rejected', reason: 'unknown_user' });

    const malformed = await service.intakeOffer(
      'mock',
      canonical({ networkUserId: 'not-a-uuid' }),
    );
    expect(malformed).toEqual({ status: 'rejected', reason: 'unknown_user' });
    expect(prisma.completions).toHaveLength(0);
    expect(queue.jobs).toHaveLength(0);
  });

  it('propagates enqueue failure AFTER the row is durable (network will retry → duplicate path re-enqueues)', async () => {
    queue.failNext = true;
    await expect(
      service.intakeOffer('mock', canonical({ networkUserId: userId })),
    ).rejects.toThrow('redis unavailable');
    expect(prisma.completions).toHaveLength(1); // row survived

    const retry = await service.intakeOffer('mock', canonical({ networkUserId: userId }));
    expect(retry.status).toBe('duplicate');
    expect(queue.jobs).toHaveLength(1); // self-healed
  });
});
