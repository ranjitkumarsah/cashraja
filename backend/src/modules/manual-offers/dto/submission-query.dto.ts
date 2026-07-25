import { ManualOfferSubmissionStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

/** GET /api/admin/manual-offer-submissions?status= */
export class SubmissionQueryDto {
  @IsOptional()
  @IsEnum(ManualOfferSubmissionStatus)
  status?: ManualOfferSubmissionStatus;
}
