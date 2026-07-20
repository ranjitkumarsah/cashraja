import { RedemptionStatus } from '@prisma/client';
import { canTransition } from './redemption-status';

describe('redemption status machine', () => {
  it('allows the legal forward transitions', () => {
    expect(canTransition(RedemptionStatus.requested, RedemptionStatus.under_review)).toBe(true);
    expect(canTransition(RedemptionStatus.requested, RedemptionStatus.approved)).toBe(true);
    expect(canTransition(RedemptionStatus.requested, RedemptionStatus.rejected)).toBe(true);
    expect(canTransition(RedemptionStatus.under_review, RedemptionStatus.approved)).toBe(true);
    expect(canTransition(RedemptionStatus.under_review, RedemptionStatus.rejected)).toBe(true);
    expect(canTransition(RedemptionStatus.approved, RedemptionStatus.issued)).toBe(true);
    // banned-after-request hold
    expect(canTransition(RedemptionStatus.approved, RedemptionStatus.under_review)).toBe(true);
  });

  it('forbids illegal transitions', () => {
    // cannot reject an already-issued/approved card
    expect(canTransition(RedemptionStatus.issued, RedemptionStatus.rejected)).toBe(false);
    expect(canTransition(RedemptionStatus.approved, RedemptionStatus.rejected)).toBe(false);
    // terminal states go nowhere
    expect(canTransition(RedemptionStatus.rejected, RedemptionStatus.approved)).toBe(false);
    expect(canTransition(RedemptionStatus.issued, RedemptionStatus.approved)).toBe(false);
    // cannot skip straight to issued from requested
    expect(canTransition(RedemptionStatus.requested, RedemptionStatus.issued)).toBe(false);
  });
});
