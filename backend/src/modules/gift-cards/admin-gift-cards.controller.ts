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
import { CreateGiftCardDto } from './dto/create-gift-card.dto';
import { UpdateGiftCardDto } from './dto/update-gift-card.dto';
import { GiftCardsService, GiftCardView } from './gift-cards.service';

/**
 * Admin gift-card catalog (C1.1). Viewing is open to reviewers; creating /
 * editing is super-admin only (RBAC matrix §2.3 — "offer/config management").
 */
@ApiTags('admin')
@Controller('admin/gift-cards')
@UseGuards(AdminAuthGuard, RolesGuard)
export class AdminGiftCardsController {
  constructor(private readonly giftCards: GiftCardsService) {}

  @Get()
  list(): Promise<GiftCardView[]> {
    return this.giftCards.listAll();
  }

  @Post()
  @Roles(AdminRole.super_admin)
  create(
    @CurrentAdmin() admin: AuthenticatedAdmin | undefined,
    @Body() dto: CreateGiftCardDto,
  ): Promise<GiftCardView> {
    return this.giftCards.create(requireAdmin(admin).id, {
      brand: dto.brand,
      denomination: dto.denomination,
      coinCost: dto.coin_cost,
      isActive: dto.is_active,
    });
  }

  @Patch(':id')
  @Roles(AdminRole.super_admin)
  update(
    @CurrentAdmin() admin: AuthenticatedAdmin | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateGiftCardDto,
  ): Promise<GiftCardView> {
    return this.giftCards.update(requireAdmin(admin).id, id, {
      coinCost: dto.coin_cost,
      isActive: dto.is_active,
    });
  }
}

function requireAdmin(admin: AuthenticatedAdmin | undefined): AuthenticatedAdmin {
  if (!admin) throw new UnauthorizedException();
  return admin;
}
