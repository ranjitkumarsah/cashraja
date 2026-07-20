import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { AdjoeAdapter } from './adjoe.adapter';
import { AdgateAdapter } from './adgate.adapter';
import { CpxAdapter } from './cpx.adapter';
import { MOCK_SIGNATURE_HEADER, MockOfferwallAdapter } from './mock-offerwall.adapter';
import { OffertoroAdapter } from './offertoro.adapter';
import { OfferwallRegistryService } from './offerwall-registry.service';
import { PostbackParseError, PostbackRequest } from './offerwall-adapter';

const SECRET = 'unit-test-secret';

function requestOf(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
  query: Record<string, string> = {},
): PostbackRequest {
  const raw = Buffer.from(JSON.stringify(body), 'utf8');
  return { rawBody: raw, body, headers, query };
}

function signedRequest(body: Record<string, unknown>): PostbackRequest {
  const raw = Buffer.from(JSON.stringify(body), 'utf8');
  return {
    rawBody: raw,
    body,
    headers: { [MOCK_SIGNATURE_HEADER]: MockOfferwallAdapter.sign(raw, SECRET) },
    query: {},
  };
}

function configStub(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('MockOfferwallAdapter', () => {
  const adapter = new MockOfferwallAdapter(SECRET);

  it('accepts a valid HMAC-SHA256 signature over the raw body', () => {
    const req = signedRequest({ user_id: 'u1', txn_id: 't1', coins: 100 });
    expect(adapter.verifySignature(req)).toBe(true);
  });

  it('rejects a tampered body (signature no longer matches raw bytes)', () => {
    const req = signedRequest({ user_id: 'u1', txn_id: 't1', coins: 100 });
    const tampered = { ...req, rawBody: Buffer.from('{"coins":100000}', 'utf8') };
    expect(adapter.verifySignature(tampered)).toBe(false);
  });

  it('rejects a wrong-secret signature and a missing header', () => {
    const body = { user_id: 'u1', txn_id: 't1', coins: 100 };
    const raw = Buffer.from(JSON.stringify(body), 'utf8');
    const wrongSig = {
      rawBody: raw,
      body,
      headers: { [MOCK_SIGNATURE_HEADER]: MockOfferwallAdapter.sign(raw, 'other-secret') },
      query: {},
    };
    expect(adapter.verifySignature(wrongSig)).toBe(false);
    expect(adapter.verifySignature(requestOf(body))).toBe(false);
  });

  it('fails closed when the secret is not configured', () => {
    const noSecret = new MockOfferwallAdapter('');
    expect(noSecret.verifySignature(signedRequest({ user_id: 'u1' }))).toBe(false);
  });

  it('parses the canonical postback (coins as number or numeric string)', () => {
    const parsed = adapter.parsePostback(
      requestOf({ user_id: 'u1', txn_id: 't1', coins: 100, offer_id: 'mock-1', extra: 'x' }),
    );
    expect(parsed).toMatchObject({
      networkUserId: 'u1',
      externalTxnId: 't1',
      coins: 100,
      externalOfferId: 'mock-1',
    });
    expect(parsed.raw).toMatchObject({ extra: 'x' });

    const stringCoins = adapter.parsePostback(
      requestOf({ user_id: 'u1', txn_id: 't2', coins: '250' }),
    );
    expect(stringCoins.coins).toBe(250);
    expect(stringCoins.externalOfferId).toBeUndefined();
  });

  it.each<Record<string, unknown>>([
    { txn_id: 't', coins: 5 },
    { user_id: 'u', coins: 5 },
    { user_id: 'u', txn_id: 't' },
    { user_id: 'u', txn_id: 't', coins: 0 },
    { user_id: 'u', txn_id: 't', coins: -5 },
    { user_id: 'u', txn_id: 't', coins: 1.5 },
  ])('rejects malformed payload %j with PostbackParseError', (body) => {
    expect(() => adapter.parsePostback(requestOf(body))).toThrow(PostbackParseError);
  });

  it('builds a launch URL embedding user id, offer and launch token', () => {
    const url = new URL(
      adapter.buildLaunchUrl({ id: 'user-1' }, { id: 'o1', externalOfferId: 'mock-1' }, 'tok-123'),
    );
    expect(url.searchParams.get('user')).toBe('user-1');
    expect(url.searchParams.get('offer')).toBe('mock-1');
    expect(url.searchParams.get('token')).toBe('tok-123');
  });
});

describe('real-network skeletons (NEEDS_CREDENTIALS)', () => {
  it('all fail closed with empty credentials', () => {
    const req = requestOf({}, {}, { sid: 'x', hash: 'x', sig: 'x' });
    expect(new AdjoeAdapter('').verifySignature(req)).toBe(false);
    expect(new AdgateAdapter('', '').verifySignature(req)).toBe(false);
    expect(new OffertoroAdapter('', '', '').verifySignature(req)).toBe(false);
    expect(new CpxAdapter('', '').verifySignature(req)).toBe(false);
  });

  it('adjoe: sha1(user_uuid + trans_uuid + coin_amount + secret) as ?sid=', () => {
    const adapter = new AdjoeAdapter(SECRET);
    const query = { user_uuid: 'u1', trans_uuid: 'tx1', coin_amount: '500' };
    const sid = createHash('sha1').update(`u1tx1500${SECRET}`).digest('hex');
    expect(adapter.verifySignature(requestOf({}, {}, { ...query, sid }))).toBe(true);
    expect(adapter.verifySignature(requestOf({}, {}, { ...query, sid: `0${sid.slice(1)}` }))).toBe(
      false,
    );

    const parsed = adapter.parsePostback(requestOf({}, {}, { ...query, sid }));
    expect(parsed).toMatchObject({ networkUserId: 'u1', externalTxnId: 'tx1', coins: 500 });
  });

  it('offertoro: md5(oid-user_id-secret) as ?sig=', () => {
    const adapter = new OffertoroAdapter(SECRET, 'app', 'pub');
    const query = { oid: '77', user_id: 'u1', amount: '120', o_trans_id: 'ot-1' };
    const sig = createHash('md5').update(`77-u1-${SECRET}`).digest('hex');
    expect(adapter.verifySignature(requestOf({}, {}, { ...query, sig }))).toBe(true);
    expect(adapter.verifySignature(requestOf({}, {}, { ...query, sig: sig.toUpperCase() }))).toBe(
      true, // case-insensitive hex compare
    );
    expect(adapter.verifySignature(requestOf({}, {}, { ...query, sig: `0${sig.slice(1)}` }))).toBe(
      false,
    );
    const parsed = adapter.parsePostback(requestOf({}, {}, { ...query, sig }));
    expect(parsed).toMatchObject({
      networkUserId: 'u1',
      externalTxnId: 'ot-1',
      coins: 120,
      externalOfferId: '77',
    });
  });

  it('cpx: md5(trans_id-secure_hash) as ?hash=', () => {
    const adapter = new CpxAdapter(SECRET, 'app-1');
    const query = { trans_id: 'ct-1', user_id: 'u1', amount_local: '80' };
    const hash = createHash('md5').update(`ct-1-${SECRET}`).digest('hex');
    expect(adapter.verifySignature(requestOf({}, {}, { ...query, hash }))).toBe(true);
    expect(
      adapter.verifySignature(requestOf({}, {}, { ...query, hash: `0${hash.slice(1)}` })),
    ).toBe(false);
  });

  it('adgate: md5(tx_id + secret) as ?hash= and wall launch URL', () => {
    const adapter = new AdgateAdapter(SECRET, 'wall-9');
    const query = { tx_id: 'ag-1', user_id: 'u1', points: '60' };
    const hash = createHash('md5').update(`ag-1${SECRET}`).digest('hex');
    expect(adapter.verifySignature(requestOf({}, {}, { ...query, hash }))).toBe(true);

    const url = adapter.buildLaunchUrl({ id: 'u1' }, { id: 'o', externalOfferId: 'x' }, 'tok');
    expect(url).toContain('wall-9/u1');
  });
});

describe('OfferwallRegistryService', () => {
  it('enables only networks in OFFERWALL_NETWORKS (default mock)', () => {
    const registry = new OfferwallRegistryService(
      configStub({ MOCK_OFFERWALL_SECRET: SECRET }),
    );
    expect(registry.enabledNetworks()).toEqual(['mock']);
    expect(registry.resolve('mock')?.network).toBe('mock');
    expect(registry.resolve('adjoe')).toBeUndefined(); // exists but disabled
    expect(registry.resolve('nope')).toBeUndefined(); // unknown
  });

  it('honors an explicit enable list and ignores unknown names', () => {
    const registry = new OfferwallRegistryService(
      configStub({
        OFFERWALL_NETWORKS: 'mock, adjoe,bogus',
        MOCK_OFFERWALL_SECRET: SECRET,
        ADJOE_S2S_SECRET: 'x',
      }),
    );
    expect(registry.enabledNetworks().sort()).toEqual(['adjoe', 'mock']);
    expect(registry.isEnabled('adjoe')).toBe(true);
    expect(registry.isEnabled('bogus')).toBe(false);
  });

  it('can disable everything (empty list)', () => {
    const registry = new OfferwallRegistryService(configStub({ OFFERWALL_NETWORKS: ' ' }));
    expect(registry.enabledNetworks()).toEqual([]);
  });
});
