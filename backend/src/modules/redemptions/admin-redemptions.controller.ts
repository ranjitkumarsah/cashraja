import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard, AuthenticatedAdmin, CurrentAdmin, RolesGuard } from '../../common/auth';
import {
  AdminRedemptionPage,
  AdminRedemptionsService,
  AdminRedemptionView,
  ApproveResult,
} from './admin-redemptions.service';
import { RejectRedemptionDto } from './dto/reject-redemption.dto';
import { RedemptionQueryDto } from './dto/redemption-query.dto';

/**
 * C3.3 — admin redemption queue + review. All routes need a valid admin token;
 * reviewers and super-admins may both view, approve, reject and export (RBAC
 * matrix §2.3), so no @Roles() gate beyond authentication is required here.
 */
@Controller('admin/redemptions')
@UseGuards(AdminAuthGuard, RolesGuard)
export class AdminRedemptionsController {
  constructor(private readonly admin: AdminRedemptionsService) {}

  @Get()
  queue(@Query() query: RedemptionQueryDto): Promise<AdminRedemptionPage> {
    return this.admin.queue(query.status, query.cursor, query.limit);
  }

  @Get('export')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="redemptions.csv"')
  export(@Query() query: RedemptionQueryDto): Promise<string> {
    return this.admin.exportCsv(query.status);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @CurrentAdmin() admin: AuthenticatedAdmin | undefined,
    @Param('id') id: string,
  ): Promise<ApproveResult> {
    return this.admin.approve(requireAdmin(admin).id, id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @CurrentAdmin() admin: AuthenticatedAdmin | undefined,
    @Param('id') id: string,
    @Body() dto: RejectRedemptionDto,
  ): Promise<AdminRedemptionView> {
    return this.admin.reject(requireAdmin(admin).id, id, dto.reason);
  }
}

function requireAdmin(admin: AuthenticatedAdmin | undefined): AuthenticatedAdmin {
  if (!admin) throw new UnauthorizedException();
  return admin;
}
