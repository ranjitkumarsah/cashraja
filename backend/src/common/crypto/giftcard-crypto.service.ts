import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

/**
 * Column-level AES-256-GCM encryption for gift-card codes (ARCHITECTURE_PLAN
 * §2.5, Data & Security §2/§4). Plaintext codes are NEVER stored or logged:
 * only the sealed token (iv | authTag | ciphertext, base64) lands in
 * gift_card_inventory.code_encrypted / redemptions.gift_card_code.
 *
 * Key source is env AES_KEY (64 hex chars = 32 bytes), the same key the schema
 * comments already reserve for this column. GCM gives us authenticated
 * encryption, so a tampered ciphertext fails to decrypt (throws) rather than
 * returning garbage.
 */
@Injectable()
export class GiftCardCryptoService {
  private static readonly ALGO = 'aes-256-gcm';
  private static readonly IV_BYTES = 12; // 96-bit nonce (GCM standard)
  private static readonly TAG_BYTES = 16;
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const hex = config.get<string>('AES_KEY') ?? '';
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
      throw new Error('AES_KEY must be 64 hex characters (32 bytes) for AES-256-GCM');
    }
    this.key = Buffer.from(hex, 'hex');
  }

  /** Seal a plaintext code → base64(iv | authTag | ciphertext). */
  encrypt(plaintext: string): string {
    const iv = randomBytes(GiftCardCryptoService.IV_BYTES);
    const cipher = createCipheriv(GiftCardCryptoService.ALGO, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
  }

  /** Open a sealed token back to plaintext. Throws on tamper / wrong key. */
  decrypt(sealed: string): string {
    const buf = Buffer.from(sealed, 'base64');
    const ivEnd = GiftCardCryptoService.IV_BYTES;
    const tagEnd = ivEnd + GiftCardCryptoService.TAG_BYTES;
    if (buf.length <= tagEnd) {
      throw new Error('Ciphertext too short to be a valid AES-256-GCM token');
    }
    const iv = buf.subarray(0, ivEnd);
    const authTag = buf.subarray(ivEnd, tagEnd);
    const ciphertext = buf.subarray(tagEnd);
    const decipher = createDecipheriv(GiftCardCryptoService.ALGO, this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  /**
   * Deterministic keyed fingerprint of a plaintext code for the dedupe unique
   * constraint. GCM ciphertext is non-deterministic (random IV), so it can't
   * back a UNIQUE index; this HMAC-like fingerprint can, without ever storing
   * plaintext. Uses the same key material via a separate cipher invocation
   * over a fixed zero IV — collision-resistant enough for dedupe, and it never
   * leaves the server.
   */
  fingerprint(plaintext: string): string {
    // Keyed hash: HMAC-SHA256 over the normalized code with the AES key.
    return createHmac('sha256', this.key).update(plaintext.trim()).digest('hex');
  }
}

/**
 * Mask a gift-card code for display in any non-reveal response: keep the last
 * 4 visible, star the rest. Never receives the encrypted blob — callers pass
 * either the plaintext (reveal path re-masks for logs) or a placeholder.
 */
export function maskCode(plaintext: string): string {
  const trimmed = plaintext.trim();
  if (trimmed.length <= 4) return '****';
  return `${'*'.repeat(Math.max(4, trimmed.length - 4))}${trimmed.slice(-4)}`;
}
