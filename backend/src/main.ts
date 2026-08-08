import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { securityHeaders } from './common/security/security-headers';
import { buildOpenApiDocument, OPENAPI_DOCS_PATH } from './openapi';
import { createSpaFallback } from './spa-fallback';

async function bootstrap(): Promise<void> {
  // rawBody: webhook HMAC schemes sign the exact bytes the network sent
  // (adapters verify against req.rawBody, never the re-serialized body).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(new LoggerErrorInterceptor());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api', { exclude: ['healthz', 'readyz'] });
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  const isProd = config.get<string>('NODE_ENV') === 'production';
  const isTls = isProd || config.get<string>('NODE_ENV') === 'staging';

  // Security response headers (JSON API — no helmet dependency needed) + drop
  // the framework-fingerprinting X-Powered-By banner.
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use((req: Request, res: Response, next: NextFunction) =>
    securityHeaders(isTls)(req, res, next),
  );

  // CORS: only the configured browser origins (admin panel + landing) may call
  // the API with credentials. The Flutter app is not a browser and is unaffected.
  const corsOrigins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  });

  // Bundled admin panel + marketing landing SPA. The Vite build is copied to
  // ../client in the production image (see Dockerfile), so one Fly app serves
  // the API, admin, and landing on the same origin — the admin's relative `/api`
  // just works and no browser CORS is involved. Absent in dev (Vite serves it).
  const clientDir = join(__dirname, '..', 'client');
  if (existsSync(clientDir)) {
    // redirect:false — do NOT 301 a directory path like /how-to-earn to
    // /how-to-earn/. The canonical URL is the no-slash form; the SPA fallback
    // below serves the prerendered file for it at 200 (a redirect to the slash
    // form made the SPA see a trailing-slash path and wrongly noindex it).
    app.useStaticAssets(clientDir, { redirect: false });
    // Prerendered public page -> 200; app/admin route -> noindex shell 200;
    // anything else -> noindex shell 404. See src/spa-fallback.ts.
    app.use(createSpaFallback(clientDir));
  }

  // Interactive API docs (+ live spec) — non-prod only. The committed
  // shared/openapi.json is regenerated via `npm run openapi:emit`.
  if (config.get<string>('NODE_ENV') !== 'production') {
    const document = buildOpenApiDocument(app);
    SwaggerModule.setup(OPENAPI_DOCS_PATH, app, document, {
      jsonDocumentUrl: `${OPENAPI_DOCS_PATH}/json`,
    });
  }

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
}

void bootstrap();
