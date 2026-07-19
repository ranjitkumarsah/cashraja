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
