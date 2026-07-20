import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

/** PATCH /api/admin/gift-cards/:id (super_admin) — edit cost / toggle active. */
export class UpdateGiftCardDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  coin_cost?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
