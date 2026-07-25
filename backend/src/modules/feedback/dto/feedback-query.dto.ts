import { FeedbackStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

/** GET /api/admin/feedback?status= */
export class FeedbackQueryDto {
  @IsOptional()
  @IsEnum(FeedbackStatus)
  status?: FeedbackStatus;
}
