import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedAdmin, AuthenticatedRequest } from './jwt-claims';

/** Injects the authenticated admin set by AdminAuthGuard: `{ id, role }`. */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedAdmin | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().admin,
);
