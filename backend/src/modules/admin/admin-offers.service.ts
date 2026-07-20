import { Injectable, NotFoundException } from '@nestjs/common';
import { Offer, Prisma } from '@prisma/client';
import { AUDIT_ACTIONS, writeAuditLog } from '../../common/audit/admin-audit';
import { PrismaService } from '../../common/prisma/prisma.service';
import { decodeCursor, encodeCursor } from '../wallet/wallet.service';

export interface AdminOfferView {
  id: string;
  network: string;
  external_offer_id: string;
  title: string;
  description: string | null;
  coin_reward: number;
  is_active: boolean;
  created_at: string;
}

export interface PostbackLogView {
  id: string;
  user_id: string;
  network: string;
  external_txn_id: string;
  status: string;
  coin_reward: number;
  status_reason: string | null;
  network_payload: unknown;
  created_at: string;
}

export interface PostbackLogPage {
  logs: PostbackLogView[];
  next_cursor: string | null;
}

/** C3.4 — offer management + postback log viewer (super-admin for mutations). */
@Injectable()
export class AdminOffersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AdminOfferView[]> {
    const offers = await this.prisma.offer.findMany({
      orderBy: [{ network: 'asc' }, { coinReward: 'desc' }],
    });
    return offers.map(toOfferView);
  }

  async update(
    adminId: string,
    id: string,
    input: { isActive?: boolean; coinReward?: number },
  ): Promise<AdminOfferView> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.offer.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundException('Offer not found');
      }
      const offer = await tx.offer.update({
        where: { id },
        data: {
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.coinReward !== undefined ? { coinReward: input.coinReward } : {}),
        },
      });
      await writeAuditLog(tx, {
        adminId,
        action: AUDIT_ACTIONS.OFFER_UPDATED,
        targetType: 'offer',
        targetId: id,
        reason: describeOfferChange(input),
      });
      return offer;
    });
    return toOfferView(updated);
  }

  /** C3.4 — read the raw verified postback payloads (offer_completions). */
  async postbackLogs(
    cursor: string | undefined,
    limit: number | undefined,
  ): Promise<PostbackLogPage> {
    const take = Math.min(Math.max(limit ?? 25, 1), 100);
    const where: Prisma.OfferCompletionWhereInput = {};
    const decoded = cursor !== undefined ? decodeCursor(cursor) : null;
    if (decoded) {
      where.OR = [
        { createdAt: { lt: decoded.createdAt } },
        { createdAt: decoded.createdAt, id: { lt: decoded.id } },
      ];
    }
    const rows = await this.prisma.offerCompletion.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });
    const page = rows.slice(0, take);
    const last = page[page.length - 1];
    return {
      logs: page.map((r) => ({
        id: r.id,
        user_id: r.userId,
        network: r.network,
        external_txn_id: r.externalTxnId,
        status: r.status,
        coin_reward: r.coinReward,
        status_reason: r.statusReason,
        network_payload: r.networkPayload,
        created_at: r.createdAt.toISOString(),
      })),
      next_cursor: rows.length > take && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }
}

function describeOfferChange(input: { isActive?: boolean; coinReward?: number }): string {
  const parts: string[] = [];
  if (input.isActive !== undefined) parts.push(`is_active=${input.isActive}`);
  if (input.coinReward !== undefined) parts.push(`coin_reward=${input.coinReward}`);
  return parts.join(' ');
}

function toOfferView(offer: Offer): AdminOfferView {
  return {
    id: offer.id,
    network: offer.network,
    external_offer_id: offer.externalOfferId,
    title: offer.title,
    description: offer.description,
    coin_reward: offer.coinReward,
    is_active: offer.isActive,
    created_at: offer.createdAt.toISOString(),
  };
}
