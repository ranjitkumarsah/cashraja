import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/**
 * Single source of truth for the Cash Raja OpenAPI document, shared by:
 *   - main.ts (serves interactive docs at /api/docs in non-prod), and
 *   - scripts/emit-openapi.ts (writes shared/openapi.json for typed-client gen
 *     in the admin panel + Flutter app).
 * The global 'api' prefix is baked into the served paths, so the spec is
 * emitted with the same prefix clients call.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Cash Raja API')
    .setDescription(
      'Coin-rewards backend: auth, wallet/ledger, offers & ads postbacks, engagement ' +
        '(game/streak/scratch-spin/referral), redemptions, notifications, fraud, and the admin API.',
    )
    .setVersion('1.0.0')
    // App-user JWT (aud=app) — most user endpoints.
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'App-user access token (aud=app)' },
      'user',
    )
    // Admin JWT (aud=admin) — /api/admin/* endpoints.
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Admin access token (aud=admin)' },
      'admin',
    )
    .addServer('/', 'default')
    .build();

  return SwaggerModule.createDocument(app, config);
}

export const OPENAPI_DOCS_PATH = 'api/docs';
