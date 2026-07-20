import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** POST /api/admin/fraud-flags/:id/resolve — reviewer's disposition. */
export class ResolveFraudDto {
  /** what the reviewer decided; drives any follow-on (ban handled separately). */
  @IsIn(['dismiss', 'ban_user', 'confirm'])
  action!: 'dismiss' | 'ban_user' | 'confirm';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
