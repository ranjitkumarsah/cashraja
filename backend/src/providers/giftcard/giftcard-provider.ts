/**
 * Gift-card fulfillment provider contract (ARCHITECTURE_PLAN §4, TRD §6).
 *
 * Phase B ships the interface + DI token only. Phase C implements
 * ManualInventoryProvider (pull next unused encrypted code from
 * gift_card_inventory) and binds it to GIFT_CARD_PROVIDER; API providers
 * (Xoxoday/Qwikcilver) can be added later behind the same interface.
 */

export interface FulfillmentRequest {
  redemptionId: string;
  userId: string;
  brand: string;
  denomination: number;
}

export type FulfillmentResult =
  | { status: 'issued'; /** AES-256-GCM encrypted code — never plaintext */ codeEncrypted: string }
  | { status: 'out_of_stock' }
  | { status: 'failed'; reason: string };

export interface GiftCardProvider {
  readonly name: string;
  fulfill(request: FulfillmentRequest): Promise<FulfillmentResult>;
}

/** DI token — Phase C binds ManualInventoryProvider here. */
export const GIFT_CARD_PROVIDER = 'GIFT_CARD_PROVIDER';
