import { Body, Controller, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../../common/auth';
import { RoundCompleteDto } from './dto/round-complete.dto';
import { RoundStartDto } from './dto/round-start.dto';
import { GameService, RoundCompleteResult, RoundStartResult } from './game.service';

/** D1 — server-authoritative game rounds, JWT-guarded. */
@Controller('game')
@UseGuards(JwtAuthGuard)
export class GameController {
  constructor(private readonly game: GameService) {}

  @Post('round-start')
  roundStart(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() body: RoundStartDto,
  ): Promise<RoundStartResult> {
    return this.game.roundStart(requireUser(user).id, body.difficulty);
  }

  @Post('round-complete')
  roundComplete(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() body: RoundCompleteDto,
  ): Promise<RoundCompleteResult> {
    return this.game.roundComplete(requireUser(user).id, body.round_id, body.client_score);
  }
}

function requireUser(user: AuthenticatedUser | undefined): AuthenticatedUser {
  if (!user) throw new UnauthorizedException();
  return user;
}
