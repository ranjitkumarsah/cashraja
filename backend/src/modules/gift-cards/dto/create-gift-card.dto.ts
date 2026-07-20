import { GiftCardBrand } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';

/** POST /api/admin/gift-cards (super_admin) — catalog entry. */
export class CreateGiftCardDto {
  @IsEnum(GiftCardBrand)
  brand!: GiftCardBrand;

  @IsInt()
  @Min(1)
  denomination!: number;

  @IsInt()
  @Min(1)
  coin_cost!: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
