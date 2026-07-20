import { FraudFlagStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

/** GET /api/admin/fraud-flags?status= */
export class FraudQueryDto {
  @IsOptional()
  @IsEnum(FraudFlagStatus)
  status?: FraudFlagStatus;
}
