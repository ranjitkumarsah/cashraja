import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { APP_AUDIENCE, AppTokenPayload, AuthenticatedRequest } from './jwt-claims';
import { bearerTokenOf } from './bearer-token';

/**
 * App-user guard: accepts only JWTs signed with JWT_ACCESS_SECRET carrying
 * aud=app. Admin tokens (different secret AND different audience) fail here
 * with 401 — audience separation is enforced before any other check.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
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

    let payload: AppTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AppTokenPayload>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        audience: APP_AUDIENCE,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    request.user = { id: payload.sub };
    return true;
  }
}
