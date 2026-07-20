import { Type } from 'class-transformer';
import { UserStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** GET /api/admin/users?status=&search=&cursor=&limit= */
export class UserQueryDto {
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  /** matches email or display name (case-insensitive contains). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
