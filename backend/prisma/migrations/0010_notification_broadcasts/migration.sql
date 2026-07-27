-- H8 (push notifications) — ADDITIVE-ONLY.
-- New table notification_broadcasts: history/audit of admin-composed broadcasts
-- (to all users or a specific list). The per-user inbox rows are ordinary
-- notifications records; this table records who sent what, to which audience,
-- and how many users were targeted.

-- CreateTable
CREATE TABLE "notification_broadcasts" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience_type" TEXT NOT NULL,
    "target_count" INTEGER NOT NULL,
    "sent_by_admin_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_broadcasts_created_at_idx" ON "notification_broadcasts"("created_at");

-- AddForeignKey
ALTER TABLE "notification_broadcasts" ADD CONSTRAINT "notification_broadcasts_sent_by_admin_id_fkey" FOREIGN KEY ("sent_by_admin_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
