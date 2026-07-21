import { IsEnum } from 'class-validator';

/** Game difficulty tiers (TRD §3.3 / PRD §6.2). */
export enum GameDifficulty {
  easy = 'easy',
  medium = 'medium',
  hard = 'hard',
}

/** POST /api/game/round-start — client picks a difficulty; the server issues the round. */
export class RoundStartDto {
  @IsEnum(GameDifficulty)
  difficulty!: GameDifficulty;
}
