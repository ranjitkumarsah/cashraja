import { Type } from 'class-transformer';
import { RedemptionStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** GET /api/admin/redemptions?status=&cursor=&limit= — review queue. */
export class RedemptionQueryDto {
  @IsOptional()
  @IsEnum(RedemptionStatus)
  status?: RedemptionStatus;

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
