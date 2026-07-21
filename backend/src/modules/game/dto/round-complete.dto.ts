import { IsInt, IsUUID, Min } from 'class-validator';

/**
 * POST /api/game/round-complete. `client_score` is accepted but NEVER trusted
 * for coin amounts (server-authoritative rewards come from app_config); it is
 * validated for shape and kept for analytics / anti-cheat only.
 */
export class RoundCompleteDto {
  @IsUUID()
  round_id!: string;

  @IsInt()
  @Min(0)
  client_score!: number;
}
