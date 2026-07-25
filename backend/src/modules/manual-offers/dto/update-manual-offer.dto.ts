import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

/** PATCH /api/admin/manual-offers/:id (super_admin) — edit / enable-disable. */
export class UpdateManualOfferDto {
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  instructions?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  coin_reward?: number;
}
