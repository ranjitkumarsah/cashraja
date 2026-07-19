import { createHash, randomBytes, randomInt } from 'node:crypto';
import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User, UserStatus } from '@prisma/client';
import {
  ACCESS_TOKEN_TTL,
  APP_AUDIENCE,
  REFRESH_TOKEN_TTL_DAYS,
} from '../../common/auth/jwt-claims';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  FIREBASE_VERIFIER,
  FirebaseVerifier,
  VerifiedFirebaseToken,
} from './firebase/firebase-verifier';
import { GEOIP_SERVICE, GeoipService } from './geoip/geoip.service';

/** Unambiguous uppercase alphabet (no I/L/O/0/1) for referral codes. */
const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const REFERRAL_CODE_LENGTH = 8;
const REFERRAL_CODE_MAX_ATTEMPTS = 5;
const REFERRAL_CONFIG_KEY = 'referral.bonus_percent';
const DAY_MS = 24 * 60 * 60 * 1000;

export interface GoogleLoginParams {
  idToken: string;
  deviceFingerprint: string;
  referralCode?: string;
  clientIp: string | null;
}

export interface AuthUserView {
  id: string;
  display_name: string;
  email: string;
  coin_balance_cached: number;
  referral_code: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface GoogleLoginResult extends AuthTokens {
  user: AuthUserView;
}

/**
 * App-user auth (A4.2–A4.4): Firebase ID token exchange, user + device
 * upsert, referral linkage, JWT issuance and refresh rotation with
 * reuse-detection revocation. Refresh tokens are opaque 256-bit random
 * values; only their SHA-256 hash is stored.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(FIREBASE_VERIFIER) private readonly verifier: FirebaseVerifier,
    @Inject(GEOIP_SERVICE) private readonly geoip: GeoipService,
  ) {}

  async loginWithGoogle(params: GoogleLoginParams): Promise<GoogleLoginResult> {
    let identity: VerifiedFirebaseToken;
    try {
      identity = await this.verifier.verifyIdToken(params.idToken);
    } catch {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    let user = await this.prisma.user.findUnique({ where: { googleUid: identity.uid } });
    const isNewUser = user === null;
    if (!user) {
      const country = await this.geoip.countryForIp(params.clientIp);
      user = await this.createUser(identity, country, params.deviceFingerprint);
    } else {
      if (user.status === UserStatus.banned) {
        throw new ForbiddenException('Account is banned');
      }
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { lastSeenAt: new Date() },
      });
    }

    await this.prisma.device.upsert({
      where: {
        userId_deviceFingerprint: {
          userId: user.id,
          deviceFingerprint: params.deviceFingerprint,
        },
      },
      update: { lastSeen: new Date() },
      create: { userId: user.id, deviceFingerprint: params.deviceFingerprint },
    });

    if (isNewUser && params.referralCode) {
      await this.linkReferral(user, params.referralCode);
    }

    const tokens = await this.issueTokens(user.id);
    return {
      ...tokens,
      user: {
        id: user.id,
        display_name: user.displayName,
        email: user.email,
        coin_balance_cached: user.coinBalanceCached,
        referral_code: user.referralCode,
      },
    };
  }

  /**
   * Rotate a refresh token. A token that is revoked or already rotated is
   * treated as REUSE: every live refresh token of that user is revoked and
   * the caller gets 401 (stolen-token containment).
   */
  async refresh(rawRefreshToken: string): Promise<AuthTokens> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored) {
      throw new UnauthorizedException('Unknown refresh token');
    }

    const successor = await this.prisma.refreshToken.findFirst({
      where: { rotatedFromId: stored.id },
    });
    if (stored.revokedAt !== null || successor !== null) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.logger.warn(`Refresh token reuse detected for user ${stored.userId}; chain revoked`);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) {
      throw new UnauthorizedException('Unknown user');
    }
    if (user.status === UserStatus.banned) {
      throw new ForbiddenException('Account is banned');
    }

    const nextRaw = this.newOpaqueToken();
    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      await tx.refreshToken.create({
        data: {
          tokenHash: this.hashToken(nextRaw),
          userId: stored.userId,
          expiresAt: this.refreshExpiry(),
          rotatedFromId: stored.id,
        },
      });
    });

    const accessToken = await this.signAccessToken(stored.userId);
    return { access_token: accessToken, refresh_token: nextRaw };
  }

  // ─── internals ───

  private async createUser(
    identity: VerifiedFirebaseToken,
    country: string | null,
    deviceFingerprint: string,
  ): Promise<User> {
    for (let attempt = 1; attempt <= REFERRAL_CODE_MAX_ATTEMPTS; attempt++) {
      const referralCode = this.generateReferralCode();
      const collision = await this.prisma.user.findUnique({ where: { referralCode } });
      if (collision) continue;
      try {
        return await this.prisma.user.create({
          data: {
            googleUid: identity.uid,
            email: identity.email,
            displayName: identity.name,
            country,
            deviceId: deviceFingerprint,
            referralCode,
          },
        });
      } catch (err) {
        // Lost a race on the unique referral_code: regenerate and retry.
        if (this.isUniqueViolationOn(err, 'referral_code') && attempt < REFERRAL_CODE_MAX_ATTEMPTS) {
          continue;
        }
        throw err;
      }
    }
    throw new Error('Could not generate a unique referral code');
  }

  /**
   * Referral linkage only (A4.2): records the referrals row with the
   * bonus-percent + window snapshot from app_config. Invalid or self codes
   * are skipped silently; the earnings fan-out is a later phase (D4.3).
   */
  private async linkReferral(user: User, rawCode: string): Promise<void> {
    try {
      const code = rawCode.trim().toUpperCase();
      const referrer = await this.prisma.user.findUnique({ where: { referralCode: code } });
      if (!referrer || referrer.id === user.id) {
        return;
      }
      const { percent, windowDays } = await this.referralDefaults();
      await this.prisma.referral.create({
        data: {
          referrerId: referrer.id,
          referredId: user.id,
          bonusPercent: percent,
          validUntil: new Date(Date.now() + windowDays * DAY_MS),
        },
      });
    } catch (err) {
      this.logger.warn(
        `Referral linkage skipped for user ${user.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async referralDefaults(): Promise<{ percent: number; windowDays: number }> {
    const row = await this.prisma.appConfig.findFirst({
      where: { key: REFERRAL_CONFIG_KEY },
      orderBy: { version: 'desc' },
    });
    const value = (row?.value ?? {}) as { percent?: unknown; window_days?: unknown };
    return {
      percent: typeof value.percent === 'number' ? value.percent : 10,
      windowDays: typeof value.window_days === 'number' ? value.window_days : 30,
    };
  }

  private async issueTokens(userId: string): Promise<AuthTokens> {
    const accessToken = await this.signAccessToken(userId);
    const raw = this.newOpaqueToken();
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(raw),
        userId,
        expiresAt: this.refreshExpiry(),
      },
    });
    return { access_token: accessToken, refresh_token: raw };
  }

  private signAccessToken(userId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        audience: APP_AUDIENCE,
        expiresIn: ACCESS_TOKEN_TTL,
      },
    );
  }

  private generateReferralCode(): string {
    let code = '';
    for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
      code += REFERRAL_CODE_ALPHABET[randomInt(REFERRAL_CODE_ALPHABET.length)];
    }
    return code;
  }

  /** Opaque 256-bit random refresh token (hex). Only its SHA-256 is stored. */
  private newOpaqueToken(): string {
    return randomBytes(32).toString('hex');
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * DAY_MS);
  }

  private isUniqueViolationOn(err: unknown, column: string): boolean {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') {
      return false;
    }
    const target = (err.meta as { target?: string[] | string } | undefined)?.target;
    if (target === undefined) return false;
    const targets = Array.isArray(target) ? target : [target];
    return targets.some((t) => t.includes(column));
  }
}
