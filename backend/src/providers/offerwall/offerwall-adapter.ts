/**
 * Offerwall adapter contract (ARCHITECTURE_PLAN §4, mock-first decision U5).
 *
 * One adapter per network. The webhook controller resolves the adapter from
 * the registry, verifies the signature FIRST (401 before anything else), then
 * parses the network-specific payload into a CanonicalPostback. Swapping mock
 * → production networks is configuration + credentials, not code.
 */

export interface PostbackRequest {
  /** Exact bytes the network sent — HMAC schemes sign the raw body. */
  rawBody: Buffer;
  /** Parsed JSON/urlencoded body (empty object when none). */
  body: Record<string, unknown>;
  /** Lower-cased header names (Node/Express convention). */
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
}

export interface CanonicalPostback {
  /** The user identifier we embedded in the launch URL (our user id). */
  networkUserId: string;
  /** Network-side unique transaction id — idempotency key is `${network}:${externalTxnId}`. */
  externalTxnId: string;
  /** Coins to credit (positive integer). */
  coins: number;
  /** Network-side offer id, when the network reports it. */
  externalOfferId?: string;
  /** Full original payload, persisted to offer_completions.network_payload. */
  raw: Record<string, unknown>;
}

export interface LaunchUser {
  id: string;
}

export interface LaunchOffer {
  id: string;
  externalOfferId: string;
}

export interface OfferwallAdapter {
  /** Route segment + offers.network value, e.g. 'mock', 'adjoe'. */
  readonly network: string;

  /**
   * True only when the request provably came from the network (HMAC / shared
   * secret per the network's documented scheme). MUST be constant-time on
   * secret comparison and MUST fail closed when credentials are missing.
   */
  verifySignature(req: PostbackRequest): boolean;

  /** Parse a VERIFIED request into the canonical shape. Throws PostbackParseError on garbage. */
  parsePostback(req: PostbackRequest): CanonicalPostback;

  /**
   * Signed launch URL for the in-app webview / SDK, embedding the user id
   * (and a short-lived signed token) for postback matching.
   */
  buildLaunchUrl(user: LaunchUser, offer: LaunchOffer, launchToken: string): string;
}

/** Thrown by parsePostback when a verified payload is still malformed. */
export class PostbackParseError extends Error {
  constructor(network: string, detail: string) {
    super(`[${network}] unparseable postback: ${detail}`);
    this.name = 'PostbackParseError';
  }
}

/** First value of a possibly-multi header/query entry, else undefined. */
export function firstValue(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

/** Required string field from body/query, else parse error. */
export function requiredString(
  network: string,
  source: Record<string, unknown>,
  field: string,
): string {
  const value = source[field];
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number') return String(value);
  throw new PostbackParseError(network, `missing/invalid field "${field}"`);
}

/** Required positive-integer coins field, else parse error. */
export function requiredCoins(
  network: string,
  source: Record<string, unknown>,
  field: string,
): number {
  const raw = source[field];
  const value = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  throw new PostbackParseError(network, `field "${field}" must be a positive integer`);
}
