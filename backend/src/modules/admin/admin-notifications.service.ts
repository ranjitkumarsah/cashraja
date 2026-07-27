import { Injectable, Logger } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { AUDIT_ACTIONS, writeAuditLog } from '../../common/audit/admin-audit';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { BroadcastAudienceDto } from './dto/broadcast-notification.dto';

export interface BroadcastView {
  id: string;
  title: string;
  body: string;
  audience_type: string;
  target_count: number;
  sent_by_admin_id: string;
  sent_by_admin_email: string | null;
  created_at: string;
}

export interface BroadcastResult {
  broadcast: BroadcastView;
}

/** Max inbox rows written per createMany chunk (keeps a single statement bounded). */
const INBOX_CHUNK = 1_000;

/**
 * H8 — admin broadcast. Composes one notification for an audience (all active
 * users, or an explicit list) by writing an inbox row per targeted user AND an
 * FCM multicast to their registered tokens, and records a NotificationBroadcast
 * history row (audit-logged). Push is best-effort and never fails the broadcast.
 */
@Injectable()
export class AdminNotificationsService {
  private readonly logger = new Logger(AdminNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async broadcast(
    adminId: string,
    input: { title: string; body: string; audience: BroadcastAudienceDto },
  ): Promise<BroadcastResult> {
    const userIds = await this.resolveAudience(input.audience);

    // Inbox rows + history row + audit commit atomically. Push is fired after.
    const broadcast = await this.prisma.$transaction(async (tx) => {
      const created = await tx.notificationBroadcast.create({
        data: {
          title: input.title,
          body: input.body,
          audienceType: input.audience.type,
          targetCount: userIds.length,
          sentByAdminId: adminId,
        },
      });
      for (let i = 0; i < userIds.length; i += INBOX_CHUNK) {
        const chunk = userIds.slice(i, i + INBOX_CHUNK);
        await tx.notification.createMany({
          data: chunk.map((userId) => ({
            userId,
            type: 'broadcast',
            title: input.title,
            body: input.body,
          })),
        });
      }
      await writeAuditLog(tx, {
        adminId,
        action: AUDIT_ACTIONS.NOTIFICATION_BROADCAST_SENT,
        targetType: 'notification_broadcast',
        targetId: created.id,
        reason: `audience=${input.audience.type} count=${userIds.length}`,
      });
      return created;
    });

    // Best-effort push (outside the tx — a push failure must not roll back inbox).
    try {
      await this.notifications.pushMany(userIds, {
        type: 'broadcast',
        title: input.title,
        body: input.body,
        data: { kind: 'broadcast', broadcast_id: broadcast.id },
      });
    } catch (err) {
      this.logger.warn(`broadcast push failed: ${(err as Error).message}`);
    }

    return { broadcast: toBroadcastView({ ...broadcast, sentBy: null }) };
  }

  /** Recent broadcasts, newest first (history for the admin panel). */
  async history(limit = 50): Promise<{ broadcasts: BroadcastView[] }> {
    const take = Math.min(Math.max(limit, 1), 200);
    const rows = await this.prisma.notificationBroadcast.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: { sentBy: { select: { email: true } } },
    });
    return { broadcasts: rows.map(toBroadcastView) };
  }

  /** Resolve the audience to a de-duplicated list of existing user ids. */
  private async resolveAudience(audience: BroadcastAudienceDto): Promise<string[]> {
    if (audience.type === 'all') {
      const users = await this.prisma.user.findMany({
        where: { status: UserStatus.active },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    const requested = [...new Set(audience.user_ids ?? [])];
    if (requested.length === 0) return [];
    // Only target users that actually exist (silently drop unknown ids).
    const existing = await this.prisma.user.findMany({
      where: { id: { in: requested } },
      select: { id: true },
    });
    return existing.map((u) => u.id);
  }
}

function toBroadcastView(row: {
  id: string;
  title: string;
  body: string;
  audienceType: string;
  targetCount: number;
  sentByAdminId: string;
  createdAt: Date;
  sentBy?: { email: string } | null;
}): BroadcastView {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    audience_type: row.audienceType,
    target_count: row.targetCount,
    sent_by_admin_id: row.sentByAdminId,
    sent_by_admin_email: row.sentBy?.email ?? null,
    created_at: row.createdAt.toISOString(),
  };
}
