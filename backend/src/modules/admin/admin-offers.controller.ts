import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
  AdminOffersService,
  AdminOfferView,
  PostbackLogPage,
} from './admin-offers.service';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';

/** C3.4 — offer management. List + logs are reviewer-viewable; edits super-admin. */
@Controller('admin')
@UseGuards(AdminAuthGuard, RolesGuard)
export class AdminOffersController {
  constructor(private readonly offers: AdminOffersService) {}

  @Get('offers')
  list(): Promise<AdminOfferView[]> {
    return this.offers.list();
  }

  @Patch('offers/:id')
  @Roles(AdminRole.super_admin)
  update(
    @CurrentAdmin() admin: AuthenticatedAdmin | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateOfferDto,
  ): Promise<AdminOfferView> {
    return this.offers.update(requireAdmin(admin).id, id, {
      isActive: dto.is_active,
      coinReward: dto.coin_reward,
    });
  }

  @Get('postback-logs')
  postbackLogs(@Query() query: PaginationQueryDto): Promise<PostbackLogPage> {
    return this.offers.postbackLogs(query.cursor, query.limit);
  }
}

function requireAdmin(admin: AuthenticatedAdmin | undefined): AuthenticatedAdmin {
  if (!admin) throw new UnauthorizedException();
  return admin;
}
