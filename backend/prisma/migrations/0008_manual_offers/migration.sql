-- H5 (manual offers + text-proof review) — ADDITIVE-ONLY.
-- New `manual_offers` and `manual_offer_submissions` tables plus the submission
-- status enum. Super admins author offers; users submit free-text proof;
-- reviewers approve (credit via LedgerService) or reject. Approval credits go
-- through coin_ledger via the service — nothing in coin_ledger is touched here.

-- CreateEnum
CREATE TYPE "ManualOfferSubmissionStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "manual_offers" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "coin_reward" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_admin_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manual_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_offer_submissions" (
    "id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "proof_text" TEXT NOT NULL,
    "status" "ManualOfferSubmissionStatus" NOT NULL DEFAULT 'pending',
    "review_reason" TEXT,
    "reviewed_by_admin_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "manual_offer_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "manual_offers_is_active_idx" ON "manual_offers"("is_active");

-- CreateIndex
CREATE INDEX "manual_offer_submissions_offer_id_idx" ON "manual_offer_submissions"("offer_id");

-- CreateIndex
CREATE INDEX "manual_offer_submissions_user_id_idx" ON "manual_offer_submissions"("user_id");

-- CreateIndex
CREATE INDEX "manual_offer_submissions_status_idx" ON "manual_offer_submissions"("status");

-- AddForeignKey
ALTER TABLE "manual_offers" ADD CONSTRAINT "manual_offers_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_offer_submissions" ADD CONSTRAINT "manual_offer_submissions_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "manual_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_offer_submissions" ADD CONSTRAINT "manual_offer_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_offer_submissions" ADD CONSTRAINT "manual_offer_submissions_reviewed_by_admin_id_fkey" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
