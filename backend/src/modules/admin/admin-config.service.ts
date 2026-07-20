import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../common/app-config/app-config.service';
import { AUDIT_ACTIONS, writeAuditLog } from '../../common/audit/admin-audit';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface ConfigView {
  key: string;
  value: unknown;
  version: number;
  updated_at: string;
}

/**
 * C3.5 — versioned config management. GET returns the current (max-version)
 * value per key; PATCH appends a NEW (key, version) row rather than mutating,
 * preserving history and the snapshot-at-time-of-use semantics the read side
 * (AppConfigService) relies on. Every write is audited and busts the read cache.
 */
@Injectable()
export class AdminConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfigService,
  ) {}

  /** Current value of every key (max version). */
  async getAll(): Promise<ConfigView[]> {
    const rows = await this.prisma.appConfig.findMany({
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    });
    const latest = new Map<string, ConfigView>();
    for (const row of rows) {
      if (!latest.has(row.key)) {
        latest.set(row.key, {
          key: row.key,
          value: row.value,
          version: row.version,
          updated_at: row.createdAt.toISOString(),
        });
      }
    }
    return [...latest.values()];
  }

  /** Append a new version for a key. */
  async update(adminId: string, key: string, value: Record<string, unknown>): Promise<ConfigView> {
    const created = await this.prisma.$transaction(async (tx) => {
      const current = await tx.appConfig.findFirst({
        where: { key },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const nextVersion = (current?.version ?? 0) + 1;
      const row = await tx.appConfig.create({
        data: { key, value: value as never, version: nextVersion, updatedByAdminId: adminId },
      });
      await writeAuditLog(tx, {
        adminId,
        action: AUDIT_ACTIONS.CONFIG_UPDATED,
        targetType: 'app_config',
        targetId: key,
        reason: `version ${nextVersion}`,
      });
      return row;
    });
    // New version is now current — drop the stale read cache immediately.
    this.appConfig.clearCache();
    return {
      key: created.key,
      value: created.value,
      version: created.version,
      updated_at: created.createdAt.toISOString(),
    };
  }
}
