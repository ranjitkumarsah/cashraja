import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { RedemptionStatus } from '@prisma/client';
import { ALERT_SERVICE, AlertService } from '../../common/alerts/alert.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { redisConnectionOptions } from '../postbacks/postback-queue';
import { RedemptionsService } from './redemptions.service';
import {
  REDEMPTION_JOB_OPTIONS,
  REDEMPTION_QUEUE_NAME,
  RedemptionJobData,
} from './redemption-queue';

/**
 * BullMQ worker draining `redemption-fulfillment` (C2.3). Re-attempts issuing a
 * paid-but-unfulfilled redemption; still-out-of-stock throws so BullMQ backs
 * off and retries later (up to REDEMPTION_JOB_OPTIONS.attempts). A job that
 * exhausts every attempt stays in the failed set and raises an alert — a paid
 * redemption is never silently dropped.
 *
 * Shares the POSTBACK_WORKER_ENABLED toggle so the whole worker layer can be
 * split into its own process.
 */
@Injectable()
export class RedemptionRetryWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedemptionRetryWorker.name);
  private worker: Worker<RedemptionJobData> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redemptions: RedemptionsService,
    @Optional() @Inject(ALERT_SERVICE) private readonly alerts?: AlertService,
  ) {}

  onModuleInit(): void {
    if ((this.config.get<string>('POSTBACK_WORKER_ENABLED') ?? 'true') === 'false') {
      this.logger.log('Redemption retry worker disabled (POSTBACK_WORKER_ENABLED=false)');
      return;
    }
    const redisUrl = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.worker = new Worker<RedemptionJobData>(
      REDEMPTION_QUEUE_NAME,
      (job: Job<RedemptionJobData>) => this.process(job.data),
      { connection: redisConnectionOptions(redisUrl), concurrency: 5 },
    );

    this.worker.on('failed', (job, err) => {
      const attemptsMade = job?.attemptsMade ?? 0;
      const maxAttempts = job?.opts.attempts ?? REDEMPTION_JOB_OPTIONS.attempts;
      this.logger.warn(
        `redemption retry ${job?.data.redemptionId ?? '?'} failed (attempt ${attemptsMade}/${maxAttempts}): ${err.message}`,
      );
      if (attemptsMade >= maxAttempts) {
        void this.alerts?.alert({
          type: 'redemption_fulfillment_exhausted',
          message: `Redemption ${job?.data.redemptionId} still unfulfilled after ${maxAttempts} attempts — needs manual fulfilment`,
          details: { redemptionId: job?.data.redemptionId, error: err.message },
        });
      }
    });
    this.worker.on('error', (err) => this.logger.error(`redemption worker error: ${err.message}`));
    this.logger.log(`Redemption retry worker started on queue "${REDEMPTION_QUEUE_NAME}"`);
  }

  /** Re-attempt fulfilment. Throws while still unfulfilled so BullMQ retries. */
  async process(data: RedemptionJobData): Promise<void> {
    const redemption = await this.prisma.redemption.findUnique({
      where: { id: data.redemptionId },
      select: { status: true, reviewedByAdminId: true },
    });
    if (!redemption) {
      this.logger.warn(`retry for missing redemption ${data.redemptionId} — skipped`);
      return;
    }
    if (redemption.status !== RedemptionStatus.approved) {
      return; // already issued / rejected / held — idempotent no-op
    }

    const adminId = redemption.reviewedByAdminId;
    if (!adminId) {
      this.logger.error(`retry ${data.redemptionId}: approved redemption has no reviewer — skipped`);
      return;
    }

    const outcome = await this.redemptions.attemptFulfillment(data.redemptionId, adminId, {
      enqueueOnFailure: false,
    });
    if (outcome.status !== 'issued') {
      // Still out of stock — throw so BullMQ backs off and retries.
      throw new Error(`redemption ${data.redemptionId} still unfulfilled (${outcome.reason})`);
    }
    this.logger.log(`redemption ${data.redemptionId} fulfilled on retry`);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }
}
