import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import {
  AdminAuthGuard,
  AuthenticatedAdmin,
  CurrentAdmin,
  Roles,
  RolesGuard,
} from '../../common/auth';
import { AdminConfigService, ConfigView } from './admin-config.service';
import { UpdateConfigDto } from './dto/update-config.dto';

/** C3.5 — config management. Reading is reviewer-viewable; writes super-admin. */
@Controller('admin/config')
@UseGuards(AdminAuthGuard, RolesGuard)
export class AdminConfigController {
  constructor(private readonly config: AdminConfigService) {}

  @Get()
  getAll(): Promise<ConfigView[]> {
    return this.config.getAll();
  }

  @Patch(':key')
  @Roles(AdminRole.super_admin)
  update(
    @CurrentAdmin() admin: AuthenticatedAdmin | undefined,
    @Param('key') key: string,
    @Body() dto: UpdateConfigDto,
  ): Promise<ConfigView> {
    return this.config.update(requireAdmin(admin).id, key, dto.value);
  }
}

function requireAdmin(admin: AuthenticatedAdmin | undefined): AuthenticatedAdmin {
  if (!admin) throw new UnauthorizedException();
  return admin;
}
