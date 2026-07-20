import { randomBytes } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AdminRole, AdminStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AUDIT_ACTIONS, writeAuditLog } from '../../common/audit/admin-audit';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface AdminView {
  id: string;
  email: string;
  role: string;
  status: string;
  totp_configured: boolean;
  created_at: string;
}

export interface CreateAdminResult extends AdminView {
  /** One-time temp password — shown once, never stored or logged in plaintext. */
  temp_password: string;
}

/**
 * C3.6 — admin account management (super-admin only). New admins get a random
 * temp password (returned once) and configure TOTP on first login through the
 * existing admin-auth setup flow. Never returns password hashes or TOTP secrets.
 */
@Injectable()
export class AdminAdminsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AdminView[]> {
    const admins = await this.prisma.admin.findMany({ orderBy: { createdAt: 'asc' } });
    return admins.map(toAdminView);
  }

  async create(actingAdminId: string, email: string, role: AdminRole): Promise<CreateAdminResult> {
    const tempPassword = randomBytes(12).toString('base64url');
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    try {
      const admin = await this.prisma.$transaction(async (tx) => {
        const created = await tx.admin.create({
          data: { email, passwordHash, role, status: AdminStatus.active },
        });
        await writeAuditLog(tx, {
          adminId: actingAdminId,
          action: AUDIT_ACTIONS.ADMIN_CREATED,
          targetType: 'admin',
          targetId: created.id,
          reason: `role=${role}`,
        });
        return created;
      });
      return { ...toAdminView(admin), temp_password: tempPassword };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('An admin with this email already exists');
      }
      throw err;
    }
  }

  async disable(actingAdminId: string, targetId: string): Promise<AdminView> {
    if (actingAdminId === targetId) {
      throw new BadRequestException('You cannot disable your own admin account');
    }
    const admin = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.admin.findUnique({ where: { id: targetId } });
      if (!existing) {
        throw new NotFoundException('Admin not found');
      }
      const updated = await tx.admin.update({
        where: { id: targetId },
        data: { status: AdminStatus.disabled },
      });
      await writeAuditLog(tx, {
        adminId: actingAdminId,
        action: AUDIT_ACTIONS.ADMIN_DISABLED,
        targetType: 'admin',
        targetId: targetId,
      });
      return updated;
    });
    return toAdminView(admin);
  }
}

function toAdminView(admin: {
  id: string;
  email: string;
  role: string;
  status: string;
  totpSecret: string | null;
  createdAt: Date;
}): AdminView {
  return {
    id: admin.id,
    email: admin.email,
    role: admin.role,
    status: admin.status,
    totp_configured: admin.totpSecret !== null,
    created_at: admin.createdAt.toISOString(),
  };
}
