import { IsInt, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

/** Body for PATCH /admin/inventory/:id — edit an unused code's value and/or code. */
export class InventoryUpdateDto {
  /** New denomination (₹ value). Omit to keep the current one. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  denomination?: number;

  /** New plaintext code. Omit to keep the current one. */
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(512)
  code?: string;
}
