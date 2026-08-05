import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
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
    app.useStaticAssets(clientDir);
    const indexHtml = join(clientDir, 'index.html');
    // SPA fallback: a GET for a non-API, extension-less path (a client-side
    // route like /, /privacy, /admin/dashboard) returns index.html so deep
    // links and reloads resolve. Real assets and /api/* pass through.
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      const p = req.path;
      if (p.startsWith('/api') || p === '/healthz' || p === '/readyz') return next();
      if (extname(p)) return next();
      // Serve the prerendered static page for a public route (SEO: crawlers get
      // real HTML + head), when one exists. Safe-char paths only (no traversal).
      // Everything else (the app + /admin/*) gets the SPA shell.
      if (p !== '/' && /^\/[a-zA-Z0-9\-/]+$/.test(p)) {
        const prerendered = join(clientDir, p, 'index.html');
        if (existsSync(prerendered)) return res.sendFile(prerendered);
      }
      res.sendFile(indexHtml);
    });
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
