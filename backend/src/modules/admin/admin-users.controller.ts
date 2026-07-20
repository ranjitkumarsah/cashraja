import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
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
  AdminUserDetail,
  AdminUserListItem,
  AdminUserListPage,
  AdminUsersService,
  LedgerPageView,
} from './admin-users.service';
import { AdjustBalanceDto } from './dto/adjust-balance.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { UserQueryDto } from './dto/user-query.dto';

/**
 * C3.1/C3.2 — admin user endpoints. View routes are reviewer-accessible;
 * mutating routes (adjust-balance, ban, unban) are super-admin only (RBAC
 * matrix §2.3), enforced server-side by @Roles + RolesGuard.
 */
@Controller('admin/users')
@UseGuards(AdminAuthGuard, RolesGuard)
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query() query: UserQueryDto): Promise<AdminUserListPage> {
    return this.users.list(
      { status: query.status, search: query.search },
      query.cursor,
      query.limit,
    );
  }

  @Get(':id')
  detail(@Param('id') id: string): Promise<AdminUserDetail> {
    return this.users.detail(id);
  }

  @Get(':id/ledger')
  ledger(@Param('id') id: string, @Query() query: PaginationQueryDto): Promise<LedgerPageView> {
    return this.users.userLedger(id, query.cursor, query.limit);
  }

  @Post(':id/adjust-balance')
  @HttpCode(HttpStatus.OK)
  @Roles(AdminRole.super_admin)
  adjustBalance(
    @CurrentAdmin() admin: AuthenticatedAdmin | undefined,
    @Param('id') id: string,
    @Body() dto: AdjustBalanceDto,
  ): Promise<{ balance_after: number; ledger_id: string }> {
    return this.users.adjustBalance(requireAdmin(admin).id, id, dto.amount, dto.reason);
  }

  @Post(':id/ban')
  @HttpCode(HttpStatus.OK)
  @Roles(AdminRole.super_admin)
  ban(
    @CurrentAdmin() admin: AuthenticatedAdmin | undefined,
    @Param('id') id: string,
    @Body() dto: BanUserDto,
  ): Promise<AdminUserListItem> {
    return this.users.setBanned(requireAdmin(admin).id, id, true, dto.reason);
  }

  @Post(':id/unban')
  @HttpCode(HttpStatus.OK)
  @Roles(AdminRole.super_admin)
  unban(
    @CurrentAdmin() admin: AuthenticatedAdmin | undefined,
    @Param('id') id: string,
    @Body() dto: BanUserDto,
  ): Promise<AdminUserListItem> {
    return this.users.setBanned(requireAdmin(admin).id, id, false, dto.reason);
  }
}

function requireAdmin(admin: AuthenticatedAdmin | undefined): AuthenticatedAdmin {
  if (!admin) throw new UnauthorizedException();
  return admin;
}
