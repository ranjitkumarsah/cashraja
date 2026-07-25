import { Body, Controller, Get, Param, Patch, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import {
  AdminAuthGuard,
  AuthenticatedAdmin,
  CurrentAdmin,
  Roles,
  RolesGuard,
} from '../../common/auth';
import { AdminManualOffersService, AdminManualOfferView } from './admin-manual-offers.service';
import { CreateManualOfferDto } from './dto/create-manual-offer.dto';
import { UpdateManualOfferDto } from './dto/update-manual-offer.dto';

/** H5 — manual-offer management. Listing is admin-viewable; mutations super-admin. */
@ApiTags('admin')
@Controller('admin/manual-offers')
@UseGuards(AdminAuthGuard, RolesGuard)
export class AdminManualOffersController {
  constructor(private readonly offers: AdminManualOffersService) {}

  @Get()
  list(): Promise<AdminManualOfferView[]> {
    return this.offers.list();
  }

  @Post()
  @Roles(AdminRole.super_admin)
  create(
    @CurrentAdmin() admin: AuthenticatedAdmin | undefined,
    @Body() dto: CreateManualOfferDto,
  ): Promise<AdminManualOfferView> {
    return this.offers.create(requireAdmin(admin).id, {
      title: dto.title,
      description: dto.description,
      instructions: dto.instructions,
      coinReward: dto.coin_reward,
    });
  }

  @Patch(':id')
  @Roles(AdminRole.super_admin)
  update(
    @CurrentAdmin() admin: AuthenticatedAdmin | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateManualOfferDto,
  ): Promise<AdminManualOfferView> {
    return this.offers.update(requireAdmin(admin).id, id, {
      isActive: dto.is_active,
      title: dto.title,
      description: dto.description,
      instructions: dto.instructions,
      coinReward: dto.coin_reward,
    });
  }
}

function requireAdmin(admin: AuthenticatedAdmin | undefined): AuthenticatedAdmin {
  if (!admin) throw new UnauthorizedException();
  return admin;
}
