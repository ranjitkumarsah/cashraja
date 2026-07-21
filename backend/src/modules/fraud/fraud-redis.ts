import { Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { redisConnectionOptions } from '../postbacks/postback-queue';
import { InMemorySlidingWindow, RedisSlidingWindow, SlidingWindowCounter } from './sliding-window';

/**
 * Build the velocity-counter backend for the fraud engine. With a REDIS_URL we
 * get the durable, cross-process Redis sorted-set counter; without one (or with
 * a malformed url) we degrade to an in-process counter so the app still boots
 * and rules still fire locally (dev / unit-adjacent runs).
 */
export function createSlidingWindow(redisUrl: string | undefined): SlidingWindowCounter {
  const logger = new Logger('FraudSlidingWindow');
  if (!redisUrl) {
    logger.warn('REDIS_URL unset — fraud velocity counters run in-process only');
    return new InMemorySlidingWindow();
  }
  try {
    const client = new Redis({ ...redisConnectionOptions(redisUrl), lazyConnect: false });
    // A dropped connection must never crash the process; ops degrade to 0-count.
    client.on('error', (err) => logger.error(`fraud redis error: ${err.message}`));
    return new RedisSlidingWindow(client);
  } catch (err) {
    logger.error(
      `failed to init fraud redis (${(err as Error).message}) — falling back to in-process counter`,
    );
    return new InMemorySlidingWindow();
  }
}
