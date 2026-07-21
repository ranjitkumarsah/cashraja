import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
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
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { InventoryUploadDto } from './dto/inventory-upload.dto';
import {
  InventoryItemView,
  InventoryService,
  InventoryUploadResult,
  StockLevel,
} from './inventory.service';

/**
 * Gift-card inventory management (C1.2–C1.4). Every route is super-admin only
 * (RBAC matrix §2.3 — "gift-card inventory upload / reveal codes"). Codes are
 * masked everywhere except the audited reveal endpoint.
 */
@ApiTags('admin')
@Controller('admin/inventory')
@UseGuards(AdminAuthGuard, RolesGuard)
@Roles(AdminRole.super_admin)
export class AdminInventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Post()
  upload(
    @CurrentAdmin() admin: AuthenticatedAdmin | undefined,
    @Body() dto: InventoryUploadDto,
  ): Promise<InventoryUploadResult> {
    return this.inventory.upload(requireAdmin(admin).id, dto.brand, dto.denomination, dto.codes);
  }

  @Get()
  list(@Query() query: InventoryQueryDto): Promise<InventoryItemView[]> {
    return this.inventory.list({
      brand: query.brand,
      denomination: query.denomination,
      status: query.status,
    });
  }

  @Get('stock-levels')
  stockLevels(): Promise<StockLevel[]> {
    return this.inventory.stockLevels();
  }

  @Get(':id/reveal')
  reveal(
    @CurrentAdmin() admin: AuthenticatedAdmin | undefined,
    @Param('id') id: string,
  ): Promise<{ code: string; status: string }> {
    return this.inventory.reveal(requireAdmin(admin).id, id);
  }
}

function requireAdmin(admin: AuthenticatedAdmin | undefined): AuthenticatedAdmin {
  if (!admin) throw new UnauthorizedException();
  return admin;
}
