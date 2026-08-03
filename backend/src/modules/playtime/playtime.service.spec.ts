import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { LedgerSourceType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { NotificationHook } from '../notifications/notification-hook';
import { PlaytimeCallback, PlaytimeService } from './playtime.service';

const APP_KEY = 'fbb8dbc4def00504';
const SECRET_A = 'YLGEOCTTTOCSWPZ2';
const SECRET_B = 'YO30FXPQK62YCZTAR67NEOL2K';

function sign(cb: { userId: string; offerId: string; amount: string }, secret: string): string {
  return createHash('sha1')
    .update(`${cb.userId}${cb.offerId}${cb.amount}${APP_KEY}${secret}`)
    .digest('hex');
}

function makeConfig(values: Record<string, string>): ConfigService {
  return { get: (k: string) => values[k] } as unknown as ConfigService;
}

class FakeLedger {
  seenKeys = new Set<string>();
  calls = 0;
  record(params: { idempotencyKey: string }) {
    this.calls += 1;
    const duplicate = this.seenKeys.has(params.idempotencyKey);
    this.seenKeys.add(params.idempotencyKey);
    return Promise.resolve({ entry: { id: 'led-1' }, duplicate });
  }
}

class FakeNotifications implements NotificationHook {
  count = 0;
  onCredited() {
    this.count += 1;
    return Promise.resolve();
  }
}

function fakePrisma(userExists: boolean): PrismaService {
  return {
    user: { findUnique: () => Promise.resolve(userExists ? { id: 'u1' } : null) },
  } as unknown as PrismaService;
}

function makeService(opts: {
  secrets?: string;
  appKey?: string;
  userExists?: boolean;
  ledger?: FakeLedger;
  notifications?: FakeNotifications;
}) {
  const ledger = opts.ledger ?? new FakeLedger();
  const notifications = opts.notifications ?? new FakeNotifications();
  const service = new PlaytimeService(
    makeConfig({
      PLAYTIME_APP_KEY: opts.appKey ?? APP_KEY,
      PLAYTIME_SECRET_KEYS: opts.secrets ?? `${SECRET_A},${SECRET_B}`,
    }),
    fakePrisma(opts.userExists ?? true),
    ledger as unknown as LedgerService,
    notifications,
  );
  return { service, ledger, notifications };
}

const base = { userId: 'u1', offerId: 'o1', amount: '100' };

describe('PlaytimeService.verifySignature', () => {
  it('accepts a signature made with EITHER configured secret', () => {
    const { service } = makeService({});
    for (const secret of [SECRET_A, SECRET_B]) {
      const cb: PlaytimeCallback = { ...base, signature: sign(base, secret) };
      expect(service.verifySignature(cb)).toBe(true);
    }
  });

  it('accepts uppercase hex (case-insensitive compare)', () => {
    const { service } = makeService({});
    const cb: PlaytimeCallback = { ...base, signature: sign(base, SECRET_A).toUpperCase() };
    expect(service.verifySignature(cb)).toBe(true);
  });

  it('rejects a wrong/forged signature', () => {
    const { service } = makeService({});
    expect(service.verifySignature({ ...base, signature: 'deadbeef' })).toBe(false);
    // right shape, wrong secret
    expect(service.verifySignature({ ...base, signature: sign(base, 'not-a-secret') })).toBe(false);
  });

  it('rejects everything when unconfigured (no secrets)', () => {
    const { service } = makeService({ secrets: '' });
    expect(service.verifySignature({ ...base, signature: sign(base, SECRET_A) })).toBe(false);
  });
});

describe('PlaytimeService.credit', () => {
  it('credits the amount as coins via the ledger + notifies once', async () => {
    const { service, ledger, notifications } = makeService({});
    const out = await service.credit({ ...base, signature: 'x' });
    expect(out).toBe('credited');
    expect(ledger.calls).toBe(1);
    expect(notifications.count).toBe(1);
  });

  it('is idempotent: a duplicate postback does not re-notify', async () => {
    const ledger = new FakeLedger();
    const notifications = new FakeNotifications();
    const { service } = makeService({ ledger, notifications });
    const cb: PlaytimeCallback = { ...base, signature: 'x', taskId: 't1' };
    expect(await service.credit(cb)).toBe('credited');
    expect(await service.credit(cb)).toBe('duplicate');
    expect(notifications.count).toBe(1); // only the first credit notified
  });

  it('does not credit an unknown user', async () => {
    const { service, ledger } = makeService({ userExists: false });
    expect(await service.credit({ ...base, signature: 'x' })).toBe('unknown_user');
    expect(ledger.calls).toBe(0);
  });

  it('rejects a non-positive / non-numeric amount', async () => {
    const { service } = makeService({});
    expect(await service.credit({ ...base, amount: '0', signature: 'x' })).toBe('invalid_amount');
    expect(await service.credit({ ...base, amount: 'abc', signature: 'x' })).toBe('invalid_amount');
  });

  it('uses LedgerSourceType.offer', async () => {
    const ledger = new FakeLedger();
    const recordSpy = jest.spyOn(ledger, 'record');
    const { service } = makeService({ ledger });
    await service.credit({ ...base, signature: 'x' });
    expect(recordSpy).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: LedgerSourceType.offer, amount: 100 }),
    );
  });
});

describe('PlaytimeService.androidAppKey', () => {
  it('returns null when not configured (no secrets)', () => {
    const { service } = makeService({ secrets: '' });
    expect(service.androidAppKey()).toBeNull();
  });

  it('returns the App Key (same one that signs the postback) when configured', () => {
    const { service } = makeService({});
    expect(service.androidAppKey()).toBe(APP_KEY);
  });
});
