import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ADMIN_AUDIENCE, AdminTokenPayload, AuthenticatedRequest } from './jwt-claims';
import { bearerTokenOf } from './bearer-token';

/**
 * Admin guard: accepts only JWTs signed with JWT_ADMIN_SECRET carrying
 * aud=admin. App tokens and TOTP challenge tokens (aud=admin-totp) fail
 * verification here with 401 — before any role check (RolesGuard) runs.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = bearerTokenOf(request);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: AdminTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AdminTokenPayload>(token, {
        secret: this.config.get<string>('JWT_ADMIN_SECRET'),
        audience: ADMIN_AUDIENCE,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired admin token');
    }

    request.admin = { id: payload.sub, role: payload.role };
    return true;
  }
}
