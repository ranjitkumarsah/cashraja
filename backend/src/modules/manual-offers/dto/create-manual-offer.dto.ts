import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

/** POST /api/admin/manual-offers (super_admin) — author a manual offer. */
export class CreateManualOfferDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  description!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  instructions!: string;

  @IsInt()
  @Min(1)
  coin_reward!: number;
}
