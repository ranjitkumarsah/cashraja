import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

/** PATCH /api/admin/offers/:id (super_admin) — toggle active / edit reward. */
export class UpdateOfferDto {
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  coin_reward?: number;
}
