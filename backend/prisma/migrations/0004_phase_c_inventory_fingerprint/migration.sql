-- Phase C (C1 inventory dedupe) — ADDITIVE-ONLY.
-- gift_card_inventory.code_fingerprint: keyed HMAC of the plaintext code that
-- backs the dedupe UNIQUE(brand, denomination, code_fingerprint) constraint —
-- GCM ciphertext is non-deterministic and can't. Table ships empty, so the
-- NOT NULL add needs no backfill.

-- AlterTable
ALTER TABLE "gift_card_inventory" ADD COLUMN "code_fingerprint" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "gift_card_inventory_brand_denomination_code_fingerprint_key" ON "gift_card_inventory"("brand", "denomination", "code_fingerprint");
