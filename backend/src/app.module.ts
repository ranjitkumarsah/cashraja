import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AlertsModule } from './common/alerts/alerts.module';
import { validateEnv } from './common/config/env.schema';
import { buildRedactPaths, REDACT_CENSOR } from './common/logging/redact';
import { PrismaModule } from './common/prisma/prisma.module';
import { JobsModule } from './jobs/jobs.module';
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { LedgerModule } from './modules/ledger/ledger.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL') ?? 'info',
          // Secrets never reach log storage: gift_card_code / code / token / authorization
          // are censored at every logged depth.
          redact: { paths: buildRedactPaths(), censor: REDACT_CENSOR },
          autoLogging: {
            ignore: (req) => req.url === '/healthz' || req.url === '/readyz',
          },
          transport:
            config.get<string>('NODE_ENV') === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
        },
      }),
    }),
    ScheduleModule.forRoot(),
    // No default secret/audience: every sign/verify call passes its own
    // (JWT_ACCESS_SECRET vs JWT_ADMIN_SECRET — hard audience separation).
    JwtModule.register({ global: true }),
    // Generous global default; credential endpoints (admin-auth) override
    // with strict per-route @Throttle limits (ARCHITECTURE_PLAN §2.5).
    ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }] }),
    PrismaModule,
    AlertsModule,
    HealthModule,
    LedgerModule,
    AuthModule,
    AdminAuthModule,
    JobsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
