import { randomUUID } from 'node:crypto';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AdminRole,
  CoinLedger,
  LedgerSourceType,
  ManualOfferSubmissionStatus,
} from '@prisma/client';
import { AuthenticatedRequest } from '../../common/auth';
import { RolesGuard } from '../../common/auth/roles.guard';
import { LedgerService } from '../ledger/ledger.service';
import { NotificationHook } from '../notifications/notification-hook';
import { ReferralService } from '../referral/referral.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminManualOfferSubmissionsController } from './admin-manual-offer-submissions.controller';
import {
  AdminManualOfferSubmissionsService,
  manualOfferCreditKey,
} from './admin-manual-offer-submissions.service';
import { AdminManualOffersController } from './admin-manual-offers.controller';

interface FakeOffer {
  id: string;
  title: string;
  coinReward: number;
}
interface FakeUser {
  id: string;
  email: string;
  displayName: string;
}
interface FakeSubmission {
  id: string;
  offerId: string;
  userId: string;
  proofText: string;
  status: ManualOfferSubmissionStatus;
  reviewReason: string | null;
  reviewedByAdminId: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}
interface FakeAuditRow {
  adminId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
}

class FakeSubmissionsPrisma {
  offers = new Map<string, FakeOffer>();
  users = new Map<string, FakeUser>();
  subs: FakeSubmission[] = [];
  audits: FakeAuditRow[] = [];

  seed(
    status: ManualOfferSubmissionStatus = ManualOfferSubmissionStatus.pending,
    coinReward = 50,
  ): FakeSubmission {
    const offer: FakeOffer = { id: randomUUID(), title: 'Follow us', coinReward };
    const user: FakeUser = { id: randomUUID(), email: 'fan@test.local', displayName: 'Fan' };
    this.offers.set(offer.id, offer);
    this.users.set(user.id, user);
    const sub: FakeSubmission = {
      id: randomUUID(),
      offerId: offer.id,
      userId: user.id,
      proofText: 'here is proof',
      status,
      reviewReason: null,
      reviewedByAdminId: null,
      createdAt: new Date(),
      reviewedAt: null,
    };
    this.subs.push(sub);
    return sub;
  }

  private withRefs(sub: FakeSubmission) {
    const offer = this.offers.get(sub.offerId)!;
    const user = this.users.get(sub.userId)!;
    return {
      ...sub,
      offer: { id: offer.id, title: offer.title, coinReward: offer.coinReward },
      user: { id: user.id, email: user.email, displayName: user.displayName },
    };
  }

  readonly manualOfferSubmission = {
    findMany: (args: { where: { status?: ManualOfferSubmissionStatus } }) =>
      Promise.resolve(
        this.subs
          .filter((s) => !args.where.status || s.status === args.where.status)
          .map((s) => this.withRefs(s)),
      ),
    findUnique: (args: { where: { id: string } }) => {
      const s = this.subs.find((x) => x.id === args.where.id);
      return Promise.resolve(s ? this.withRefs(s) : null);
    },
    updateMany: (args: {
      where: { id: string; status: ManualOfferSubmissionStatus };
      data: Partial<FakeSubmission>;
    }) => {
      const s = this.subs.find((x) => x.id === args.where.id && x.status === args.where.status);
      if (!s) return Promise.resolve({ count: 0 });
      Object.assign(s, args.data);
      return Promise.resolve({ count: 1 });
    },
    update: (args: { where: { id: string }; data: Partial<FakeSubmission>; include?: unknown }) => {
      const s = this.subs.find((x) => x.id === args.where.id)!;
      Object.assign(s, args.data);
      return Promise.resolve(this.withRefs(s));
    },
  };

  readonly adminAuditLog = {
    create: (args: { data: FakeAuditRow }) => {
      this.audits.push(args.data);
      return Promise.resolve({ ...args.data });
    },
  };

  $transaction<T>(fn: (tx: FakeSubmissionsPrisma) => Promise<T>): Promise<T> {
    return fn(this);
  }
}

/** Fake ledger with real idempotency semantics: a repeated key is a no-op. */
class FakeLedger {
  records: Array<{ userId: string; amount: number; key: string; id: string }> = [];
  private byKey = new Map<string, string>();

  record(params: {
    userId: string;
    amount: number;
    sourceType: LedgerSourceType;
    sourceRefId?: string;
    idempotencyKey: string;
  }): Promise<{ entry: CoinLedger; duplicate: boolean }> {
    const existingId = this.byKey.get(params.idempotencyKey);
    if (existingId) {
      return Promise.resolve({ entry: { id: existingId } as CoinLedger, duplicate: true });
    }
    const id = randomUUID();
    this.byKey.set(params.idempotencyKey, id);
    this.records.push({ userId: params.userId, amount: params.amount, key: params.idempotencyKey, id });
    return Promise.resolve({ entry: { id } as CoinLedger, duplicate: false });
  }
}

class FakeReferral {
  calls: Array<{ userId: string; amount: number; sourceLedgerId: string }> = [];
  onUserEarned(p: { userId: string; amount: number; sourceLedgerId: string }): Promise<void> {
    this.calls.push(p);
    return Promise.resolve();
  }
}

class FakeNotifications implements NotificationHook {
  calls: Array<{ userId: string; coins: number }> = [];
  onCredited(n: { userId: string; coins: number }): Promise<void> {
    this.calls.push({ userId: n.userId, coins: n.coins });
    return Promise.resolve();
  }
}

describe('AdminManualOfferSubmissionsService', () => {
  let prisma: FakeSubmissionsPrisma;
  let ledger: FakeLedger;
  let referral: FakeReferral;
  let notifications: FakeNotifications;
  let service: AdminManualOfferSubmissionsService;

  beforeEach(() => {
    prisma = new FakeSubmissionsPrisma();
    ledger = new FakeLedger();
    referral = new FakeReferral();
    notifications = new FakeNotifications();
    service = new AdminManualOfferSubmissionsService(
      prisma as unknown as PrismaService,
      ledger as unknown as LedgerService,
      referral as unknown as ReferralService,
      notifications,
    );
  });

  it('approve credits the offer reward once, stamps reviewer, audits, and fans out', async () => {
    const sub = prisma.seed(ManualOfferSubmissionStatus.pending, 75);

    const view = await service.approve('admin-1', sub.id);

    expect(view.status).toBe('approved');
    expect(view.reviewed_by_admin_id).toBe('admin-1');
    expect(view.reviewed_at).not.toBeNull();

    // exactly one credit, source_type=offer, correct idempotency key
    expect(ledger.records).toHaveLength(1);
    expect(ledger.records[0].amount).toBe(75);
    expect(ledger.records[0].key).toBe(manualOfferCreditKey(sub.id));

    // audit + fan-out
    expect(prisma.audits[0]).toMatchObject({
      action: 'manual_offer_submission_approved',
      targetId: sub.id,
    });
    expect(notifications.calls).toHaveLength(1);
    expect(referral.calls).toHaveLength(1);
    expect(referral.calls[0]).toMatchObject({ userId: sub.userId, amount: 75 });
  });

  it('approve is idempotent — a second approve never double-credits', async () => {
    const sub = prisma.seed(ManualOfferSubmissionStatus.pending, 40);

    await service.approve('admin-1', sub.id);
    const second = await service.approve('admin-1', sub.id);

    expect(second.status).toBe('approved');
    expect(ledger.records).toHaveLength(1); // still one credit
  });

  it('approve on an already-rejected submission is a conflict', async () => {
    const sub = prisma.seed(ManualOfferSubmissionStatus.rejected);
    await expect(service.approve('admin-1', sub.id)).rejects.toBeInstanceOf(ConflictException);
    expect(ledger.records).toHaveLength(0);
  });

  it('approve on a missing submission throws NotFound', async () => {
    await expect(service.approve('admin-1', randomUUID())).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reject records the reason + reviewer and never credits', async () => {
    const sub = prisma.seed(ManualOfferSubmissionStatus.pending);

    const view = await service.reject('admin-2', sub.id, 'Screenshot is unreadable');

    expect(view.status).toBe('rejected');
    expect(view.review_reason).toBe('Screenshot is unreadable');
    expect(view.reviewed_by_admin_id).toBe('admin-2');
    expect(ledger.records).toHaveLength(0);
    expect(prisma.audits[0]).toMatchObject({
      action: 'manual_offer_submission_rejected',
      targetId: sub.id,
      reason: 'Screenshot is unreadable',
    });
  });

  it('rejecting a non-pending submission is a conflict', async () => {
    const sub = prisma.seed(ManualOfferSubmissionStatus.approved);
    await expect(service.reject('admin-1', sub.id, 'nope')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

// ── RBAC: offer management is super_admin-only; the review queue is open to
// reviewers (guarded only by AdminAuthGuard). Asserted against the real @Roles
// metadata on the controller handlers via RolesGuard. ──
describe('manual-offers RBAC', () => {
  const guard = new RolesGuard(new Reflector());

  const ctx = (role: AdminRole, handler: (...args: never[]) => unknown) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ admin: { id: 'a', role } }) as AuthenticatedRequest }),
      getHandler: () => handler,
      getClass: () => AdminManualOffersController,
    }) as never;

  it('blocks a reviewer from creating an offer (super_admin-only)', () => {
    expect(() => guard.canActivate(ctx(AdminRole.reviewer, AdminManualOffersController.prototype.create))).toThrow(
      ForbiddenException,
    );
  });

  it('blocks a reviewer from editing an offer (super_admin-only)', () => {
    expect(() => guard.canActivate(ctx(AdminRole.reviewer, AdminManualOffersController.prototype.update))).toThrow(
      ForbiddenException,
    );
  });

  it('allows a super_admin to manage offers', () => {
    expect(guard.canActivate(ctx(AdminRole.super_admin, AdminManualOffersController.prototype.create))).toBe(true);
  });

  it('allows a reviewer to approve/reject submissions (no @Roles gate)', () => {
    const reviewCtx = (handler: (...args: never[]) => unknown) =>
      ({
        switchToHttp: () => ({ getRequest: () => ({ admin: { id: 'a', role: AdminRole.reviewer } }) }),
        getHandler: () => handler,
        getClass: () => AdminManualOfferSubmissionsController,
      }) as never;
    expect(guard.canActivate(reviewCtx(AdminManualOfferSubmissionsController.prototype.approve))).toBe(true);
    expect(guard.canActivate(reviewCtx(AdminManualOfferSubmissionsController.prototype.reject))).toBe(true);
  });
});
