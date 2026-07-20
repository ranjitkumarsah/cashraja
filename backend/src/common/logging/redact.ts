/**
 * Log redaction: any field with one of these names is scrubbed at every depth
 * pino's `redact` supports (top-level and wildcard paths), plus common HTTP shapes.
 * Gift-card codes and auth material must never reach log storage.
 */
export const REDACTED_FIELD_NAMES = [
  'gift_card_code',
  'code',
  'token',
  'authorization',
  'id_token',
  'access_token',
  'refresh_token',
  'challenge_token',
  'password',
  // Phase B: offer-launch URLs embed a signed launch token; secure_hash is
  // CPX's wall-URL credential derivative.
  'launch_url',
  'launch_token',
  'secure_hash',
] as const;

export function buildRedactPaths(): string[] {
  const paths: string[] = [];
  for (const field of REDACTED_FIELD_NAMES) {
    paths.push(
      field,
      `*.${field}`,
      `*.*.${field}`,
      `*.*.*.${field}`,
      `req.headers.${field}`,
      `req.body.${field}`,
      `res.headers.${field}`,
    );
  }
  return paths;
}

export const REDACT_CENSOR = '[REDACTED]';
