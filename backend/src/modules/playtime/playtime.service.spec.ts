import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { LedgerSourceType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { NotificationHook } from '../notifications/notification-hook';
import { PlaytimeCallback, PlaytimeService } from './playtime.service';

const ANDROID_KEY = 'fbb8dbc4def00504';
const ANDROID_SECRET = 'YLGEOCTTTOCSWPZ2';
const WEB_KEY = '739339548770a4b2';
const WEB_SECRET = 'IWUA7KJOYK8QFW6B6WWEXJW5LRCI6J';

function sign(
  cb: { userId: string; offerId: string; amount: string },
  appKey: string,
  secret: string,
): string {
  return createHash('sha1')
    .update(`${cb.userId}${cb.offerId}${cb.amount}${appKey}${secret}`)
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
  android?: boolean;
  web?: boolean;
  userExists?: boolean;
  ledger?: FakeLedger;
  notifications?: FakeNotifications;
}) {
  const ledger = opts.ledger ?? new FakeLedger();
  const notifications = opts.notifications ?? new FakeNotifications();
  const service = new PlaytimeService(
    makeConfig({
      PLAYTIME_APP_KEY: opts.android === false ? '' : ANDROID_KEY,
      PLAYTIME_SECRET_KEYS: opts.android === false ? '' : ANDROID_SECRET,
      PLAYTIME_WEB_APP_KEY: opts.web ? WEB_KEY : '',
      PLAYTIME_WEB_SECRET: opts.web ? WEB_SECRET : '',
    }),
    fakePrisma(opts.userExists ?? true),
    ledger as unknown as LedgerService,
    notifications,
  );
  return { service, ledger, notifications };
}

const base = { userId: 'u1', offerId: 'o1', amount: '100' };

describe('PlaytimeService.verifySignature', () => {
  it('accepts an Android-app-signed postback', () => {
    const { service } = makeService({ web: true });
    expect(
      service.verifySignature({ ...base, signature: sign(base, ANDROID_KEY, ANDROID_SECRET) }),
    ).toBe(true);
  });

  it('accepts a Web-app-signed postback (different key + secret)', () => {
    const { service } = makeService({ web: true });
    expect(service.verifySignature({ ...base, signature: sign(base, WEB_KEY, WEB_SECRET) })).toBe(
      true,
    );
  });

  it('rejects a forged / cross-mismatched signature', () => {
    const { service } = makeService({ web: true });
    expect(service.verifySignature({ ...base, signature: 'deadbeef' })).toBe(false);
    // Android key with the web secret must NOT verify.
    expect(
      service.verifySignature({ ...base, signature: sign(base, ANDROID_KEY, WEB_SECRET) }),
    ).toBe(false);
  });

  it('rejects everything when no Playtime app is configured', () => {
    const { service } = makeService({ android: false, web: false });
    expect(
      service.verifySignature({ ...base, signature: sign(base, ANDROID_KEY, ANDROID_SECRET) }),
    ).toBe(false);
  });
});

describe('PlaytimeService.credit', () => {
  it('credits the amount as coins + notifies once', async () => {
    const { service, ledger, notifications } = makeService({});
    expect(await service.credit({ ...base, signature: 'x' })).toBe('credited');
    expect(ledger.calls).toBe(1);
    expect(notifications.count).toBe(1);
  });

  it('is idempotent: a duplicate postback does not re-notify', async () => {
    const { service, notifications } = makeService({});
    const cb: PlaytimeCallback = { ...base, signature: 'x', taskId: 't1' };
    expect(await service.credit(cb)).toBe('credited');
    expect(await service.credit(cb)).toBe('duplicate');
    expect(notifications.count).toBe(1);
  });

  it('does not credit an unknown user', async () => {
    const { service, ledger } = makeService({ userExists: false });
    expect(await service.credit({ ...base, signature: 'x' })).toBe('unknown_user');
    expect(ledger.calls).toBe(0);
  });

  it('rejects a non-positive / non-numeric amount', async () => {
    const { service } = makeService({});
    expect(await service.credit({ ...base, amount: '0', signature: 'x' })).toBe('invalid_amount');
    expect(await service.credit({ ...base, amount: 'x', signature: 'x' })).toBe('invalid_amount');
  });

  it('uses LedgerSourceType.offer', async () => {
    const ledger = new FakeLedger();
    const spy = jest.spyOn(ledger, 'record');
    const { service } = makeService({ ledger });
    await service.credit({ ...base, signature: 'x' });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: LedgerSourceType.offer, amount: 100 }),
    );
  });
});

describe('PlaytimeService app keys / wall url', () => {
  it('androidAppKey returns the SDK app key, or null when unset', () => {
    expect(makeService({}).service.androidAppKey()).toBe(ANDROID_KEY);
    expect(makeService({ android: false }).service.androidAppKey()).toBeNull();
  });

  it('webWallUrl builds the iframe URL when the web app is configured', () => {
    expect(makeService({ web: true }).service.webWallUrl('u1')).toBe(
      `https://web.playtimeads.com/index.php?app_id=${WEB_KEY}&user_id=u1`,
    );
    expect(makeService({ web: false }).service.webWallUrl('u1')).toBeNull();
  });
});
