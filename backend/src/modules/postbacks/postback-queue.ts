import { Queue } from 'bullmq';
import type { RedisOptions } from 'ioredis';

/**
 * BullMQ queue plumbing for the postback pipeline (ARCHITECTURE_PLAN §2.2,
 * §6). The webhook intake enqueues; PostbackWorker drains. Processing is
 * idempotent end-to-end (status checks + ledger idempotency keys), so
 * duplicate jobs are harmless by design — no jobId dedupe is needed.
 */

export const POSTBACK_QUEUE_NAME = 'postback-processing';

/** DI token for the queue abstraction (fakes in unit tests). */
export const POSTBACK_QUEUE = 'POSTBACK_QUEUE';

export type PostbackJobData =
  | { kind: 'offer'; completionId: string }
  | { kind: 'ad'; impressionId: string };

export interface PostbackQueue {
  enqueue(data: PostbackJobData): Promise<void>;
  close(): Promise<void>;
}

/** Retry policy: 5 attempts, exponential backoff from 5s; failed jobs are kept (poison set). */
export const POSTBACK_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { count: 1_000 },
  removeOnFail: false,
} as const;

/** REDIS_URL → ioredis options (BullMQ needs maxRetriesPerRequest: null). */
export function redisConnectionOptions(redisUrl: string): RedisOptions {
  const url = new URL(redisUrl);
  const dbPath = url.pathname.replace(/^\//, '');
  return {
    host: url.hostname,
    port: url.port !== '' ? Number(url.port) : 6379,
    username: url.username !== '' ? url.username : undefined,
    password: url.password !== '' ? url.password : undefined,
    db: dbPath !== '' ? Number(dbPath) : 0,
    maxRetriesPerRequest: null,
  };
}

export class BullPostbackQueue implements PostbackQueue {
  constructor(private readonly queue: Queue<PostbackJobData>) {}

  static create(redisUrl: string): BullPostbackQueue {
    const queue = new Queue<PostbackJobData>(POSTBACK_QUEUE_NAME, {
      connection: redisConnectionOptions(redisUrl),
      defaultJobOptions: { ...POSTBACK_JOB_OPTIONS },
    });
    return new BullPostbackQueue(queue);
  }

  async enqueue(data: PostbackJobData): Promise<void> {
    await this.queue.add(data.kind, data);
  }

  async close(): Promise<void> {
    await this.queue.close();
  }

  /** Nest lifecycle hook (invoked on the DI-managed instance at shutdown). */
  async onApplicationShutdown(): Promise<void> {
    await this.close();
  }
}
