import { z } from 'zod';

/**
 * Zod-validated environment schema. Dev defaults match docker-compose.yml and
 * backend/.env.example; production refuses to boot with known dev-default secrets.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),

    DATABASE_URL: z
      .string()
      .url()
      .default('postgresql://cashraja:cashraja@localhost:5432/cashraja?schema=public'),
    REDIS_URL: z.string().url().default('redis://localhost:6379'),

    JWT_ACCESS_SECRET: z.string().min(16).default('dev-access-secret-change-me'),
    JWT_REFRESH_SECRET: z.string().min(16).default('dev-refresh-secret-change-me'),
    JWT_ADMIN_SECRET: z.string().min(16).default('dev-admin-secret-change-me'),

    // AES-256-GCM key for gift-card code column encryption: 64 hex chars (32 bytes)
    AES_KEY: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/, 'AES_KEY must be 64 hex characters (32 bytes)')
      .default('0000000000000000000000000000000000000000000000000000000000000000'),

    // Firebase ID-token verification driver: mock (dev/test only) or firebase (Admin SDK).
    FIREBASE_VERIFIER: z.enum(['mock', 'firebase']).default('mock'),
    // Service-account JSON for the firebase driver; empty = Application Default Credentials.
    FIREBASE_SERVICE_ACCOUNT_JSON: z.string().default(''),

    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    // ── Provider adapter layer (Phase B, ARCHITECTURE_PLAN §4) ──
    // Comma lists of ENABLED networks; unknown names are ignored with a warning.
    // 'mock' drivers are dev/staging only (refused in production below).
    OFFERWALL_NETWORKS: z.string().default('mock'),
    AD_NETWORKS: z.string().default('mock'),
    // Mock driver HMAC secrets (deterministic signatures for the simulator/E2E).
    MOCK_OFFERWALL_SECRET: z.string().min(8).default('dev-mock-offerwall-secret'),
    MOCK_AD_SSV_SECRET: z.string().min(8).default('dev-mock-ad-ssv-secret'),
    // Real-network credentials — NEEDS_CREDENTIALS: adapters fail closed while empty.
    ADJOE_S2S_SECRET: z.string().default(''),
    ADGATE_POSTBACK_SECRET: z.string().default(''),
    ADGATE_WALL_ID: z.string().default(''),
    OFFERTORO_SECRET_KEY: z.string().default(''),
    OFFERTORO_APP_ID: z.string().default(''),
    OFFERTORO_PUB_ID: z.string().default(''),
    CPX_SECURE_HASH: z.string().default(''),
    CPX_APP_ID: z.string().default(''),
    APPLOVIN_CALLBACK_TOKEN: z.string().default(''),
    LEVELPLAY_PRIVATE_KEY: z.string().default(''),
    ADMOB_SSV_KEY_SERVER_URL: z.union([z.string().url(), z.literal('')]).default(''),
    // Postback worker toggle (false = run intake and worker as separate processes).
    POSTBACK_WORKER_ENABLED: z.enum(['true', 'false']).default('true'),

    // Reconciliation / fraud-spike alert destination (Slack-compatible webhook). Empty = console alerts.
    ALERT_WEBHOOK_URL: z.union([z.string().url(), z.literal('')]).default(''),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      const devDefaults: Array<[keyof typeof env, string]> = [
        ['JWT_ACCESS_SECRET', 'dev-access-secret-change-me'],
        ['JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'],
        ['JWT_ADMIN_SECRET', 'dev-admin-secret-change-me'],
        [
          'AES_KEY',
          '0000000000000000000000000000000000000000000000000000000000000000',
        ],
      ];
      for (const [key, devValue] of devDefaults) {
        if (env[key] === devValue) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${String(key)} must not use the dev default in production`,
          });
        }
      }
      if (env.FIREBASE_VERIFIER === 'mock') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['FIREBASE_VERIFIER'],
          message: 'FIREBASE_VERIFIER must not be "mock" in production',
        });
      }
      // Mock earn drivers accept deterministic dev signatures — never in prod.
      for (const key of ['OFFERWALL_NETWORKS', 'AD_NETWORKS'] as const) {
        const networks = env[key].split(',').map((n) => n.trim());
        if (networks.includes('mock')) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} must not include "mock" in production`,
          });
        }
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration — ${details}`);
  }
  return parsed.data;
}
