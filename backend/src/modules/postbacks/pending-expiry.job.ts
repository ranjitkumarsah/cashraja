import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OfferCompletionStatus } from '@prisma/client';
import { AppConfigService } from '../../common/app-config/app-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';

/** app_config key controlling the pending-completion expiry window. */
export const PENDING_EXPIRY_CONFIG = {
  key: 'offers.pending_expiry_days',
  field: 'days',
  fallback: 30,
} as const;

/**
 * B2.3 / gap P5: offer_completions stuck pending longer than the configured
 * window (default 30 days — networks that were ever going to pay have paid by
 * then) are voided: status=rejected, status_reason='expired'. Never touches
 * the ledger — nothing was credited for a pending completion.
 */
@Injectable()
export class PendingExpiryJob {
  private readonly logger = new Logger(PendingExpiryJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfigService,
  ) {}

  @Cron('0 3 * * *', { name: 'pending-completion-expiry' })
  async handleCron(): Promise<void> {
    try {
      const expired = await this.run();
      this.logger.log(`Pending-completion expiry done: ${expired} completion(s) voided`);
    } catch (err) {
      this.logger.error(`Pending-completion expiry failed: ${(err as Error).message}`);
    }
  }

  /** Expire and return the number of voided completions. */
  async run(now: Date = new Date()): Promise<number> {
    const days = await this.appConfig.getNumber(
      PENDING_EXPIRY_CONFIG.key,
      PENDING_EXPIRY_CONFIG.field,
      PENDING_EXPIRY_CONFIG.fallback,
    );
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const result = await this.prisma.offerCompletion.updateMany({
      where: { status: OfferCompletionStatus.pending, createdAt: { lt: cutoff } },
      data: { status: OfferCompletionStatus.rejected, statusReason: 'expired' },
    });
    return result.count;
  }
}
