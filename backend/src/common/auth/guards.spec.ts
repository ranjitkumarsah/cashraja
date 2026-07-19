import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AdminRole } from '@prisma/client';
import { AdminAuthGuard } from './admin-auth.guard';
import { AuthenticatedRequest } from './jwt-claims';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

const ACCESS_SECRET = 'test-access-secret-0123456789';
const ADMIN_SECRET = 'test-admin-secret-0123456789';

const jwt = new JwtService({});
const config = new ConfigService({
  JWT_ACCESS_SECRET: ACCESS_SECRET,
  JWT_ADMIN_SECRET: ADMIN_SECRET,
});

function contextFor(request: Partial<AuthenticatedRequest>, handler?: () => void): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler ?? ((): void => undefined),
    getClass: () => class TestController {},
  } as unknown as ExecutionContext;
}

function withBearer(token: string): Partial<AuthenticatedRequest> {
  return { headers: { authorization: `Bearer ${token}` } };
}

const signAppToken = (sub = 'user-1') =>
  jwt.signAsync({ sub }, { secret: ACCESS_SECRET, audience: 'app', expiresIn: '15m' });

const signAdminToken = (sub = 'admin-1', role: AdminRole = AdminRole.reviewer) =>
  jwt.signAsync({ sub, role }, { secret: ADMIN_SECRET, audience: 'admin', expiresIn: '8h' });

const signChallengeToken = (sub = 'admin-1') =>
  jwt.signAsync(
    { sub, purpose: 'totp' },
    { secret: ADMIN_SECRET, audience: 'admin-totp', expiresIn: '5m' },
  );

describe('JwtAuthGuard (aud=app)', () => {
  const guard = new JwtAuthGuard(jwt, config);

  it('accepts a valid app token and attaches request.user', async () => {
    const request = withBearer(await signAppToken('user-42'));
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'user-42' });
  });

  it('rejects an ADMIN token on an app route (audience separation)', async () => {
    const request = withBearer(await signAdminToken());
    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a missing Authorization header', async () => {
    await expect(guard.canActivate(contextFor({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a malformed token', async () => {
    await expect(guard.canActivate(contextFor(withBearer('garbage')))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an app-audience token signed with the wrong secret', async () => {
    const forged = await jwt.signAsync(
      { sub: 'user-1' },
      { secret: 'attacker-known-secret-000', audience: 'app', expiresIn: '15m' },
    );
    await expect(guard.canActivate(contextFor(withBearer(forged)))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('AdminAuthGuard (aud=admin)', () => {
  const guard = new AdminAuthGuard(jwt, config);

  it('accepts a valid admin token and attaches request.admin with role', async () => {
    const request = withBearer(await signAdminToken('admin-7', AdminRole.super_admin));
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.admin).toEqual({ id: 'admin-7', role: 'super_admin' });
  });

  it('rejects an APP token on an admin route (audience separation)', async () => {
    const request = withBearer(await signAppToken());
    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a TOTP challenge token (aud=admin-totp) even though it shares the secret', async () => {
    const request = withBearer(await signChallengeToken());
    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a missing bearer token', async () => {
    await expect(guard.canActivate(contextFor({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  class Handlers {
    @Roles(AdminRole.super_admin)
    superAdminOnly(): void {}

    @Roles(AdminRole.reviewer)
    reviewerRoute(): void {}

    unrestricted(): void {}
  }
  const handlers = new Handlers();

  const adminRequest = (role: AdminRole): Partial<AuthenticatedRequest> =>
    ({ admin: { id: 'admin-1', role } });

  it('blocks a reviewer on a super_admin-only route', () => {
    const ctx = contextFor(adminRequest(AdminRole.reviewer), handlers.superAdminOnly);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows a super_admin on a super_admin-only route', () => {
    const ctx = contextFor(adminRequest(AdminRole.super_admin), handlers.superAdminOnly);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows a reviewer on a reviewer route', () => {
    const ctx = contextFor(adminRequest(AdminRole.reviewer), handlers.reviewerRoute);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows a super_admin on a reviewer route (superset permissions)', () => {
    const ctx = contextFor(adminRequest(AdminRole.super_admin), handlers.reviewerRoute);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows any admin on a route without @Roles metadata', () => {
    const ctx = contextFor(adminRequest(AdminRole.reviewer), handlers.unrestricted);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejects when no admin identity is on the request (mis-wired guard chain)', () => {
    const ctx = contextFor({}, handlers.reviewerRoute);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
