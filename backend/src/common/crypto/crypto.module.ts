import { Global, Module } from '@nestjs/common';
import { GiftCardCryptoService } from './giftcard-crypto.service';

/**
 * Global gift-card code encryption (AES-256-GCM, key from env AES_KEY).
 * Provided app-wide so inventory upload, fulfillment and the audited reveal
 * endpoint all share one keyed cipher.
 */
@Global()
@Module({
  providers: [GiftCardCryptoService],
  exports: [GiftCardCryptoService],
})
export class CryptoModule {}
