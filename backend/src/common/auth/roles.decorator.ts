import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '@prisma/client';

export const ROLES_KEY = 'cash-raja:roles';

/**
 * Restrict an admin route to specific roles (RBAC matrix, ARCHITECTURE_PLAN
 * §2.3). super_admin always passes — its permission set is a strict superset
 * of reviewer's. Must be used behind AdminAuthGuard.
 */
export const Roles = (...roles: AdminRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
