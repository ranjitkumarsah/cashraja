import { redisConnectionOptions } from './postback-queue';

describe('redisConnectionOptions', () => {
  it('parses a plain redis:// URL without TLS', () => {
    const opts = redisConnectionOptions('redis://localhost:6379');
    expect(opts.host).toBe('localhost');
    expect(opts.port).toBe(6379);
    expect(opts.tls).toBeUndefined();
    expect(opts.maxRetriesPerRequest).toBeNull();
  });

  it('enables TLS for a rediss:// URL (Upstash) with auth + host/port', () => {
    const opts = redisConnectionOptions('rediss://default:sometoken@fly-cashraja.upstash.io:6379');
    expect(opts.host).toBe('fly-cashraja.upstash.io');
    expect(opts.port).toBe(6379);
    expect(opts.username).toBe('default');
    expect(opts.password).toBe('sometoken');
    // Present (not undefined) → ioredis negotiates TLS. Without this, Upstash
    // rejects the connection.
    expect(opts.tls).toEqual({});
  });
});
