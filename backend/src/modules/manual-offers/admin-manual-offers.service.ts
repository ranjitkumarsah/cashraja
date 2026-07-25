import { Injectable, NotFoundException } from '@nestjs/common';
import { ManualOffer } from '@prisma/client';
import { AUDIT_ACTIONS, writeAuditLog } from '../../common/audit/admin-audit';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface AdminManualOfferView {
  id: string;
  title: string;
  description: string;
  instructions: string;
  coin_reward: number;
  is_active: boolean;
  created_by_admin_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateManualOfferInput {
  title: string;
  description: string;
  instructions: string;
  coinReward: number;
}

export interface UpdateManualOfferInput {
  isActive?: boolean;
  title?: string;
  description?: string;
  instructions?: string;
  coinReward?: number;
}

/**
 * H5 — super-admin management of manual offers. Every mutation writes an
 * admin_audit_log row in the same transaction as its effect.
 */
@Injectable()
export class AdminManualOffersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Full catalog (active + disabled), newest first. */
  async list(): Promise<AdminManualOfferView[]> {
    const offers = await this.prisma.manualOffer.findMany({ orderBy: { createdAt: 'desc' } });
    return offers.map(toAdminOfferView);
  }

  async create(adminId: string, input: CreateManualOfferInput): Promise<AdminManualOfferView> {
    const offer = await this.prisma.$transaction(async (tx) => {
      const created = await tx.manualOffer.create({
        data: {
          title: input.title,
          description: input.description,
          instructions: input.instructions,
          coinReward: input.coinReward,
          createdByAdminId: adminId,
        },
      });
      await writeAuditLog(tx, {
        adminId,
        action: AUDIT_ACTIONS.MANUAL_OFFER_CREATED,
        targetType: 'manual_offer',
        targetId: created.id,
        reason: `${input.title} @ ${input.coinReward} coins`,
      });
      return created;
    });
    return toAdminOfferView(offer);
  }

  async update(
    adminId: string,
    id: string,
    input: UpdateManualOfferInput,
  ): Promise<AdminManualOfferView> {
    const offer = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.manualOffer.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException('Manual offer not found');
      }
      const updated = await tx.manualOffer.update({
        where: { id },
        data: {
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
          ...(input.coinReward !== undefined ? { coinReward: input.coinReward } : {}),
        },
      });
      await writeAuditLog(tx, {
        adminId,
        action: AUDIT_ACTIONS.MANUAL_OFFER_UPDATED,
        targetType: 'manual_offer',
        targetId: id,
        reason: describeChange(input),
      });
      return updated;
    });
    return toAdminOfferView(offer);
  }
}

function describeChange(input: UpdateManualOfferInput): string {
  const parts: string[] = [];
  if (input.isActive !== undefined) parts.push(`is_active=${input.isActive}`);
  if (input.title !== undefined) parts.push('title');
  if (input.description !== undefined) parts.push('description');
  if (input.instructions !== undefined) parts.push('instructions');
  if (input.coinReward !== undefined) parts.push(`coin_reward=${input.coinReward}`);
  return parts.join(' ');
}

export function toAdminOfferView(offer: ManualOffer): AdminManualOfferView {
  return {
    id: offer.id,
    title: offer.title,
    description: offer.description,
    instructions: offer.instructions,
    coin_reward: offer.coinReward,
    is_active: offer.isActive,
    created_by_admin_id: offer.createdByAdminId,
    created_at: offer.createdAt.toISOString(),
    updated_at: offer.updatedAt.toISOString(),
  };
}
