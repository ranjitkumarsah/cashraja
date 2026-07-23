import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AlertsModule } from './common/alerts/alerts.module';
import { AppConfigModule } from './common/app-config/app-config.module';
import { validateEnv } from './common/config/env.schema';
import { CryptoModule } from './common/crypto/crypto.module';
import { buildRedactPaths, REDACT_CENSOR } from './common/logging/redact';
import { PrismaModule } from './common/prisma/prisma.module';
import { JobsModule } from './jobs/jobs.module';
import { AccountModule } from './modules/account/account.module';
import { AdsModule } from './modules/ads/ads.module';
import { AdminModule } from './modules/admin/admin.module';
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module';
import { AuthModule } from './modules/auth/auth.module';
import { BonusModule } from './modules/bonus/bonus.module';
import { GameModule } from './modules/game/game.module';
import { GiftCardsModule } from './modules/gift-cards/gift-cards.module';
import { HealthModule } from './modules/health/health.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { OffersModule } from './modules/offers/offers.module';
import { PostbacksModule } from './modules/postbacks/postbacks.module';
import { RedemptionsModule } from './modules/redemptions/redemptions.module';
import { ReferralModule } from './modules/referral/referral.module';
import { StreakModule } from './modules/streak/streak.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { ProvidersModule } from './providers/providers.module';

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
    AppConfigModule,
    CryptoModule,
    HealthModule,
    LedgerModule,
    AuthModule,
    AdminAuthModule,
    ProvidersModule,
    PostbacksModule,
    OffersModule,
    WalletModule,
    UsersModule,
    GiftCardsModule,
    RedemptionsModule,
    AdminModule,
    MetricsModule,
    AccountModule,
    ReferralModule,
    GameModule,
    StreakModule,
    BonusModule,
    AdsModule,
    JobsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
