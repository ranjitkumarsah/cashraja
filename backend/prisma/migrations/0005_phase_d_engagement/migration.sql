-- Phase D (engagement: game / streak / scratch-spin / referral) — ADDITIVE-ONLY.
-- 1. Two new LedgerSourceType values for streak day-bonuses and scratch/spin prizes.
-- 2. game_rounds.expires_at: server-issued round expiry (issued_at + game.round_expiry_seconds).
-- 3. referral_earnings.source_ledger_id UNIQUE: a source earning can fan out to at
--    most one referral bonus (double-pay guard). Table ships effectively empty.

-- AlterEnum: new values are NOT used elsewhere in this migration (safe in-tx add).
ALTER TYPE "LedgerSourceType" ADD VALUE 'streak';
ALTER TYPE "LedgerSourceType" ADD VALUE 'bonus';

-- AlterTable
ALTER TABLE "game_rounds" ADD COLUMN "expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "referral_earnings_source_ledger_id_key" ON "referral_earnings"("source_ledger_id");
