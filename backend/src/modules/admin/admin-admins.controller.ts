import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
import { AdminAdminsService, AdminView, CreateAdminResult } from './admin-admins.service';
import { CreateAdminDto } from './dto/create-admin.dto';

/** C3.6 — admin account management. Super-admin only (whole controller). */
@Controller('admin/admins')
@UseGuards(AdminAuthGuard, RolesGuard)
@Roles(AdminRole.super_admin)
export class AdminAdminsController {
  constructor(private readonly admins: AdminAdminsService) {}

  @Get()
  list(): Promise<AdminView[]> {
    return this.admins.list();
  }

  @Post()
  create(
    @CurrentAdmin() admin: AuthenticatedAdmin | undefined,
    @Body() dto: CreateAdminDto,
  ): Promise<CreateAdminResult> {
    return this.admins.create(requireAdmin(admin).id, dto.email, dto.role);
  }

  @Post(':id/disable')
  @HttpCode(HttpStatus.OK)
  disable(
    @CurrentAdmin() admin: AuthenticatedAdmin | undefined,
    @Param('id') id: string,
  ): Promise<AdminView> {
    return this.admins.disable(requireAdmin(admin).id, id);
  }
}

function requireAdmin(admin: AuthenticatedAdmin | undefined): AuthenticatedAdmin {
  if (!admin) throw new UnauthorizedException();
  return admin;
}
