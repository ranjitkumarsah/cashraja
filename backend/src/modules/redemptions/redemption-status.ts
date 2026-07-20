import { RedemptionStatus } from '@prisma/client';

/**
 * Redemption status machine (C2.2). Legal transitions only:
 *   requested    → under_review | approved | rejected
 *   under_review → approved | rejected
 *   approved     → issued            (fulfilment) — or stays approved on retry
 *   issued / rejected                (terminal)
 *
 * approved may also be forced back to under_review when the user is banned
 * after requesting (gap P6) — an explicit hold, never an auto-issue.
 */
const LEGAL_TRANSITIONS: Record<RedemptionStatus, RedemptionStatus[]> = {
  [RedemptionStatus.requested]: [
    RedemptionStatus.under_review,
    RedemptionStatus.approved,
    RedemptionStatus.rejected,
  ],
  [RedemptionStatus.under_review]: [RedemptionStatus.approved, RedemptionStatus.rejected],
  [RedemptionStatus.approved]: [RedemptionStatus.issued, RedemptionStatus.under_review],
  [RedemptionStatus.rejected]: [],
  [RedemptionStatus.issued]: [],
};

export function canTransition(from: RedemptionStatus, to: RedemptionStatus): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}
