import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import {
  AdminNotificationsService,
  BroadcastResult,
  BroadcastView,
} from './admin-notifications.service';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';

/**
 * H8 — admin broadcast notifications. Super-admin only (whole controller):
 * composing and sending a broadcast to all users (or a chosen list) is a
 * high-blast-radius action, so it sits above the reviewer RBAC line.
 */
@ApiTags('admin')
@Controller('admin/notifications')
@UseGuards(AdminAuthGuard, RolesGuard)
@Roles(AdminRole.super_admin)
export class AdminNotificationsController {
  constructor(private readonly notifications: AdminNotificationsService) {}

  @Post('broadcast')
  @HttpCode(HttpStatus.CREATED)
  broadcast(
    @CurrentAdmin() admin: AuthenticatedAdmin | undefined,
    @Body() dto: BroadcastNotificationDto,
  ): Promise<BroadcastResult> {
    return this.notifications.broadcast(requireAdmin(admin).id, {
      title: dto.title,
      body: dto.body,
      audience: dto.audience,
    });
  }

  @Get('broadcasts')
  async history(): Promise<{ broadcasts: BroadcastView[] }> {
    return this.notifications.history();
  }
}

function requireAdmin(admin: AuthenticatedAdmin | undefined): AuthenticatedAdmin {
  if (!admin) throw new UnauthorizedException();
  return admin;
}
