import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { AdNetwork } from '@prisma/client';
import { PostbackRequest } from '../offerwall/offerwall-adapter';
import { AdSsvRegistryService } from './ad-ssv-registry.service';
import { AdmobAdSsvAdapter } from './admob-ad-ssv.adapter';
import { ApplovinAdSsvAdapter } from './applovin-ad-ssv.adapter';
import { LevelplayAdSsvAdapter } from './levelplay-ad-ssv.adapter';
import { MOCK_AD_SIGNATURE_HEADER, MockAdSsvAdapter } from './mock-ad-ssv.adapter';

const SECRET = 'unit-test-ad-secret';

function requestOf(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
  query: Record<string, string> = {},
): PostbackRequest {
  const raw = Buffer.from(JSON.stringify(body), 'utf8');
  return { rawBody: raw, body, headers, query };
}

function signed(body: Record<string, unknown>): PostbackRequest {
  const raw = Buffer.from(JSON.stringify(body), 'utf8');
  return {
    rawBody: raw,
    body,
    headers: { [MOCK_AD_SIGNATURE_HEADER]: MockAdSsvAdapter.sign(raw, SECRET) },
    query: {},
  };
}

describe('MockAdSsvAdapter', () => {
  const adapter = new MockAdSsvAdapter(SECRET);

  it('verifies a valid callback and parses the reward', async () => {
    const reward = await adapter.verifyCallback(
      signed({ user_id: 'u1', txn_id: 'ad-1', ad_unit_id: 'mock-rewarded', reward: 7 }),
    );
    expect(reward).toMatchObject({
      networkUserId: 'u1',
      externalTxnId: 'ad-1',
      adUnitId: 'mock-rewarded',
      rewardAmount: 7,
    });
  });

  it('reward field is optional (server-side config amount applies)', async () => {
    const reward = await adapter.verifyCallback(
      signed({ user_id: 'u1', txn_id: 'ad-2', ad_unit_id: 'mock-rewarded' }),
    );
    expect(reward?.rewardAmount).toBeUndefined();
  });

  it('returns null on bad signature, missing fields, missing secret', async () => {
    const body = { user_id: 'u1', txn_id: 'ad-3', ad_unit_id: 'mock-rewarded' };
    await expect(adapter.verifyCallback(requestOf(body))).resolves.toBeNull(); // no header
    const tampered = { ...signed(body), rawBody: Buffer.from('{}', 'utf8') };
    await expect(adapter.verifyCallback(tampered)).resolves.toBeNull();
    await expect(adapter.verifyCallback(signed({ user_id: 'u1' }))).resolves.toBeNull();
    await expect(new MockAdSsvAdapter('').verifyCallback(signed(body))).resolves.toBeNull();
  });
});

describe('ad SSV skeletons (NEEDS_CREDENTIALS)', () => {
  it('applovin: shared callback token, fails closed when unset', async () => {
    const query = {
      token: 'cb-token',
      user_id: 'u1',
      event_id: 'ev-1',
      ad_unit_id: 'al-rewarded',
      amount: '3',
    };
    const adapter = new ApplovinAdSsvAdapter('cb-token');
    const ok = await adapter.verifyCallback(requestOf({}, {}, query));
    expect(ok).toMatchObject({ networkUserId: 'u1', externalTxnId: 'ev-1', rewardAmount: 3 });

    await expect(
      adapter.verifyCallback(requestOf({}, {}, { ...query, token: 'wrong' })),
    ).resolves.toBeNull();
    await expect(
      new ApplovinAdSsvAdapter('').verifyCallback(requestOf({}, {}, query)),
    ).resolves.toBeNull();
  });

  it('levelplay: md5(timestamp+eventId+userId+rewards+privateKey)', async () => {
    const adapter = new LevelplayAdSsvAdapter(SECRET);
    const base = { timestamp: '1700000000', eventId: 'lp-1', userId: 'u1', rewards: '4' };
    const signature = createHash('md5').update(`1700000000lp-1u14${SECRET}`).digest('hex');
    const ok = await adapter.verifyCallback(requestOf({}, {}, { ...base, signature }));
    expect(ok).toMatchObject({ networkUserId: 'u1', externalTxnId: 'lp-1', rewardAmount: 4 });

    await expect(
      adapter.verifyCallback(
        requestOf({}, {}, { ...base, signature: `0${signature.slice(1)}` }),
      ),
    ).resolves.toBeNull();
    await expect(
      new LevelplayAdSsvAdapter('').verifyCallback(requestOf({}, {}, { ...base, signature })),
    ).resolves.toBeNull();
  });

  it('admob: fails closed without a key server and rejects unknown key ids', async () => {
    const unconfigured = new AdmobAdSsvAdapter('');
    await expect(unconfigured.verifyCallback(requestOf({}, {}, {}))).resolves.toBeNull();

    const withKeys = new AdmobAdSsvAdapter('http://keys.local', async () => []);
    const query = {
      user_id: 'u1',
      reward_amount: '5',
      transaction_id: 'tx',
      key_id: '99',
      signature: 'c2ln',
    };
    await expect(withKeys.verifyCallback(requestOf({}, {}, query))).resolves.toBeNull();
  });
});

describe('AdSsvRegistryService', () => {
  const configStub = (values: Record<string, string>): ConfigService =>
    ({ get: (key: string) => values[key] }) as unknown as ConfigService;

  it('defaults to mock only and maps to the AdNetwork enum value', () => {
    const registry = new AdSsvRegistryService(configStub({ MOCK_AD_SSV_SECRET: SECRET }));
    expect(registry.enabledNetworks()).toEqual(['mock']);
    expect(registry.resolve('mock')?.dbNetwork).toBe(AdNetwork.mock);
    expect(registry.resolve('admob')).toBeUndefined();
  });

  it('enables listed networks with their enum mapping', () => {
    const registry = new AdSsvRegistryService(
      configStub({ AD_NETWORKS: 'applovin,levelplay', APPLOVIN_CALLBACK_TOKEN: 'x' }),
    );
    expect(registry.resolve('applovin')?.dbNetwork).toBe(AdNetwork.applovin_max);
    expect(registry.resolve('levelplay')?.dbNetwork).toBe(AdNetwork.unity_levelplay);
    expect(registry.resolve('mock')).toBeUndefined();
  });
});
