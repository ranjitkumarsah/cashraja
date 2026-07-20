-- CreateEnum
CREATE TYPE "FraudFlagStatus" AS ENUM ('open', 'resolved');

-- AlterTable
ALTER TABLE "fraud_flags" ADD COLUMN     "resolution_action" TEXT,
ADD COLUMN     "resolved_at" TIMESTAMP(3),
ADD COLUMN     "resolved_by_admin_id" UUID,
ADD COLUMN     "status" "FraudFlagStatus" NOT NULL DEFAULT 'open';

-- CreateTable
CREATE TABLE "metrics_snapshots" (
    "id" UUID NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dau" INTEGER NOT NULL,
    "coins_issued" INTEGER NOT NULL,
    "coins_redeemed" INTEGER NOT NULL,
    "offer_completion_rate" DOUBLE PRECISION NOT NULL,
    "outstanding_liability" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metrics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "metrics_snapshots_captured_at_idx" ON "metrics_snapshots"("captured_at");

-- CreateIndex
CREATE INDEX "fraud_flags_status_idx" ON "fraud_flags"("status");

-- AddForeignKey
ALTER TABLE "fraud_flags" ADD CONSTRAINT "fraud_flags_resolved_by_admin_id_fkey" FOREIGN KEY ("resolved_by_admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
