-- H4 (user feedback / complaints) — ADDITIVE-ONLY.
-- New `feedback` table plus its two enums. Users submit and read their own
-- rows; admins triage, reply and resolve (every mutation audited in
-- admin_audit_log). Nothing in coin_ledger is touched.

-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('feedback', 'complaint');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('open', 'in_review', 'resolved');

-- CreateTable
CREATE TABLE "feedback" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "FeedbackType" NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'open',
    "admin_reply" TEXT,
    "resolved_by_admin_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_user_id_created_at_idx" ON "feedback"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "feedback_status_idx" ON "feedback"("status");

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_resolved_by_admin_id_fkey" FOREIGN KEY ("resolved_by_admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
