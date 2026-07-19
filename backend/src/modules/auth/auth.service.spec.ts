import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthService } from './auth.service';
import { MockFirebaseVerifier } from './firebase/mock-firebase-verifier';
import { MockGeoipService } from './geoip/geoip.service';
import { FakeAuthPrisma } from './testing/fake-auth-prisma';

const ACCESS_SECRET = 'test-access-secret-0123456789';

describe('AuthService', () => {
  let fake: FakeAuthPrisma;
  let service: AuthService;
  let jwt: JwtService;

  beforeEach(() => {
    fake = new FakeAuthPrisma();
    jwt = new JwtService({});
    const config = new ConfigService({ JWT_ACCESS_SECRET: ACCESS_SECRET });
    service = new AuthService(
      fake as unknown as PrismaService,
      jwt,
      config,
      new MockFirebaseVerifier(),
      new MockGeoipService(),
    );
  });

  const login = (idToken: string, fingerprint = 'device-fp-0001', referralCode?: string) =>
    service.loginWithGoogle({
      idToken,
      deviceFingerprint: fingerprint,
      referralCode,
      clientIp: '203.0.113.7',
    });

  describe('loginWithGoogle', () => {
    it('creates a new user with generated referral code, device row and GeoIP country', async () => {
      const result = await login('mock:uid-1:alice@example.com');

      expect(result.access_token).toBeTruthy();
      expect(result.refresh_token).toMatch(/^[0-9a-f]{64}$/);
      expect(result.user.email).toBe('alice@example.com');
      expect(result.user.display_name).toBe('alice');
      expect(result.user.coin_balance_cached).toBe(0);
      expect(result.user.referral_code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);

      const stored = fake.usersStore[0];
      expect(stored.googleUid).toBe('uid-1');
      expect(stored.country).toBe('IN');
      expect(fake.devicesStore).toHaveLength(1);
      expect(fake.devicesStore[0]).toMatchObject({
        userId: stored.id,
        deviceFingerprint: 'device-fp-0001',
      });
      expect(fake.refreshTokensStore).toHaveLength(1);
      // only the SHA-256 hash is stored, never the raw token
      expect(fake.refreshTokensStore[0].tokenHash).not.toBe(result.refresh_token);
      expect(fake.refreshTokensStore[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('issues an access JWT with aud=app and sub=user id', async () => {
      const result = await login('mock:uid-1:alice@example.com');
      const payload = await jwt.verifyAsync<{ sub: string; aud: string }>(result.access_token, {
        secret: ACCESS_SECRET,
        audience: 'app',
      });
      expect(payload.sub).toBe(result.user.id);
      expect(payload.aud).toBe('app');
    });

    it('logs an existing user back in without creating a duplicate', async () => {
      const first = await login('mock:uid-1:alice@example.com');
      const second = await login('mock:uid-1:alice@example.com');

      expect(fake.usersStore).toHaveLength(1);
      expect(second.user.id).toBe(first.user.id);
      expect(second.user.referral_code).toBe(first.user.referral_code);
      // same device fingerprint → still one device row, lastSeen updated
      expect(fake.devicesStore).toHaveLength(1);
      // a fresh refresh token per login
      expect(fake.refreshTokensStore).toHaveLength(2);
    });

    it('records a second device row for a new fingerprint', async () => {
      await login('mock:uid-1:alice@example.com', 'device-fp-0001');
      await login('mock:uid-1:alice@example.com', 'device-fp-0002');
      expect(fake.devicesStore).toHaveLength(2);
    });

    it('rejects a banned user with 403', async () => {
      fake.seedUser({
        googleUid: 'uid-banned',
        referralCode: 'BANNED22',
        status: UserStatus.banned,
      });
      await expect(login('mock:uid-banned:bad@example.com')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(fake.refreshTokensStore).toHaveLength(0);
    });

    it('rejects invalid mock tokens with 401', async () => {
      await expect(login('not-a-mock-token')).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(login('mock:uid-only')).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(login('mock:uid:not-an-email')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(fake.usersStore).toHaveLength(0);
    });
  });

  describe('referral linkage', () => {
    it('links a valid referral code with config snapshot (percent + window)', async () => {
      const referrer = fake.seedUser({ googleUid: 'uid-ref', referralCode: 'REFER123' });
      fake.seedAppConfig('referral.bonus_percent', { percent: 12, window_days: 14 });

      const before = Date.now();
      const result = await login('mock:uid-new:new@example.com', 'device-fp-0009', 'REFER123');

      expect(fake.referralsStore).toHaveLength(1);
      const referral = fake.referralsStore[0];
      expect(referral.referrerId).toBe(referrer.id);
      expect(referral.referredId).toBe(result.user.id);
      expect(Number(referral.bonusPercent)).toBe(12);
      const expectedValidUntil = before + 14 * 24 * 60 * 60 * 1000;
      expect(Math.abs(referral.validUntil.getTime() - expectedValidUntil)).toBeLessThan(10_000);
    });

    it('falls back to default percent/window when app_config has no row', async () => {
      fake.seedUser({ googleUid: 'uid-ref', referralCode: 'REFER123' });
      await login('mock:uid-new:new@example.com', 'device-fp-0009', 'REFER123');
      expect(Number(fake.referralsStore[0].bonusPercent)).toBe(10);
    });

    it('normalizes case/whitespace on the entered code', async () => {
      fake.seedUser({ googleUid: 'uid-ref', referralCode: 'REFER123' });
      await login('mock:uid-new:new@example.com', 'device-fp-0009', '  refer123 ');
      expect(fake.referralsStore).toHaveLength(1);
    });

    it('skips silently on an invalid code (login still succeeds)', async () => {
      const result = await login('mock:uid-new:new@example.com', 'device-fp-0009', 'NOSUCH99');
      expect(result.access_token).toBeTruthy();
      expect(fake.referralsStore).toHaveLength(0);
    });

    it('skips silently when the code resolves to the user themself', async () => {
      const user = fake.seedUser({ googleUid: 'uid-self', referralCode: 'SELFCODE' });
      await service['linkReferral'](user, 'SELFCODE');
      expect(fake.referralsStore).toHaveLength(0);
    });

    it('does not link referrals for existing users logging in again', async () => {
      fake.seedUser({ googleUid: 'uid-ref', referralCode: 'REFER123' });
      await login('mock:uid-1:alice@example.com');
      await login('mock:uid-1:alice@example.com', 'device-fp-0001', 'REFER123');
      expect(fake.referralsStore).toHaveLength(0);
    });
  });

  describe('refresh rotation', () => {
    it('rotates: returns new tokens, revokes the old row, links rotated_from_id', async () => {
      const loginResult = await login('mock:uid-1:alice@example.com');
      const rotated = await service.refresh(loginResult.refresh_token);

      expect(rotated.access_token).toBeTruthy();
      expect(rotated.refresh_token).not.toBe(loginResult.refresh_token);

      expect(fake.refreshTokensStore).toHaveLength(2);
      const [oldRow, newRow] = fake.refreshTokensStore;
      expect(oldRow.revokedAt).not.toBeNull();
      expect(newRow.rotatedFromId).toBe(oldRow.id);
      expect(newRow.revokedAt).toBeNull();

      // the new token is itself usable
      const again = await service.refresh(rotated.refresh_token);
      expect(again.refresh_token).toBeTruthy();
    });

    it('rejects an unknown refresh token with 401', async () => {
      await expect(service.refresh('f'.repeat(64))).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('detects reuse of a rotated token and revokes the whole chain', async () => {
      const loginResult = await login('mock:uid-1:alice@example.com');
      const rotated = await service.refresh(loginResult.refresh_token);

      // replaying the already-rotated token = reuse
      await expect(service.refresh(loginResult.refresh_token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      // every token of the user is now revoked — including the newest one
      expect(fake.refreshTokensStore.every((t) => t.revokedAt !== null)).toBe(true);
      await expect(service.refresh(rotated.refresh_token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects an expired refresh token with 401 (no rotation, no revocation cascade)', async () => {
      const loginResult = await login('mock:uid-1:alice@example.com');
      fake.refreshTokensStore[0].expiresAt = new Date(Date.now() - 1000);

      await expect(service.refresh(loginResult.refresh_token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(fake.refreshTokensStore).toHaveLength(1);
    });

    it('rejects refresh for a banned user with 403', async () => {
      const loginResult = await login('mock:uid-1:alice@example.com');
      fake.usersStore[0].status = UserStatus.banned;
      await expect(service.refresh(loginResult.refresh_token)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
