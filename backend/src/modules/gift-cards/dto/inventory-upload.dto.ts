import { GiftCardBrand } from '@prisma/client';
import { IsEnum, IsInt, IsString, Min, MinLength } from 'class-validator';

/**
 * POST /api/admin/inventory (super_admin). `codes` is raw pasted text: one code
 * per line, or comma/whitespace separated (CSV export from a supplier pastes
 * cleanly). The service splits, trims, de-dupes and AES-256-GCM encrypts each.
 */
export class InventoryUploadDto {
  @IsEnum(GiftCardBrand)
  brand!: GiftCardBrand;

  @IsInt()
  @Min(1)
  denomination!: number;

  @IsString()
  @MinLength(1)
  codes!: string;
}
