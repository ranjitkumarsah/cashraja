import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../postbacks/postback-queue';

/**
 * BullMQ retry queue for gift-card fulfillment (C2.3). When an approved
 * redemption can't be fulfilled immediately (inventory empty / provider
 * error), it is enqueued here and retried with backoff — a paid redemption is
 * NEVER dropped. Processing is idempotent (status short-circuit + inventory
 * claim keyed on redemption_id), so at-least-once delivery can't double-issue.
 */
export const REDEMPTION_QUEUE_NAME = 'redemption-fulfillment';

/** DI token for the queue abstraction (fakes in unit tests). */
export const REDEMPTION_QUEUE = 'REDEMPTION_QUEUE';

export interface RedemptionJobData {
  redemptionId: string;
}

export interface RedemptionQueue {
  enqueue(data: RedemptionJobData): Promise<void>;
  close(): Promise<void>;
}

/** Retry policy: 10 attempts, exponential backoff from 30s; failed jobs kept. */
export const REDEMPTION_JOB_OPTIONS = {
  attempts: 10,
  backoff: { type: 'exponential', delay: 30_000 },
  removeOnComplete: { count: 1_000 },
  removeOnFail: false,
} as const;

export class BullRedemptionQueue implements RedemptionQueue {
  constructor(private readonly queue: Queue<RedemptionJobData>) {}

  static create(redisUrl: string): BullRedemptionQueue {
    const queue = new Queue<RedemptionJobData>(REDEMPTION_QUEUE_NAME, {
      connection: redisConnectionOptions(redisUrl),
      defaultJobOptions: { ...REDEMPTION_JOB_OPTIONS },
    });
    return new BullRedemptionQueue(queue);
  }

  async enqueue(data: RedemptionJobData): Promise<void> {
    await this.queue.add('fulfill', data);
  }

  async close(): Promise<void> {
    await this.queue.close();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.close();
  }
}
