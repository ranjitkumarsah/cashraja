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

  // Markdown-authored instructions (H7): links, bold, code, lists. Higher cap
  // than plain description since formatted content (URLs, list markup) is longer.
  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  instructions!: string;

  @IsInt()
  @Min(1)
  coin_reward!: number;
}
