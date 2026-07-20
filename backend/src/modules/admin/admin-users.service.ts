import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CoinLedger, LedgerSourceType, Prisma, UserStatus } from '@prisma/client';
import { AUDIT_ACTIONS, writeAuditLog } from '../../common/audit/admin-audit';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { LedgerEntryView } from '../wallet/wallet.service';
import { decodeCursor, encodeCursor } from '../wallet/wallet.service';

export interface AdminUserListItem {
  id: string;
  email: string;
  display_name: string;
  country: string | null;
  status: string;
  coin_balance_cached: number;
  created_at: string;
  last_seen_at: string;
}

export interface AdminUserListPage {
  users: AdminUserListItem[];
  next_cursor: string | null;
}

export interface AdminUserDetail extends AdminUserListItem {
  referral_code: string;
  devices: Array<{ id: string; device_fingerprint: string; first_seen: string; last_seen: string }>;
  fraud_flags: Array<{
    id: string;
    rule_triggered: string;
    severity: string;
    auto_action: string;
    status: string;
    created_at: string;
  }>;
}

export interface LedgerPageView {
  entries: LedgerEntryView[];
  next_cursor: string | null;
}

/**
 * C3.1/C3.2 — admin user management. Viewing (list / detail / ledger) is open
 * to reviewers; balance adjust + ban are super-admin only (enforced at the
 * controller). Balance adjust writes the coin_ledger row and its audit row in
 * ONE transaction (atomic — a failed audit rolls back the adjustment).
 */
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  async list(
    filter: { status?: UserStatus; search?: string },
    cursor: string | undefined,
    limit: number | undefined,
  ): Promise<AdminUserListPage> {
    const take = Math.min(Math.max(limit ?? 25, 1), 100);
    const where: Prisma.UserWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.search
        ? {
            OR: [
              { email: { contains: filter.search, mode: 'insensitive' } },
              { displayName: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const decoded = cursor !== undefined ? decodeCursor(cursor) : null;
    if (decoded) {
      where.AND = [
        {
          OR: [
            { createdAt: { lt: decoded.createdAt } },
            { createdAt: decoded.createdAt, id: { lt: decoded.id } },
          ],
        },
      ];
    }
    const rows = await this.prisma.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });
    const page = rows.slice(0, take);
    const last = page[page.length - 1];
    return {
      users: page.map(toListItem),
      next_cursor: rows.length > take && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async detail(userId: string): Promise<AdminUserDetail> {
    const user = await this.findUser(userId);
    const [devices, flags] = await Promise.all([
      this.prisma.device.findMany({ where: { userId }, orderBy: { lastSeen: 'desc' } }),
      this.prisma.fraudFlag.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    ]);
    return {
      ...toListItem(user),
      referral_code: user.referralCode,
      devices: devices.map((d) => ({
        id: d.id,
        device_fingerprint: d.deviceFingerprint,
        first_seen: d.firstSeen.toISOString(),
        last_seen: d.lastSeen.toISOString(),
      })),
      fraud_flags: flags.map((f) => ({
        id: f.id,
        rule_triggered: f.ruleTriggered,
        severity: f.severity,
        auto_action: f.autoAction,
        status: f.status,
        created_at: f.createdAt.toISOString(),
      })),
    };
  }

  async userLedger(
    userId: string,
    cursor: string | undefined,
    limit: number | undefined,
  ): Promise<LedgerPageView> {
    await this.findUser(userId); // 404 on unknown id
    const take = Math.min(Math.max(limit ?? 25, 1), 100);
    const where: Prisma.CoinLedgerWhereInput = { userId };
    const decoded = cursor !== undefined ? decodeCursor(cursor) : null;
    if (decoded) {
      where.OR = [
        { createdAt: { lt: decoded.createdAt } },
        { createdAt: decoded.createdAt, id: { lt: decoded.id } },
      ];
    }
    const rows = await this.prisma.coinLedger.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });
    const page = rows.slice(0, take);
    const last = page[page.length - 1];
    return {
      entries: page.map(toEntryView),
      next_cursor: rows.length > take && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  /**
   * C3.2 — manual balance adjustment. LedgerService.recordInTx + the audit row
   * commit atomically; a failure on either rolls back both (money-critical).
   */
  async adjustBalance(
    adminId: string,
    userId: string,
    amount: number,
    reason: string,
  ): Promise<{ balance_after: number; ledger_id: string }> {
    await this.findUser(userId);
    const idempotencyKey = `admin_adjust:${randomUUID()}`;
    const entry = await this.prisma.$transaction(async (tx) => {
      const ledgerEntry = await this.ledger.recordInTx(tx, {
        userId,
        amount,
        sourceType: LedgerSourceType.admin_adjustment,
        sourceRefId: adminId,
        idempotencyKey,
      });
      await writeAuditLog(tx, {
        adminId,
        action: AUDIT_ACTIONS.BALANCE_ADJUSTED,
        targetType: 'user',
        targetId: userId,
        reason: `${amount > 0 ? '+' : ''}${amount}: ${reason}`,
      });
      return ledgerEntry;
    });
    return { balance_after: entry.balanceAfter, ledger_id: entry.id };
  }

  async setBanned(
    adminId: string,
    userId: string,
    banned: boolean,
    reason?: string,
  ): Promise<AdminUserListItem> {
    await this.findUser(userId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { status: banned ? UserStatus.banned : UserStatus.active },
      });
      await writeAuditLog(tx, {
        adminId,
        action: banned ? AUDIT_ACTIONS.USER_BANNED : AUDIT_ACTIONS.USER_UNBANNED,
        targetType: 'user',
        targetId: userId,
        reason: reason ?? null,
      });
      return user;
    });
    return toListItem(updated);
  }

  private async findUser(userId: string): Promise<Prisma.UserGetPayload<object>> {
    let user: Prisma.UserGetPayload<object> | null = null;
    try {
      user = await this.prisma.user.findUnique({ where: { id: userId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        throw new NotFoundException('User not found'); // malformed uuid
      }
      throw err;
    }
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}

function toListItem(user: {
  id: string;
  email: string;
  displayName: string;
  country: string | null;
  status: string;
  coinBalanceCached: number;
  createdAt: Date;
  lastSeenAt: Date;
}): AdminUserListItem {
  return {
    id: user.id,
    email: user.email,
    display_name: user.displayName,
    country: user.country,
    status: user.status,
    coin_balance_cached: user.coinBalanceCached,
    created_at: user.createdAt.toISOString(),
    last_seen_at: user.lastSeenAt.toISOString(),
  };
}

function toEntryView(entry: CoinLedger): LedgerEntryView {
  return {
    id: entry.id,
    amount: entry.amount,
    source_type: entry.sourceType,
    source_ref_id: entry.sourceRefId,
    balance_after: entry.balanceAfter,
    created_at: entry.createdAt.toISOString(),
  };
}
