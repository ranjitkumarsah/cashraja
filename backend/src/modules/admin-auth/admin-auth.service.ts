import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Admin, AdminRole, AdminStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import {
  ADMIN_AUDIENCE,
  ADMIN_TOKEN_TTL,
  ADMIN_TOTP_AUDIENCE,
  TOTP_CHALLENGE_TTL,
  TotpChallengePayload,
  TotpChallengePurpose,
} from '../../common/auth/jwt-claims';
import { PrismaService } from '../../common/prisma/prisma.service';

const TOTP_ISSUER = 'Cash Raja';

export interface TotpChallengeResult {
  totp_required?: true;
  totp_setup_required?: true;
  challenge_token: string;
  /** Present only on setup: otpauth:// URL for the QR code. */
  otpauth_url?: string;
}

export interface AdminSessionResult {
  access_token: string;
  admin: { id: string; email: string; role: AdminRole };
}

/**
 * Admin auth (A4.7): bcrypt password → TOTP second factor → admin JWT
 * (aud=admin, 8h, role claim). Admins without a TOTP secret (fresh seed) go
 * through a one-time setup flow: the pending secret rides inside the signed
 * 5-minute challenge JWT and is persisted only after the first valid code.
 * Failed logins are logged without any credential material.
 */
@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);
  // Allow one time-step of clock drift either way.
  private readonly totp = authenticator.clone();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.totp.options = { window: 1 };
  }

  async login(email: string, password: string): Promise<TotpChallengeResult> {
    const admin = await this.prisma.admin.findUnique({ where: { email } });
    if (!admin || admin.status !== AdminStatus.active) {
      this.logger.warn(`Admin login failed (unknown or inactive account): ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }
    const passwordOk = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordOk) {
      this.logger.warn(`Admin login failed (bad password): ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (admin.totpSecret) {
      const challengeToken = await this.signChallenge(admin.id, 'totp');
      return { totp_required: true, challenge_token: challengeToken };
    }

    // First login on a fresh account: issue a setup challenge carrying the
    // pending secret; it becomes active only after the first valid code.
    const secret = this.totp.generateSecret();
    const challengeToken = await this.signChallenge(admin.id, 'totp-setup', secret);
    return {
      totp_setup_required: true,
      challenge_token: challengeToken,
      otpauth_url: this.totp.keyuri(admin.email, TOTP_ISSUER, secret),
    };
  }

  async verifyTotp(challengeToken: string, code: string): Promise<AdminSessionResult> {
    const payload = await this.verifyChallenge(challengeToken);
    if (payload.purpose !== 'totp') {
      throw new UnauthorizedException('Invalid challenge token');
    }
    const admin = await this.getActiveAdmin(payload.sub);
    if (!admin.totpSecret || !this.totp.verify({ token: code, secret: admin.totpSecret })) {
      this.logger.warn(`Admin TOTP verification failed: ${admin.email}`);
      throw new UnauthorizedException('Invalid TOTP code');
    }
    return this.issueAdminSession(admin);
  }

  async setupTotp(challengeToken: string, code: string): Promise<AdminSessionResult> {
    const payload = await this.verifyChallenge(challengeToken);
    if (payload.purpose !== 'totp-setup' || !payload.totp_secret) {
      throw new UnauthorizedException('Invalid challenge token');
    }
    const admin = await this.getActiveAdmin(payload.sub);
    if (admin.totpSecret) {
      throw new UnauthorizedException('TOTP is already configured');
    }
    if (!this.totp.verify({ token: code, secret: payload.totp_secret })) {
      this.logger.warn(`Admin TOTP setup failed (bad code): ${admin.email}`);
      throw new UnauthorizedException('Invalid TOTP code');
    }

    // Conditional write: loses gracefully if a concurrent setup already ran.
    const updated = await this.prisma.admin.updateMany({
      where: { id: admin.id, totpSecret: null },
      data: { totpSecret: payload.totp_secret },
    });
    if (updated.count !== 1) {
      throw new UnauthorizedException('TOTP is already configured');
    }
    return this.issueAdminSession(admin);
  }

  // ─── internals ───

  private async issueAdminSession(admin: Admin): Promise<AdminSessionResult> {
    const accessToken = await this.jwt.signAsync(
      { sub: admin.id, role: admin.role },
      {
        secret: this.config.get<string>('JWT_ADMIN_SECRET'),
        audience: ADMIN_AUDIENCE,
        expiresIn: ADMIN_TOKEN_TTL,
      },
    );
    return {
      access_token: accessToken,
      admin: { id: admin.id, email: admin.email, role: admin.role },
    };
  }

  private signChallenge(
    adminId: string,
    purpose: TotpChallengePurpose,
    totpSecret?: string,
  ): Promise<string> {
    return this.jwt.signAsync(
      { sub: adminId, purpose, ...(totpSecret ? { totp_secret: totpSecret } : {}) },
      {
        secret: this.config.get<string>('JWT_ADMIN_SECRET'),
        audience: ADMIN_TOTP_AUDIENCE,
        expiresIn: TOTP_CHALLENGE_TTL,
      },
    );
  }

  private async verifyChallenge(challengeToken: string): Promise<TotpChallengePayload> {
    try {
      return await this.jwt.verifyAsync<TotpChallengePayload>(challengeToken, {
        secret: this.config.get<string>('JWT_ADMIN_SECRET'),
        audience: ADMIN_TOTP_AUDIENCE,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired challenge token');
    }
  }

  private async getActiveAdmin(id: string): Promise<Admin> {
    const admin = await this.prisma.admin.findUnique({ where: { id } });
    if (!admin || admin.status !== AdminStatus.active) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return admin;
  }
}
