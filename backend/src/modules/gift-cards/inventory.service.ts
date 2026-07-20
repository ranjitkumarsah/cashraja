import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GiftCardBrand, InventoryStatus, Prisma } from '@prisma/client';
import { ALERT_SERVICE, AlertService } from '../../common/alerts/alert.service';
import { AppConfigService } from '../../common/app-config/app-config.service';
import { AUDIT_ACTIONS, writeAuditLog } from '../../common/audit/admin-audit';
import { GiftCardCryptoService, maskCode } from '../../common/crypto/giftcard-crypto.service';
import { PrismaService } from '../../common/prisma/prisma.service';

export const LOW_STOCK_CONFIG = {
  key: 'inventory.low_stock_threshold',
  field: 'threshold',
  fallback: 5,
} as const;

export interface InventoryUploadResult {
  inserted: number;
  /** rejected as already-present (dedupe) or duplicated within the paste */
  skipped: number;
  total_submitted: number;
}

export interface InventoryItemView {
  id: string;
  brand: string;
  denomination: number;
  status: string;
  /** always masked here — the plaintext is only ever returned by the reveal endpoint */
  code_masked: string;
  redemption_id: string | null;
  created_at: string;
}

export interface StockLevel {
  brand: string;
  denomination: number;
  unused: number;
  reserved: number;
  issued: number;
}

interface LockedInventoryRow {
  id: string;
  code_encrypted: string;
}

/**
 * Manual gift-card inventory (C1.2–C1.4). Codes are AES-256-GCM encrypted at
 * rest and de-duped by keyed fingerprint; they are masked in every response
 * except the single audited super-admin reveal endpoint. Lifecycle:
 * unused → issued (claimed atomically at fulfillment, redemption attached).
 */
@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: GiftCardCryptoService,
    private readonly appConfig: AppConfigService,
    @Inject(ALERT_SERVICE) private readonly alerts: AlertService,
  ) {}

  /**
   * Encrypt + store a pasted batch of codes. Duplicates (within the paste or
   * already in inventory for this brand+denom) are silently skipped via the
   * unique fingerprint constraint. Audited.
   */
  async upload(
    adminId: string,
    brand: GiftCardBrand,
    denomination: number,
    rawCodes: string,
  ): Promise<InventoryUploadResult> {
    const codes = parseCodes(rawCodes);
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const code of codes) {
      const fp = this.crypto.fingerprint(code);
      if (seen.has(fp)) continue;
      seen.add(fp);
      unique.push(code);
    }

    let inserted = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const code of unique) {
        try {
          await tx.giftCardInventory.create({
            data: {
              brand,
              denomination,
              codeEncrypted: this.crypto.encrypt(code),
              codeFingerprint: this.crypto.fingerprint(code),
              status: InventoryStatus.unused,
              uploadedByAdminId: adminId,
            },
          });
          inserted += 1;
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            continue; // already in inventory for this brand+denom — dedupe
          }
          throw err;
        }
      }
      await writeAuditLog(tx, {
        adminId,
        action: AUDIT_ACTIONS.INVENTORY_UPLOADED,
        targetType: 'gift_card_inventory',
        targetId: `${brand}:${denomination}`,
        reason: `uploaded ${inserted} of ${codes.length} code(s)`,
      });
    });

    return { inserted, skipped: codes.length - inserted, total_submitted: codes.length };
  }

  /** Browse inventory (masked). Optional brand/denom/status filters. */
  async list(filter: {
    brand?: GiftCardBrand;
    denomination?: number;
    status?: InventoryStatus;
  }): Promise<InventoryItemView[]> {
    const where: Prisma.GiftCardInventoryWhereInput = {
      ...(filter.brand !== undefined ? { brand: filter.brand } : {}),
      ...(filter.denomination !== undefined ? { denomination: filter.denomination } : {}),
      ...(filter.status !== undefined ? { status: filter.status } : {}),
    };
    const rows = await this.prisma.giftCardInventory.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: 500,
    });
    return rows.map((r) => ({
      id: r.id,
      brand: r.brand,
      denomination: r.denomination,
      status: r.status,
      code_masked: '****',
      redemption_id: r.redemptionId,
      created_at: r.createdAt.toISOString(),
    }));
  }

  /** Stock counts per (brand, denomination) — drives the low-stock UI. */
  async stockLevels(): Promise<StockLevel[]> {
    const grouped = await this.prisma.giftCardInventory.groupBy({
      by: ['brand', 'denomination', 'status'],
      _count: { _all: true },
    });
    const map = new Map<string, StockLevel>();
    for (const g of grouped) {
      const key = `${g.brand}:${g.denomination}`;
      const level = map.get(key) ?? {
        brand: g.brand,
        denomination: g.denomination,
        unused: 0,
        reserved: 0,
        issued: 0,
      };
      if (g.status === InventoryStatus.unused) level.unused = g._count._all;
      else if (g.status === InventoryStatus.reserved) level.reserved = g._count._all;
      else level.issued = g._count._all;
      map.set(key, level);
    }
    return [...map.values()].sort(
      (a, b) => a.brand.localeCompare(b.brand) || a.denomination - b.denomination,
    );
  }

  /**
   * Audited reveal (C1.4, super-admin only — the ONE place a plaintext code
   * leaves the system). Decrypts and writes an audit row in the same tx.
   */
  async reveal(adminId: string, inventoryId: string): Promise<{ code: string; status: string }> {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.giftCardInventory.findUnique({ where: { id: inventoryId } });
      if (!item) {
        throw new NotFoundException('Inventory item not found');
      }
      await writeAuditLog(tx, {
        adminId,
        action: AUDIT_ACTIONS.INVENTORY_CODE_REVEALED,
        targetType: 'gift_card_inventory',
        targetId: inventoryId,
        reason: `${item.brand} ₹${item.denomination} (${item.status})`,
      });
      const plaintext = this.crypto.decrypt(item.codeEncrypted);
      // Never log the plaintext; the audit row records only that a reveal happened.
      this.logger.warn(`Inventory code revealed: item=${inventoryId} by admin=${adminId}`);
      return { code: plaintext, status: item.status };
    });
  }

  /**
   * Claim the next unused code for (brand, denomination) inside an existing
   * transaction. Row-locks with SKIP LOCKED so concurrent fulfillments never
   * hand out the same code. Idempotent per redemption: if a code was already
   * issued to this redemption (retry after a partial failure), returns it
   * instead of consuming a new one — this is what makes a paid redemption
   * impossible to lose or double-issue.
   */
  async claimForRedemption(
    tx: Prisma.TransactionClient,
    brand: GiftCardBrand,
    denomination: number,
    redemptionId: string,
  ): Promise<{ codeEncrypted: string } | null> {
    const already = await tx.giftCardInventory.findFirst({
      where: { redemptionId, status: InventoryStatus.issued },
      select: { codeEncrypted: true },
    });
    if (already) {
      return { codeEncrypted: already.codeEncrypted };
    }

    const rows = await tx.$queryRaw<LockedInventoryRow[]>`
      SELECT id, code_encrypted FROM gift_card_inventory
      WHERE brand = ${brand}::"GiftCardBrand"
        AND denomination = ${denomination}
        AND status = 'unused'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED`;
    const row = rows[0];
    if (!row) {
      return null; // out of stock
    }

    await tx.giftCardInventory.update({
      where: { id: row.id },
      data: { status: InventoryStatus.issued, redemptionId },
    });
    return { codeEncrypted: row.code_encrypted };
  }

  /**
   * Low-stock check for a (brand, denomination) — call after a code is
   * consumed. Alerts through ALERT_SERVICE when unused stock falls below the
   * admin-tunable threshold.
   */
  async checkLowStock(brand: GiftCardBrand, denomination: number): Promise<void> {
    const threshold = await this.appConfig.getNumber(
      LOW_STOCK_CONFIG.key,
      LOW_STOCK_CONFIG.field,
      LOW_STOCK_CONFIG.fallback,
    );
    const remaining = await this.prisma.giftCardInventory.count({
      where: { brand, denomination, status: InventoryStatus.unused },
    });
    if (remaining < threshold) {
      await this.alerts.alert({
        type: 'gift_card_low_stock',
        message: `Low gift-card stock: ${brand} ₹${denomination} has ${remaining} unused code(s) (threshold ${threshold})`,
        details: { brand, denomination, remaining, threshold },
      });
    }
  }
}

/** Split pasted text on newlines/commas/whitespace, trim, drop blanks. */
export function parseCodes(raw: string): string[] {
  return raw
    .split(/[\r\n,]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Exposed for tests: mask helper re-export. */
export { maskCode };
