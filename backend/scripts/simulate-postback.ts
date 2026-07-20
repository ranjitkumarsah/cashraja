/**
 * Sandbox postback simulator (B1.2): signs a mock-network postback exactly the
 * way the mock adapter verifies it and POSTs it to the local webhook.
 *
 * Usage:
 *   npm run simulate:postback -- --network=mock --user=<uuid> --coins=100
 *     [--txn=<id>]        transaction id (default: random)
 *     [--offer=<ext-id>]  external offer id (e.g. mock-survey-1)
 *     [--url=<base>]      backend base URL (default http://localhost:3000)
 *     [--replay]          send the same txn a second time (dedupe demo)
 *     [--bad-sig]         corrupt the signature (expect 401)
 *
 * The secret comes from MOCK_OFFERWALL_SECRET (default matches env.schema.ts).
 * Only the mock network is supported — real networks sign on their side.
 */
import { randomUUID } from 'node:crypto';
import {
  MOCK_SIGNATURE_HEADER,
  MockOfferwallAdapter,
} from '../src/providers/offerwall/mock-offerwall.adapter';

interface Args {
  network: string;
  user?: string;
  coins: number;
  txn: string;
  offer?: string;
  url: string;
  replay: boolean;
  badSig: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | undefined => {
    const withEq = argv.find((a) => a.startsWith(`--${name}=`));
    if (withEq !== undefined) return withEq.slice(name.length + 3);
    const idx = argv.indexOf(`--${name}`);
    if (idx >= 0 && argv[idx + 1] !== undefined && !argv[idx + 1]?.startsWith('--')) {
      return argv[idx + 1];
    }
    return undefined;
  };
  const has = (name: string): boolean => argv.some((a) => a === `--${name}`);

  return {
    network: get('network') ?? 'mock',
    user: get('user'),
    coins: Number(get('coins') ?? '100'),
    txn: get('txn') ?? `sim-${randomUUID()}`,
    offer: get('offer'),
    url: (get('url') ?? 'http://localhost:3000').replace(/\/$/, ''),
    replay: has('replay'),
    badSig: has('bad-sig'),
  };
}

async function send(args: Args, attempt: number): Promise<void> {
  const body = JSON.stringify({
    user_id: args.user,
    txn_id: args.txn,
    coins: args.coins,
    ...(args.offer !== undefined ? { offer_id: args.offer } : {}),
    simulated_at: new Date().toISOString(),
  });

  const secret = process.env.MOCK_OFFERWALL_SECRET ?? 'dev-mock-offerwall-secret';
  let signature = MockOfferwallAdapter.sign(body, secret);
  if (args.badSig) {
    signature = signature.replace(/^./, signature.startsWith('0') ? '1' : '0');
  }

  const endpoint = `${args.url}/api/webhooks/offerwall/${args.network}`;
  const started = Date.now();
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', [MOCK_SIGNATURE_HEADER]: signature },
    body,
  });
  const elapsed = Date.now() - started;
  const text = await res.text();
  console.log(
    `[${attempt}] POST ${endpoint} txn=${args.txn} coins=${args.coins}` +
      `${args.badSig ? ' (BAD SIGNATURE)' : ''} → ${res.status} in ${elapsed}ms: ${text}`,
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.network !== 'mock') {
    console.error(`Only --network=mock is supported (got "${args.network}").`);
    process.exitCode = 1;
    return;
  }
  if (args.user === undefined || args.user === '') {
    console.error('Missing --user=<uuid> (the app user to credit).');
    process.exitCode = 1;
    return;
  }
  if (!Number.isInteger(args.coins) || args.coins <= 0) {
    console.error(`--coins must be a positive integer (got "${args.coins}").`);
    process.exitCode = 1;
    return;
  }

  await send(args, 1);
  if (args.replay) {
    await send(args, 2); // same txn — expect {"status":"duplicate"} and no double credit
  }
}

main().catch((err: unknown) => {
  console.error((err as Error).message);
  process.exitCode = 1;
});
