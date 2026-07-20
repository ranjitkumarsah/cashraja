import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface AccountDeletionResult {
  deleted: true;
  user_id: string;
}

/**
 * C3.8 / Play policy — account self-deletion. PII is anonymized IN PLACE
 * (email, name, google_uid, device fingerprints) rather than hard-deleted,
 * because coin_ledger and redemptions are also a financial/audit record for
 * issued gift cards (Data & Security §6). Ledger rows are preserved; refresh
 * tokens are revoked so existing sessions die; the freed google_uid lets the
 * person register a fresh account on next sign-in.
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(private readonly prisma: PrismaService) {}

  async deleteSelf(userId: string): Promise<AccountDeletionResult> {
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Anonymize PII in place. google_uid is freed (unique marker) so the
      // Google account is no longer linked to this (now anonymous) row.
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `deleted+${userId}@deleted.invalid`,
          displayName: 'Deleted User',
          country: null,
          deviceId: null,
          googleUid: `deleted:${userId}`,
          status: UserStatus.banned,
        },
      });

      // Anonymize per-device fingerprints (each kept unique to satisfy the
      // (user_id, fingerprint) constraint) — the fraud audit trail's shape is
      // preserved without the identifying value.
      const devices = await tx.device.findMany({ where: { userId }, select: { id: true } });
      for (const device of devices) {
        await tx.device.update({
          where: { id: device.id },
          data: { deviceFingerprint: `deleted:${device.id}` },
        });
      }

      // Revoke every live refresh token → all sessions invalidated.
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    this.logger.warn(`Account self-deleted (anonymized): user=${userId}`);
    return { deleted: true, user_id: userId };
  }
}
