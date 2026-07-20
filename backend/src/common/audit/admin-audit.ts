import { Prisma } from '@prisma/client';

/**
 * Every mutating admin action writes an admin_audit_log row IN THE SAME
 * TRANSACTION as its effect (ARCHITECTURE_PLAN §2.5). Pass the transaction
 * client so the audit row commits or rolls back atomically with the change —
 * a failed effect must never leave an orphan audit row, and a written effect
 * must never lack its audit trail.
 */
export interface AuditEntryInput {
  adminId: string;
  /** Stable verb, e.g. 'redemption_approved', 'balance_adjusted', 'offer_disabled'. */
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  /** Mandatory for balance adjustments and rejections (application-enforced upstream). */
  reason?: string | null;
}

/** Audit-log action verbs (shared with tests + admin panel). */
export const AUDIT_ACTIONS = {
  BALANCE_ADJUSTED: 'balance_adjusted',
  USER_BANNED: 'user_banned',
  USER_UNBANNED: 'user_unbanned',
  REDEMPTION_APPROVED: 'redemption_approved',
  REDEMPTION_REJECTED: 'redemption_rejected',
  REDEMPTION_ISSUED: 'redemption_issued',
  REDEMPTION_HELD_BANNED: 'redemption_held_banned_user',
  ACCOUNT_DELETED: 'account_self_deleted',
  GIFT_CARD_CREATED: 'gift_card_created',
  GIFT_CARD_UPDATED: 'gift_card_updated',
  INVENTORY_UPLOADED: 'inventory_uploaded',
  INVENTORY_CODE_REVEALED: 'inventory_code_revealed',
  OFFER_UPDATED: 'offer_updated',
  CONFIG_UPDATED: 'config_updated',
  ADMIN_CREATED: 'admin_created',
  ADMIN_DISABLED: 'admin_disabled',
  FRAUD_FLAG_RESOLVED: 'fraud_flag_resolved',
} as const;

/** Minimal shape of the tx client needed here — keeps fakes small in tests. */
export interface AuditCapableTx {
  adminAuditLog: {
    create(args: { data: Prisma.AdminAuditLogUncheckedCreateInput }): Promise<unknown>;
  };
}

export function writeAuditLog(tx: AuditCapableTx, entry: AuditEntryInput): Promise<unknown> {
  return tx.adminAuditLog.create({
    data: {
      adminId: entry.adminId,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      reason: entry.reason ?? null,
    },
  });
}
