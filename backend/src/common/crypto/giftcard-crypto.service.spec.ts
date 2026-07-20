import { ConfigService } from '@nestjs/config';
import { GiftCardCryptoService, maskCode } from './giftcard-crypto.service';

const KEY = 'a'.repeat(64); // 32 bytes hex

function build(key: string = KEY): GiftCardCryptoService {
  const config = { get: (k: string) => (k === 'AES_KEY' ? key : undefined) } as unknown as ConfigService;
  return new GiftCardCryptoService(config);
}

describe('GiftCardCryptoService (AES-256-GCM)', () => {
  it('round-trips a code: decrypt(encrypt(x)) === x', () => {
    const crypto = build();
    const code = 'AMZN-1234-5678-ABCD';
    const sealed = crypto.encrypt(code);
    expect(sealed).not.toContain(code); // ciphertext, not plaintext
    expect(crypto.decrypt(sealed)).toBe(code);
  });

  it('is non-deterministic (random IV) — same plaintext yields different ciphertexts', () => {
    const crypto = build();
    const a = crypto.encrypt('SAME-CODE');
    const b = crypto.encrypt('SAME-CODE');
    expect(a).not.toBe(b);
    expect(crypto.decrypt(a)).toBe('SAME-CODE');
    expect(crypto.decrypt(b)).toBe('SAME-CODE');
  });

  it('rejects a tampered ciphertext (GCM auth tag mismatch)', () => {
    const crypto = build();
    const sealed = crypto.encrypt('SECRET');
    const buf = Buffer.from(sealed, 'base64');
    buf[buf.length - 1] ^= 0xff; // flip a ciphertext byte
    const tampered = buf.toString('base64');
    expect(() => crypto.decrypt(tampered)).toThrow();
  });

  it('fails to decrypt with a different key', () => {
    const enc = build('a'.repeat(64));
    const dec = build('b'.repeat(64));
    expect(() => dec.decrypt(enc.encrypt('X'))).toThrow();
  });

  it('fingerprint is deterministic and dedupe-usable (trims); different codes differ', () => {
    const crypto = build();
    expect(crypto.fingerprint('CODE-1')).toBe(crypto.fingerprint('  CODE-1  '));
    expect(crypto.fingerprint('CODE-1')).not.toBe(crypto.fingerprint('CODE-2'));
  });

  it('rejects a malformed AES_KEY', () => {
    expect(() => build('too-short')).toThrow(/AES_KEY/);
  });
});

describe('maskCode', () => {
  it('keeps only the last 4 characters visible', () => {
    expect(maskCode('AMZN12345678')).toBe('********5678');
  });
  it('fully masks very short codes', () => {
    expect(maskCode('12')).toBe('****');
  });
});
