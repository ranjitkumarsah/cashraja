-- Phase B (postback pipeline) — ADDITIVE-ONLY migration.
--
-- 1. 'mock' network values: the fully-functional mock offerwall / ad-SSV
--    drivers (ARCHITECTURE_PLAN §4 mock-first decision) need first-class rows
--    in offers / ad_impressions. Enum ADD VALUE is additive and safe.
-- 2. offer_completions.coin_reward: the credited amount is captured at
--    postback time (networks pay dynamic amounts) so the wallet can sum
--    pending credits without re-parsing jsonb payloads.
-- 3. offer_completions.status_reason: why a completion is held (fraud hook)
--    or rejected (e.g. 'expired' by the 30d pending-expiry job).

ALTER TYPE "OfferNetwork" ADD VALUE IF NOT EXISTS 'mock';
ALTER TYPE "AdNetwork" ADD VALUE IF NOT EXISTS 'mock';

ALTER TABLE "offer_completions" ADD COLUMN "coin_reward" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "offer_completions" ADD COLUMN "status_reason" TEXT;
