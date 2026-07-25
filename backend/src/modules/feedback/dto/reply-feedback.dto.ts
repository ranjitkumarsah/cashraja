import { IsString, MaxLength, MinLength } from 'class-validator';

/** POST /api/admin/feedback/:id/reply — an admin's reply to a submission. */
export class ReplyFeedbackDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reply!: string;
}
