import { Injectable, Logger } from '@nestjs/common';
import { GiftCardBrand } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  FulfillmentRequest,
  FulfillmentResult,
  GiftCardProvider,
} from '../../providers/giftcard/giftcard-provider';
import { InventoryService } from './inventory.service';

/**
 * GiftCardProvider backed by the manually-uploaded inventory table (TRD §6,
 * C1.2). fulfill() atomically claims the next unused code for the requested
 * brand+denomination and attaches it to the redemption (see
 * InventoryService.claimForRedemption — row-locked, idempotent per redemption).
 * Out-of-stock returns a distinct result so the caller keeps the redemption
 * approved and enqueues a retry rather than dropping a paid redemption.
 */
@Injectable()
export class ManualInventoryProvider implements GiftCardProvider {
  readonly name = 'manual_inventory';
  private readonly logger = new Logger(ManualInventoryProvider.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async fulfill(request: FulfillmentRequest): Promise<FulfillmentResult> {
    const brand = request.brand as GiftCardBrand;
    const claim = await this.prisma.$transaction((tx) =>
      this.inventory.claimForRedemption(tx, brand, request.denomination, request.redemptionId),
    );

    if (!claim) {
      this.logger.warn(
        `Out of stock fulfilling redemption ${request.redemptionId} (${request.brand} ₹${request.denomination})`,
      );
      return { status: 'out_of_stock' };
    }

    // Fire-and-forget low-stock alert; never blocks fulfillment.
    void this.inventory.checkLowStock(brand, request.denomination).catch((err: unknown) => {
      this.logger.error(`low-stock check failed: ${(err as Error).message}`);
    });

    return { status: 'issued', codeEncrypted: claim.codeEncrypted };
  }
}
