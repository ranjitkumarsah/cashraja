import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@prisma/client';
import { AuthenticatedRequest } from './jwt-claims';
import { ROLES_KEY } from './roles.decorator';

/**
 * Role check for admin routes. Runs AFTER AdminAuthGuard (which enforces
 * audience separation): a missing request.admin here means the guard chain
 * was mis-wired, and is rejected. super_admin passes every @Roles() gate.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AdminRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const admin = context.switchToHttp().getRequest<AuthenticatedRequest>().admin;
    if (!admin) {
      throw new ForbiddenException('No admin identity on request');
    }
    if (admin.role === AdminRole.super_admin) {
      return true;
    }
    if (!required.includes(admin.role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
