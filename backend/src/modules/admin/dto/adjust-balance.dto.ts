import { IsInt, IsString, MaxLength, MinLength, NotEquals } from 'class-validator';

/**
 * POST /api/admin/users/:id/adjust-balance (super_admin). Reason is mandatory
 * (application-enforced, ARCHITECTURE_PLAN §2.5) and lands in the audit row.
 */
export class AdjustBalanceDto {
  /** positive = credit, negative = claw-back; zero is rejected. */
  @IsInt()
  @NotEquals(0)
  amount!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
