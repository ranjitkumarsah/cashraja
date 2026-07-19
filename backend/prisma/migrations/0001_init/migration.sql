-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'flagged', 'banned');

-- CreateEnum
CREATE TYPE "LedgerSourceType" AS ENUM ('game', 'offer', 'ad', 'referral', 'redemption', 'admin_adjustment');

-- CreateEnum
CREATE TYPE "OfferNetwork" AS ENUM ('adjoe', 'adgate', 'offertoro', 'cpx');

-- CreateEnum
CREATE TYPE "OfferCompletionStatus" AS ENUM ('pending', 'credited', 'rejected');

-- CreateEnum
CREATE TYPE "AdNetwork" AS ENUM ('applovin_max', 'unity_levelplay', 'admob');

-- CreateEnum
CREATE TYPE "GiftCardBrand" AS ENUM ('amazon', 'flipkart', 'google_play');

-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('requested', 'under_review', 'approved', 'rejected', 'issued');

-- CreateEnum
CREATE TYPE "FulfillmentMethod" AS ENUM ('api_xoxoday', 'api_qwikcilver', 'manual');

-- CreateEnum
CREATE TYPE "FraudSeverity" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "FraudAutoAction" AS ENUM ('none', 'flagged_for_review', 'auto_banned');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('reviewer', 'super_admin');

-- CreateEnum
CREATE TYPE "AdminStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "GameRoundStatus" AS ENUM ('issued', 'completed', 'expired');

-- CreateEnum
CREATE TYPE "BonusKind" AS ENUM ('scratch', 'spin');

-- CreateEnum
CREATE TYPE "InventoryStatus" AS ENUM ('unused', 'reserved', 'issued');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "google_uid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "country" TEXT,
    "device_id" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "coin_balance_cached" INTEGER NOT NULL DEFAULT 0,
    "referral_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coin_ledger" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "source_type" "LedgerSourceType" NOT NULL,
    "source_ref_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coin_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL,
    "network" "OfferNetwork" NOT NULL,
    "external_offer_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coin_reward" INTEGER NOT NULL,
    "requirements" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_completions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "offer_id" UUID,
    "network" TEXT NOT NULL,
    "external_txn_id" TEXT NOT NULL,
    "status" "OfferCompletionStatus" NOT NULL DEFAULT 'pending',
    "network_payload" JSONB,
    "credited_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offer_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_impressions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "network" "AdNetwork" NOT NULL,
    "ad_unit_id" TEXT NOT NULL,
    "coin_reward" INTEGER NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "ssv_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_impressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_cards" (
    "id" UUID NOT NULL,
    "brand" "GiftCardBrand" NOT NULL,
    "denomination" INTEGER NOT NULL,
    "coin_cost" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redemptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "gift_card_id" UUID NOT NULL,
    "coin_amount" INTEGER NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'requested',
    "fulfillment_method" "FulfillmentMethod" NOT NULL DEFAULT 'manual',
    "gift_card_code" TEXT,
    "rejection_reason" TEXT,
    "reviewed_by_admin_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" UUID NOT NULL,
    "referrer_id" UUID NOT NULL,
    "referred_id" UUID NOT NULL,
    "bonus_percent" DECIMAL(5,2) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fraud_flags" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "rule_triggered" TEXT NOT NULL,
    "severity" "FraudSeverity" NOT NULL,
    "auto_action" "FraudAutoAction" NOT NULL DEFAULT 'none',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fraud_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_log" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "totp_secret" TEXT,
    "role" "AdminRole" NOT NULL DEFAULT 'reviewer',
    "status" "AdminStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_fingerprint" TEXT NOT NULL,
    "first_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "rotated_from_id" UUID,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_rounds" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "difficulty" TEXT NOT NULL,
    "status" "GameRoundStatus" NOT NULL DEFAULT 'issued',
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "game_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streaks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "current_count" INTEGER NOT NULL DEFAULT 0,
    "last_claim_date" DATE NOT NULL,

    CONSTRAINT "streaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bonus_attempts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "BonusKind" NOT NULL,
    "result_coins" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bonus_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bonus_config" (
    "id" UUID NOT NULL,
    "kind" "BonusKind" NOT NULL,
    "weighted_table" JSONB NOT NULL,
    "attempts_per_day" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bonus_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_card_inventory" (
    "id" UUID NOT NULL,
    "brand" "GiftCardBrand" NOT NULL,
    "denomination" INTEGER NOT NULL,
    "code_encrypted" TEXT NOT NULL,
    "status" "InventoryStatus" NOT NULL DEFAULT 'unused',
    "uploaded_by_admin_id" UUID NOT NULL,
    "redemption_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_card_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_earnings" (
    "id" UUID NOT NULL,
    "referral_id" UUID NOT NULL,
    "source_ledger_id" UUID NOT NULL,
    "bonus_ledger_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_earnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_config" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "version" INTEGER NOT NULL,
    "updated_by_admin_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_google_uid_key" ON "users"("google_uid");

-- CreateIndex
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

-- CreateIndex
CREATE INDEX "users_device_id_idx" ON "users"("device_id");

-- CreateIndex
CREATE UNIQUE INDEX "coin_ledger_idempotency_key_key" ON "coin_ledger"("idempotency_key");

-- CreateIndex
CREATE INDEX "coin_ledger_user_id_created_at_idx" ON "coin_ledger"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "offers_network_external_offer_id_key" ON "offers"("network", "external_offer_id");

-- CreateIndex
CREATE INDEX "offer_completions_user_id_idx" ON "offer_completions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "offer_completions_network_external_txn_id_key" ON "offer_completions"("network", "external_txn_id");

-- CreateIndex
CREATE INDEX "ad_impressions_user_id_created_at_idx" ON "ad_impressions"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "gift_cards_brand_denomination_key" ON "gift_cards"("brand", "denomination");

-- CreateIndex
CREATE INDEX "redemptions_user_id_created_at_idx" ON "redemptions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "redemptions_status_idx" ON "redemptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referred_id_key" ON "referrals"("referred_id");

-- CreateIndex
CREATE INDEX "referrals_referrer_id_idx" ON "referrals"("referrer_id");

-- CreateIndex
CREATE INDEX "fraud_flags_user_id_idx" ON "fraud_flags"("user_id");

-- CreateIndex
CREATE INDEX "admin_audit_log_admin_id_created_at_idx" ON "admin_audit_log"("admin_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE INDEX "devices_device_fingerprint_idx" ON "devices"("device_fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "devices_user_id_device_fingerprint_key" ON "devices"("user_id", "device_fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "game_rounds_user_id_issued_at_idx" ON "game_rounds"("user_id", "issued_at");

-- CreateIndex
CREATE UNIQUE INDEX "streaks_user_id_key" ON "streaks"("user_id");

-- CreateIndex
CREATE INDEX "bonus_attempts_user_id_created_at_idx" ON "bonus_attempts"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "bonus_config_kind_version_key" ON "bonus_config"("kind", "version");

-- CreateIndex
CREATE INDEX "gift_card_inventory_brand_denomination_status_idx" ON "gift_card_inventory"("brand", "denomination", "status");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "referral_earnings_bonus_ledger_id_key" ON "referral_earnings"("bonus_ledger_id");

-- CreateIndex
CREATE INDEX "referral_earnings_referral_id_idx" ON "referral_earnings"("referral_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_config_key_version_key" ON "app_config"("key", "version");

-- AddForeignKey
ALTER TABLE "coin_ledger" ADD CONSTRAINT "coin_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_completions" ADD CONSTRAINT "offer_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_completions" ADD CONSTRAINT "offer_completions_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_impressions" ADD CONSTRAINT "ad_impressions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_gift_card_id_fkey" FOREIGN KEY ("gift_card_id") REFERENCES "gift_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_reviewed_by_admin_id_fkey" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_id_fkey" FOREIGN KEY ("referred_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fraud_flags" ADD CONSTRAINT "fraud_flags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_rotated_from_id_fkey" FOREIGN KEY ("rotated_from_id") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streaks" ADD CONSTRAINT "streaks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_attempts" ADD CONSTRAINT "bonus_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_card_inventory" ADD CONSTRAINT "gift_card_inventory_uploaded_by_admin_id_fkey" FOREIGN KEY ("uploaded_by_admin_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_card_inventory" ADD CONSTRAINT "gift_card_inventory_redemption_id_fkey" FOREIGN KEY ("redemption_id") REFERENCES "redemptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_earnings" ADD CONSTRAINT "referral_earnings_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "referrals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_earnings" ADD CONSTRAINT "referral_earnings_source_ledger_id_fkey" FOREIGN KEY ("source_ledger_id") REFERENCES "coin_ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_earnings" ADD CONSTRAINT "referral_earnings_bonus_ledger_id_fkey" FOREIGN KEY ("bonus_ledger_id") REFERENCES "coin_ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_config" ADD CONSTRAINT "app_config_updated_by_admin_id_fkey" FOREIGN KEY ("updated_by_admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

