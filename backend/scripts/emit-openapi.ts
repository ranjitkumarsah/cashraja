/**
 * Emit the OpenAPI spec to shared/openapi.json (repo root /shared), the shared
 * API contract the admin panel and Flutter app regenerate typed clients from.
 *
 * Usage: npm run openapi:emit
 *
 * Builds the Nest application graph (no HTTP listen, no DB/Redis required —
 * connections are lazy) purely to introspect controllers/DTOs, writes the spec,
 * then tears the app down. Run after `nest build` for the richest DTO schemas
 * (the @nestjs/swagger CLI plugin augments DTO metadata at build time).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { buildOpenApiDocument } from '../src/openapi';

async function main(): Promise<void> {
  // Keep boot quiet and non-production so /api/docs assembly logic stays enabled.
  process.env.NODE_ENV = process.env.NODE_ENV === 'production' ? 'staging' : process.env.NODE_ENV ?? 'development';
  if (!process.env.LOG_LEVEL) process.env.LOG_LEVEL = 'warn';

  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    // Match the runtime routing so emitted paths equal what clients call.
    app.setGlobalPrefix('api', { exclude: ['healthz', 'readyz'] });
    const document = buildOpenApiDocument(app);
    const outPath = resolve(__dirname, '../../shared/openapi.json');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
    const pathCount = Object.keys(document.paths ?? {}).length;
    console.log(`Wrote ${outPath} (${pathCount} paths)`);
  } finally {
    await app.close();
  }
}

main().catch((err: unknown) => {
  console.error('openapi:emit failed:', err);
  process.exitCode = 1;
});
