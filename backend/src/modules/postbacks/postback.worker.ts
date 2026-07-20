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
import { ALERT_SERVICE, AlertService } from '../../common/alerts/alert.service';
import { PostbackProcessorService } from './postback-processor.service';
import {
  POSTBACK_JOB_OPTIONS,
  POSTBACK_QUEUE_NAME,
  PostbackJobData,
  redisConnectionOptions,
} from './postback-queue';

/**
 * BullMQ worker draining `postback-processing` (ARCHITECTURE_PLAN §6).
 * Retries with exponential backoff (see POSTBACK_JOB_OPTIONS); a job that
 * exhausts every attempt stays in the failed set (poison) and raises an
 * alert through ALERT_SERVICE.
 *
 * Disable with POSTBACK_WORKER_ENABLED=false to run webhook intake and the
 * worker as separate processes.
 */
@Injectable()
export class PostbackWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(PostbackWorker.name);
  private worker: Worker<PostbackJobData> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly processor: PostbackProcessorService,
    @Optional() @Inject(ALERT_SERVICE) private readonly alerts?: AlertService,
  ) {}

  onModuleInit(): void {
    if ((this.config.get<string>('POSTBACK_WORKER_ENABLED') ?? 'true') === 'false') {
      this.logger.log('Postback worker disabled (POSTBACK_WORKER_ENABLED=false)');
      return;
    }
    const redisUrl = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.worker = new Worker<PostbackJobData>(
      POSTBACK_QUEUE_NAME,
      (job: Job<PostbackJobData>) => this.processor.process(job.data),
      { connection: redisConnectionOptions(redisUrl), concurrency: 10 },
    );

    this.worker.on('failed', (job, err) => {
      const attemptsMade = job?.attemptsMade ?? 0;
      const maxAttempts = job?.opts.attempts ?? POSTBACK_JOB_OPTIONS.attempts;
      this.logger.error(
        `postback job ${job?.id ?? '?'} failed (attempt ${attemptsMade}/${maxAttempts}): ${err.message}`,
      );
      if (attemptsMade >= maxAttempts) {
        void this.alerts?.alert({
          type: 'postback_job_poisoned',
          message: `Postback job exhausted ${maxAttempts} attempts and landed in the failed set`,
          details: { jobId: job?.id, data: job?.data, error: err.message },
        });
      }
    });
    this.worker.on('error', (err) => {
      this.logger.error(`postback worker error: ${err.message}`);
    });
    this.logger.log(`Postback worker started on queue "${POSTBACK_QUEUE_NAME}"`);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }
}
