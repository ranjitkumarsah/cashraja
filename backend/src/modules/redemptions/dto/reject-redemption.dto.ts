import { IsString, MaxLength, MinLength } from 'class-validator';

/** POST /api/admin/redemptions/:id/reject — reason is mandatory (audited). */
export class RejectRedemptionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
