import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GiftCard, GiftCardBrand, InventoryStatus, Prisma } from '@prisma/client';
import {
  AppConfigService,
  GIFTCARD_COINS_PER_RUPEE_CONFIG,
} from '../../common/app-config/app-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AUDIT_ACTIONS, writeAuditLog } from '../../common/audit/admin-audit';

export interface GiftCardView {
  id: string;
  brand: string;
  denomination: number;
  /**
   * COMPUTED coins required to redeem = denomination × giftcard.coins_per_rupee
   * (the admin-tunable config rate). The stored gift_cards.coin_cost column is
   * NOT used for pricing.
   */
  coin_cost: number;
  is_active: boolean;
  /** unused inventory codes available for this brand+denomination (G0.2) */
  available: number;
  created_at: string;
}

export interface CreateGiftCardInput {
  brand: GiftCardBrand;
  denomination: number;
  coinCost: number;
  isActive?: boolean;
}

export interface UpdateGiftCardInput {
  coinCost?: number;
  isActive?: boolean;
}

/**
 * Gift-card catalog (C1.1, TRD §2.6). Public reads expose only active cards;
 * admin CRUD is super-admin gated at the controller and writes an audit row in
 * the same transaction as every mutation.
 */
@Injectable()
export class GiftCardsService {
  private readonly logger = new Logger(GiftCardsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfigService,
  ) {}

  /**
   * Public catalog (JWT): INVENTORY-DRIVEN — the offered list is every
   * (brand, denomination) that currently has unused stock, cheapest first
   * (G0.2 / H10). Sold-out denominations (available === 0) never appear.
   *
   * The catalog table (`gift_cards`) is a supporting record, not the source of
   * truth for what's offerable: for every in-stock denomination we backfill a
   * catalog row if one is missing (e.g. inventory uploaded before the
   * auto-create path existed, like amazon ₹5/₹10) so the denomination becomes
   * offerable AND `redemptions.gift_card_id` always has a valid FK. This
   * reconciliation is idempotent — running it on every store load is harmless.
   * Admin `listAll` still returns the full catalog for management.
   */
  async listActive(): Promise<GiftCardView[]> {
    const [stock, rate] = await Promise.all([
      this.unusedStockByCard(),
      this.appConfig.giftCardCoinsPerRupee(),
    ]);
    // Backfill catalog rows for any in-stock denomination that lacks one, then
    // build the offered list from those rows joined to live stock counts.
    const cards = await this.ensureCatalogForStock(stock);
    return cards
      .filter((c) => c.isActive)
      .map((c) => toView(c, rate, stock))
      .filter((v) => v.available > 0)
      .sort((a, b) => a.denomination - b.denomination);
  }

  /**
   * INVENTORY-DRIVEN reconciliation: for every (brand, denomination) that has
   * unused stock, ensure an active `gift_cards` catalog row exists, creating any
   * that are missing (is_active=true, coin_cost = reference-only default). This
   * keeps the store truly inventory-driven and guarantees redemptions can always
   * resolve a valid gift_card_id. Idempotent and safe under concurrency (a
   * racing create that hits the unique constraint is ignored). Returns the
   * catalog rows for the in-stock denominations.
   */
  private async ensureCatalogForStock(stock: Map<string, number>): Promise<GiftCard[]> {
    const wanted = [...stock.keys()].map((key) => {
      const sep = key.lastIndexOf(':');
      return {
        brand: key.slice(0, sep) as GiftCardBrand,
        denomination: Number(key.slice(sep + 1)),
      };
    });
    if (wanted.length === 0) return [];

    const orFilter = wanted.map((w) => ({ brand: w.brand, denomination: w.denomination }));
    const existing = await this.prisma.giftCard.findMany({ where: { OR: orFilter } });
    const have = new Set(existing.map((c) => `${c.brand}:${c.denomination}`));
    const missing = wanted.filter((w) => !have.has(`${w.brand}:${w.denomination}`));
    if (missing.length === 0) return existing;

    for (const m of missing) {
      try {
        await this.prisma.giftCard.create({
          data: {
            brand: m.brand,
            denomination: m.denomination,
            // Reference-only column; pricing always reads giftcard.coins_per_rupee.
            coinCost: m.denomination * GIFTCARD_COINS_PER_RUPEE_CONFIG.fallback,
            isActive: true,
          },
        });
        this.logger.log(
          `Backfilled catalog row for in-stock inventory: ${m.brand} ₹${m.denomination}`,
        );
      } catch (err) {
        // Created concurrently by another request — the unique constraint on
        // (brand, denomination) makes this a safe no-op.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          continue;
        }
        throw err;
      }
    }
    // Re-read so the just-created rows are included in the offered list.
    return this.prisma.giftCard.findMany({ where: { OR: orFilter } });
  }

  /** Admin catalog: everything, incl. disabled cards. */
  async listAll(): Promise<GiftCardView[]> {
    const cards = await this.prisma.giftCard.findMany({
      orderBy: [{ brand: 'asc' }, { denomination: 'asc' }],
    });
    const [stock, rate] = await Promise.all([
      this.unusedStockByCard(),
      this.appConfig.giftCardCoinsPerRupee(),
    ]);
    return cards.map((c) => toView(c, rate, stock));
  }

  /**
   * Unused inventory counts keyed by `brand:denomination` (G0.2). Joins the
   * encrypted gift_card_inventory so the store can show real per-card stock and
   * grey out sold-out cards. Only `unused` codes count as available — reserved
   * and issued codes are already committed to a redemption.
   */
  private async unusedStockByCard(): Promise<Map<string, number>> {
    const grouped = await this.prisma.giftCardInventory.groupBy({
      by: ['brand', 'denomination'],
      where: { status: InventoryStatus.unused },
      _count: { _all: true },
    });
    const map = new Map<string, number>();
    for (const g of grouped) {
      map.set(`${g.brand}:${g.denomination}`, g._count._all);
    }
    return map;
  }

  async create(adminId: string, input: CreateGiftCardInput): Promise<GiftCardView> {
    try {
      const card = await this.prisma.$transaction(async (tx) => {
        const created = await tx.giftCard.create({
          data: {
            brand: input.brand,
            denomination: input.denomination,
            coinCost: input.coinCost,
            isActive: input.isActive ?? true,
          },
        });
        await writeAuditLog(tx, {
          adminId,
          action: AUDIT_ACTIONS.GIFT_CARD_CREATED,
          targetType: 'gift_card',
          targetId: created.id,
          reason: `${input.brand} ₹${input.denomination} @ ${input.coinCost} coins`,
        });
        return created;
      });
      return toView(card, await this.appConfig.giftCardCoinsPerRupee());
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('A gift card for this brand and denomination already exists');
      }
      throw err;
    }
  }

  async update(adminId: string, id: string, input: UpdateGiftCardInput): Promise<GiftCardView> {
    const card = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.giftCard.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException('Gift card not found');
      }
      const updated = await tx.giftCard.update({
        where: { id },
        data: {
          ...(input.coinCost !== undefined ? { coinCost: input.coinCost } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
      await writeAuditLog(tx, {
        adminId,
        action: AUDIT_ACTIONS.GIFT_CARD_UPDATED,
        targetType: 'gift_card',
        targetId: id,
        reason: describeChange(input),
      });
      return updated;
    });
    return toView(card, await this.appConfig.giftCardCoinsPerRupee());
  }
}

function describeChange(input: UpdateGiftCardInput): string {
  const parts: string[] = [];
  if (input.coinCost !== undefined) parts.push(`coin_cost=${input.coinCost}`);
  if (input.isActive !== undefined) parts.push(`is_active=${input.isActive}`);
  return parts.join(' ');
}

function toView(card: GiftCard, coinsPerRupee: number, stock?: Map<string, number>): GiftCardView {
  return {
    id: card.id,
    brand: card.brand,
    denomination: card.denomination,
    // COMPUTED from the config rate — the stored card.coinCost column is ignored.
    coin_cost: card.denomination * coinsPerRupee,
    is_active: card.isActive,
    available: stock?.get(`${card.brand}:${card.denomination}`) ?? 0,
    created_at: card.createdAt.toISOString(),
  };
}
