import { IsString, MaxLength, MinLength } from 'class-validator';

/** POST /api/admin/manual-offer-submissions/:id/reject — reason is mandatory. */
export class RejectSubmissionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
