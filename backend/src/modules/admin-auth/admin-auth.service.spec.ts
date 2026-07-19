import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AdminRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminAuthService } from './admin-auth.service';
import { FakeAdminPrisma } from './testing/fake-admin-prisma';

const ADMIN_SECRET = 'test-admin-secret-0123456789';
const PASSWORD = 'Correct-Horse-9';
const passwordHash = bcrypt.hashSync(PASSWORD, 4);

function secretFromOtpauthUrl(url: string): string {
  const match = /[?&]secret=([A-Z2-7]+)/.exec(url);
  if (!match) throw new Error(`no secret in otpauth url: ${url}`);
  return match[1];
}

describe('AdminAuthService', () => {
  let fake: FakeAdminPrisma;
  let service: AdminAuthService;
  let jwt: JwtService;

  beforeEach(() => {
    fake = new FakeAdminPrisma();
    jwt = new JwtService({});
    const config = new ConfigService({ JWT_ADMIN_SECRET: ADMIN_SECRET });
    service = new AdminAuthService(fake as unknown as PrismaService, jwt, config);
  });

  describe('login', () => {
    it('rejects unknown email with 401', async () => {
      await expect(service.login('nobody@x.io', PASSWORD)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a wrong password with 401', async () => {
      fake.seedAdmin({ email: 'a@x.io', passwordHash });
      await expect(service.login('a@x.io', 'wrong-password')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a disabled admin with 401', async () => {
      fake.seedAdmin({ email: 'a@x.io', passwordHash, status: 'disabled' });
      await expect(service.login('a@x.io', PASSWORD)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('returns a totp challenge (not a session) when TOTP is configured', async () => {
      fake.seedAdmin({ email: 'a@x.io', passwordHash, totpSecret: authenticator.generateSecret() });
      const result = await service.login('a@x.io', PASSWORD);
      expect(result.totp_required).toBe(true);
      expect(result.totp_setup_required).toBeUndefined();
      expect(result.otpauth_url).toBeUndefined();
      expect(result.challenge_token).toBeTruthy();
      expect(result).not.toHaveProperty('access_token');
    });

    it('returns a totp-setup challenge with otpauth URL for a fresh admin', async () => {
      fake.seedAdmin({ email: 'fresh@x.io', passwordHash });
      const result = await service.login('fresh@x.io', PASSWORD);
      expect(result.totp_setup_required).toBe(true);
      expect(result.totp_required).toBeUndefined();
      expect(result.otpauth_url).toContain('otpauth://totp/');
      expect(result.otpauth_url).toContain('fresh%40x.io');
      // secret is NOT persisted until the first valid code
      expect(fake.adminsStore[0].totpSecret).toBeNull();
    });
  });

  describe('TOTP setup flow', () => {
    it('persists the secret and issues an admin JWT on a correct first code', async () => {
      const admin = fake.seedAdmin({ email: 'fresh@x.io', passwordHash, role: AdminRole.reviewer });
      const challenge = await service.login('fresh@x.io', PASSWORD);
      const secret = secretFromOtpauthUrl(challenge.otpauth_url!);

      const session = await service.setupTotp(
        challenge.challenge_token,
        authenticator.generate(secret),
      );

      expect(fake.adminsStore[0].totpSecret).toBe(secret);
      expect(session.admin).toEqual({ id: admin.id, email: 'fresh@x.io', role: 'reviewer' });

      const payload = await jwt.verifyAsync<{ sub: string; aud: string; role: string }>(
        session.access_token,
        { secret: ADMIN_SECRET, audience: 'admin' },
      );
      expect(payload.sub).toBe(admin.id);
      expect(payload.role).toBe('reviewer');
    });

    it('rejects a wrong first code and persists nothing', async () => {
      fake.seedAdmin({ email: 'fresh@x.io', passwordHash });
      const challenge = await service.login('fresh@x.io', PASSWORD);
      await expect(service.setupTotp(challenge.challenge_token, '000000')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(fake.adminsStore[0].totpSecret).toBeNull();
    });

    it('rejects a setup attempt when TOTP is already configured', async () => {
      fake.seedAdmin({ email: 'fresh@x.io', passwordHash });
      const challenge = await service.login('fresh@x.io', PASSWORD);
      const secret = secretFromOtpauthUrl(challenge.otpauth_url!);
      await service.setupTotp(challenge.challenge_token, authenticator.generate(secret));

      // replaying the same (still unexpired) setup challenge must fail
      await expect(
        service.setupTotp(challenge.challenge_token, authenticator.generate(secret)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('TOTP verify flow', () => {
    const seedWithTotp = (role: AdminRole = AdminRole.super_admin) => {
      const secret = authenticator.generateSecret();
      const admin = fake.seedAdmin({ email: 'a@x.io', passwordHash, totpSecret: secret, role });
      return { admin, secret };
    };

    it('issues an admin JWT (aud=admin, role claim) on a correct code', async () => {
      const { admin, secret } = seedWithTotp();
      const challenge = await service.login('a@x.io', PASSWORD);
      const session = await service.verifyTotp(
        challenge.challenge_token,
        authenticator.generate(secret),
      );

      const payload = await jwt.verifyAsync<{ sub: string; aud: string; role: string }>(
        session.access_token,
        { secret: ADMIN_SECRET, audience: 'admin' },
      );
      expect(payload.sub).toBe(admin.id);
      expect(payload.aud).toBe('admin');
      expect(payload.role).toBe('super_admin');
    });

    it('rejects a wrong TOTP code with 401', async () => {
      seedWithTotp();
      const challenge = await service.login('a@x.io', PASSWORD);
      await expect(service.verifyTotp(challenge.challenge_token, '000000')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a garbage challenge token with 401', async () => {
      seedWithTotp();
      await expect(service.verifyTotp('garbage.token.here', '123456')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a setup-purpose challenge on the verify endpoint', async () => {
      // fresh admin gets a totp-setup challenge; using it on /totp must fail
      fake.seedAdmin({ email: 'fresh@x.io', passwordHash });
      const challenge = await service.login('fresh@x.io', PASSWORD);
      const secret = secretFromOtpauthUrl(challenge.otpauth_url!);
      await expect(
        service.verifyTotp(challenge.challenge_token, authenticator.generate(secret)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an admin JWT used as a challenge token (audience mismatch)', async () => {
      const { secret } = seedWithTotp();
      const challenge = await service.login('a@x.io', PASSWORD);
      const session = await service.verifyTotp(
        challenge.challenge_token,
        authenticator.generate(secret),
      );
      await expect(
        service.verifyTotp(session.access_token, authenticator.generate(secret)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
