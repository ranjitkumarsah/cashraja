import { IsOptional, IsString, MaxLength } from 'class-validator';

/** POST /api/admin/users/:id/ban — optional reason for the audit trail. */
export class BanUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
