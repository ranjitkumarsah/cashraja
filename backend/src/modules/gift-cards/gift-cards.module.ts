import { Module } from '@nestjs/common';
import { GIFT_CARD_PROVIDER } from '../../providers/giftcard/giftcard-provider';
import { AdminGiftCardsController } from './admin-gift-cards.controller';
import { AdminInventoryController } from './admin-inventory.controller';
import { GiftCardsController } from './gift-cards.controller';
import { GiftCardsService } from './gift-cards.service';
import { InventoryService } from './inventory.service';
import { ManualInventoryProvider } from './manual-inventory.provider';

/**
 * C1 — gift-card catalog + encrypted manual inventory. Binds the Phase B
 * GIFT_CARD_PROVIDER token to ManualInventoryProvider (TRD §6). Crypto, alerts
 * and app-config are global modules, so nothing extra to import.
 */
@Module({
  controllers: [GiftCardsController, AdminGiftCardsController, AdminInventoryController],
  providers: [
    GiftCardsService,
    InventoryService,
    ManualInventoryProvider,
    { provide: GIFT_CARD_PROVIDER, useExisting: ManualInventoryProvider },
  ],
  exports: [GiftCardsService, InventoryService, GIFT_CARD_PROVIDER],
})
export class GiftCardsModule {}
