import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FraudFlag, FraudFlagStatus, UserStatus } from '@prisma/client';
import { AUDIT_ACTIONS, writeAuditLog } from '../../common/audit/admin-audit';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface FraudFlagView {
  id: string;
  user: { id: string; email: string; status: string };
  rule_triggered: string;
  severity: string;
  auto_action: string;
  status: string;
  resolution_action: string | null;
  resolved_by_admin_id: string | null;
  resolved_at: string | null;
  created_at: string;
}

export type FraudResolveAction = 'dismiss' | 'ban_user' | 'confirm';

/**
 * C3.7 — fraud-flag review queue. The rule engine (Phase E) writes open flags;
 * this is the admin surface to resolve them. Resolving with 'ban_user' also
 * bans the flagged user in the same transaction (both effects audited).
 */
@Injectable()
export class AdminFraudService {
  constructor(private readonly prisma: PrismaService) {}

  async list(status: FraudFlagStatus | undefined): Promise<FraudFlagView[]> {
    const flags = await this.prisma.fraudFlag.findMany({
      where: status ? { status } : {},
      orderBy: [{ createdAt: 'desc' }],
      include: { user: true },
      take: 500,
    });
    return flags.map(toFlagView);
  }

  async resolve(
    adminId: string,
    flagId: string,
    action: FraudResolveAction,
    note: string | undefined,
  ): Promise<FraudFlagView> {
    const resolved = await this.prisma.$transaction(async (tx) => {
      const flag = await tx.fraudFlag.findUnique({ where: { id: flagId }, include: { user: true } });
      if (!flag) {
        throw new NotFoundException('Fraud flag not found');
      }
      if (flag.status === FraudFlagStatus.resolved) {
        throw new ConflictException('Fraud flag is already resolved');
      }

      const updated = await tx.fraudFlag.update({
        where: { id: flagId },
        data: {
          status: FraudFlagStatus.resolved,
          resolutionAction: note ? `${action}: ${note}` : action,
          resolvedByAdminId: adminId,
          resolvedAt: new Date(),
        },
        include: { user: true },
      });
      await writeAuditLog(tx, {
        adminId,
        action: AUDIT_ACTIONS.FRAUD_FLAG_RESOLVED,
        targetType: 'fraud_flag',
        targetId: flagId,
        reason: note ? `${action}: ${note}` : action,
      });

      if (action === 'ban_user' && flag.user.status !== UserStatus.banned) {
        await tx.user.update({
          where: { id: flag.userId },
          data: { status: UserStatus.banned },
        });
        await writeAuditLog(tx, {
          adminId,
          action: AUDIT_ACTIONS.USER_BANNED,
          targetType: 'user',
          targetId: flag.userId,
          reason: `banned via fraud flag ${flagId}`,
        });
      }
      return updated;
    });
    return toFlagView(resolved);
  }
}

function toFlagView(flag: FraudFlag & { user: { id: string; email: string; status: string } }): FraudFlagView {
  return {
    id: flag.id,
    user: { id: flag.user.id, email: flag.user.email, status: flag.user.status },
    rule_triggered: flag.ruleTriggered,
    severity: flag.severity,
    auto_action: flag.autoAction,
    status: flag.status,
    resolution_action: flag.resolutionAction,
    resolved_by_admin_id: flag.resolvedByAdminId,
    resolved_at: flag.resolvedAt ? flag.resolvedAt.toISOString() : null,
    created_at: flag.createdAt.toISOString(),
  };
}
