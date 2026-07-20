import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { GiftCard, GiftCardBrand, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AUDIT_ACTIONS, writeAuditLog } from '../../common/audit/admin-audit';

export interface GiftCardView {
  id: string;
  brand: string;
  denomination: number;
  coin_cost: number;
  is_active: boolean;
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
  constructor(private readonly prisma: PrismaService) {}

  /** Public catalog (JWT): active cards only, cheapest first. */
  async listActive(): Promise<GiftCardView[]> {
    const cards = await this.prisma.giftCard.findMany({
      where: { isActive: true },
      orderBy: [{ coinCost: 'asc' }],
    });
    return cards.map(toView);
  }

  /** Admin catalog: everything, incl. disabled cards. */
  async listAll(): Promise<GiftCardView[]> {
    const cards = await this.prisma.giftCard.findMany({
      orderBy: [{ brand: 'asc' }, { denomination: 'asc' }],
    });
    return cards.map(toView);
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
      return toView(card);
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
    return toView(card);
  }
}

function describeChange(input: UpdateGiftCardInput): string {
  const parts: string[] = [];
  if (input.coinCost !== undefined) parts.push(`coin_cost=${input.coinCost}`);
  if (input.isActive !== undefined) parts.push(`is_active=${input.isActive}`);
  return parts.join(' ');
}

function toView(card: GiftCard): GiftCardView {
  return {
    id: card.id,
    brand: card.brand,
    denomination: card.denomination,
    coin_cost: card.coinCost,
    is_active: card.isActive,
    created_at: card.createdAt.toISOString(),
  };
}
