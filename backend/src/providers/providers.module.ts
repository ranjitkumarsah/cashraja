import { Module } from '@nestjs/common';
import { AdSsvRegistryService } from './ad-ssv/ad-ssv-registry.service';
import { OfferwallRegistryService } from './offerwall/offerwall-registry.service';

/**
 * Provider adapter layer (ARCHITECTURE_PLAN §4): env-selected network
 * adapters behind registries. GIFT_CARD_PROVIDER is bound in Phase C
 * (ManualInventoryProvider) — only the token/interface exists today.
 */
@Module({
  providers: [OfferwallRegistryService, AdSsvRegistryService],
  exports: [OfferwallRegistryService, AdSsvRegistryService],
})
export class ProvidersModule {}
