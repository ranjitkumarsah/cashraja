import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';

/**
 * Redis sliding-window counter for velocity fraud rules (TRD §5). Each `hit`
 * records a timestamped event under `key` and returns how many events fall in
 * the half-open window `(now - windowMs, now]`.
 *
 * WINDOW SEMANTICS (the off-by-one the testing docs flag):
 *   - cutoff = now - windowMs
 *   - an event is IN-window iff its timestamp is STRICTLY GREATER than cutoff
 *   - an event exactly AT the cutoff (now - windowMs) has aged out (excluded)
 * The Redis and in-memory implementations are byte-for-byte identical on this
 * boundary so the unit suite (in-memory, deterministic clock) proves the same
 * behavior the Redis path exhibits in integration.
 */
export interface SlidingWindowCounter {
  /**
   * Record an event at `now` (epoch ms) and return the number of events in the
   * window `(now - windowMs, now]`, inclusive of the one just recorded.
   */
  hit(key: string, windowMs: number, now?: number): Promise<number>;
  /** Count events in the window without recording a new one. */
  count(key: string, windowMs: number, now?: number): Promise<number>;
  /** Drop the counter for a key (tests / manual clears). */
  reset(key: string): Promise<void>;
}

export const SLIDING_WINDOW = 'SLIDING_WINDOW';

/**
 * In-memory implementation with EXACTLY the Redis semantics. Used by unit
 * tests (deterministic `now`) and as the automatic fallback when Redis is
 * unreachable so a velocity check degrades to per-process counting rather than
 * throwing on the hot credit path.
 */
export class InMemorySlidingWindow implements SlidingWindowCounter {
  private readonly store = new Map<string, number[]>();

  async hit(key: string, windowMs: number, now: number = Date.now()): Promise<number> {
    const cutoff = now - windowMs;
    const kept = (this.store.get(key) ?? []).filter((ts) => ts > cutoff);
    kept.push(now);
    this.store.set(key, kept);
    return kept.length;
  }

  async count(key: string, windowMs: number, now: number = Date.now()): Promise<number> {
    const cutoff = now - windowMs;
    const kept = (this.store.get(key) ?? []).filter((ts) => ts > cutoff);
    this.store.set(key, kept);
    return kept.length;
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }
}

const KEY_PREFIX = 'fraud:vw:';

/**
 * Redis sorted-set implementation. Score = event timestamp (ms); member is a
 * unique id so simultaneous events never collide. Each op trims aged-out
 * members (ZREMRANGEBYSCORE 0..cutoff) and refreshes the key TTL to windowMs so
 * idle keys self-expire.
 */
export class RedisSlidingWindow implements SlidingWindowCounter {
  constructor(private readonly redis: Redis) {}

  async hit(key: string, windowMs: number, now: number = Date.now()): Promise<number> {
    const redisKey = KEY_PREFIX + key;
    const cutoff = now - windowMs;
    const results = await this.redis
      .multi()
      .zremrangebyscore(redisKey, 0, cutoff)
      .zadd(redisKey, now, `${now}:${randomUUID()}`)
      .zcard(redisKey)
      .pexpire(redisKey, windowMs)
      .exec();
    // ZCARD is the 3rd command (index 2).
    return readReply(results, 2);
  }

  async count(key: string, windowMs: number, now: number = Date.now()): Promise<number> {
    const redisKey = KEY_PREFIX + key;
    const cutoff = now - windowMs;
    const results = await this.redis
      .multi()
      .zremrangebyscore(redisKey, 0, cutoff)
      .zcard(redisKey)
      .pexpire(redisKey, windowMs)
      .exec();
    // ZCARD is the 2nd command (index 1).
    return readReply(results, 1);
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(KEY_PREFIX + key);
  }

  /** Nest lifecycle hook (invoked on the DI-managed instance at shutdown). */
  async onApplicationShutdown(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      // already closing / unreachable — nothing to do
    }
  }
}

type MultiReplies = Array<[Error | null, unknown]> | null;

/** Read a numeric reply at `index` from a MULTI/EXEC result, rethrowing per-command errors. */
function readReply(results: MultiReplies, index: number): number {
  if (!results || results.length <= index) return 0;
  const [err, value] = results[index];
  if (err) throw err;
  return typeof value === 'number' ? value : Number(value ?? 0);
}
