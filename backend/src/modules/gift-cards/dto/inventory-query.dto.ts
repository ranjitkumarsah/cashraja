import { Type } from 'class-transformer';
import { GiftCardBrand, InventoryStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

/** GET /api/admin/inventory?brand=&denomination=&status= — stock browser. */
export class InventoryQueryDto {
  @IsOptional()
  @IsEnum(GiftCardBrand)
  brand?: GiftCardBrand;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  denomination?: number;

  @IsOptional()
  @IsEnum(InventoryStatus)
  status?: InventoryStatus;
}
