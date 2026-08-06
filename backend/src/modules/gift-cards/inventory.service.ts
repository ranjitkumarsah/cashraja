import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { GiftCardBrand, InventoryStatus, Prisma } from '@prisma/client';
import { ALERT_SERVICE, AlertService } from '../../common/alerts/alert.service';
import {
  AppConfigService,
  GIFTCARD_COINS_PER_RUPEE_CONFIG,
} from '../../common/app-config/app-config.service';
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
      // Inventory upload is the SOLE way to add a gift card (no catalog screen).
      // Auto-create the catalog row for a (brand, denomination) first seen here
      // so the denomination becomes offerable and redemptions.gift_card_id has a
      // valid FK. coin_cost stored here is REFERENCE-ONLY (denomination × default
      // rate); pricing always reads giftcard.coins_per_rupee, never this column.
      const existingCard = await tx.giftCard.findUnique({
        where: { brand_denomination: { brand, denomination } },
      });
      if (!existingCard) {
        const created = await tx.giftCard.create({
          data: {
            brand,
            denomination,
            coinCost: denomination * GIFTCARD_COINS_PER_RUPEE_CONFIG.fallback,
            isActive: true,
          },
        });
        await writeAuditLog(tx, {
          adminId,
          action: AUDIT_ACTIONS.GIFT_CARD_CREATED,
          targetType: 'gift_card',
          targetId: created.id,
          reason: `auto-created via inventory upload: ${brand} ₹${denomination}`,
        });
      }
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
   * Delete a single UNUSED inventory code (C1.x admin cleanup). Reserved/issued
   * codes are money-critical and can never be deleted. Audited.
   */
  async deleteUnused(adminId: string, inventoryId: string): Promise<{ deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.giftCardInventory.findUnique({ where: { id: inventoryId } });
      if (!item) {
        throw new NotFoundException('Inventory item not found');
      }
      if (item.status !== InventoryStatus.unused) {
        throw new BadRequestException('Only unused codes can be deleted');
      }
      await tx.giftCardInventory.delete({ where: { id: inventoryId } });
      await writeAuditLog(tx, {
        adminId,
        action: AUDIT_ACTIONS.INVENTORY_DELETED,
        targetType: 'gift_card_inventory',
        targetId: inventoryId,
        reason: `deleted unused ${item.brand} ₹${item.denomination}`,
      });
      return { deleted: true } as const;
    });
  }

  /**
   * Edit an UNUSED code's denomination (value) and/or the code string. Reserved/
   * issued codes are immutable. Changing the code re-encrypts + re-fingerprints;
   * changing the denomination auto-creates the catalog row for the new
   * (brand, denomination) if needed (mirrors upload). Audited.
   */
  async updateUnused(
    adminId: string,
    inventoryId: string,
    patch: { denomination?: number; code?: string },
  ): Promise<InventoryItemView> {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.giftCardInventory.findUnique({ where: { id: inventoryId } });
      if (!item) {
        throw new NotFoundException('Inventory item not found');
      }
      if (item.status !== InventoryStatus.unused) {
        throw new BadRequestException('Only unused codes can be edited');
      }

      const newDenomination = patch.denomination ?? item.denomination;
      const newCode = patch.code?.trim();
      if (newDenomination <= 0) {
        throw new BadRequestException('Denomination must be greater than zero');
      }
      if (patch.code !== undefined && (!newCode || newCode.length < 3)) {
        throw new BadRequestException('Code is too short');
      }

      // Ensure a catalog row exists for the (brand, new denomination) so the
      // denomination stays offerable (same rule as upload()).
      if (newDenomination !== item.denomination) {
        const existingCard = await tx.giftCard.findUnique({
          where: { brand_denomination: { brand: item.brand, denomination: newDenomination } },
        });
        if (!existingCard) {
          const created = await tx.giftCard.create({
            data: {
              brand: item.brand,
              denomination: newDenomination,
              coinCost: newDenomination * GIFTCARD_COINS_PER_RUPEE_CONFIG.fallback,
              isActive: true,
            },
          });
          await writeAuditLog(tx, {
            adminId,
            action: AUDIT_ACTIONS.GIFT_CARD_CREATED,
            targetType: 'gift_card',
            targetId: created.id,
            reason: `auto-created via inventory edit: ${item.brand} ₹${newDenomination}`,
          });
        }
      }

      const data: Prisma.GiftCardInventoryUpdateInput = { denomination: newDenomination };
      if (newCode) {
        data.codeEncrypted = this.crypto.encrypt(newCode);
        data.codeFingerprint = this.crypto.fingerprint(newCode);
      }

      let updated;
      try {
        updated = await tx.giftCardInventory.update({ where: { id: inventoryId }, data });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new ConflictException('That code already exists for this brand and denomination');
        }
        throw err;
      }

      await writeAuditLog(tx, {
        adminId,
        action: AUDIT_ACTIONS.INVENTORY_UPDATED,
        targetType: 'gift_card_inventory',
        targetId: inventoryId,
        reason:
          `edited ${item.brand}: ₹${item.denomination}→₹${newDenomination}` +
          (newCode ? ', code replaced' : ''),
      });

      return {
        id: updated.id,
        brand: updated.brand,
        denomination: updated.denomination,
        status: updated.status,
        code_masked: '****',
        redemption_id: updated.redemptionId,
        created_at: updated.createdAt.toISOString(),
      };
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
