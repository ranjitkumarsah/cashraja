import { describe, expect, it } from 'vitest';
import { loginSchema, totpCodeSchema } from './schemas';

describe('loginSchema', () => {
  it('accepts a well-formed email + password', () => {
    const result = loginSchema.safeParse({ email: 'admin@cashraja.app', password: 'secret' });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'secret' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty password', () => {
    const result = loginSchema.safeParse({ email: 'admin@cashraja.app', password: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a password over the backend 128-char cap', () => {
    const result = loginSchema.safeParse({
      email: 'admin@cashraja.app',
      password: 'x'.repeat(129),
    });
    expect(result.success).toBe(false);
  });
});

describe('totpCodeSchema', () => {
  it('accepts exactly six digits', () => {
    expect(totpCodeSchema.safeParse({ code: '123456' }).success).toBe(true);
  });

  it('trims surrounding whitespace before validating', () => {
    const result = totpCodeSchema.safeParse({ code: ' 123456 ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.code).toBe('123456');
  });

  it('rejects short, long and non-numeric codes', () => {
    expect(totpCodeSchema.safeParse({ code: '12345' }).success).toBe(false);
    expect(totpCodeSchema.safeParse({ code: '1234567' }).success).toBe(false);
    expect(totpCodeSchema.safeParse({ code: 'abcdef' }).success).toBe(false);
  });
});
