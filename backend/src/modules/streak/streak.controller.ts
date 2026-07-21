import { Controller, Get, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../../common/auth';
import { StreakClaimResult, StreakService, StreakStateView } from './streak.service';

/** D2 — daily streak state + claim, JWT-guarded. */
@Controller('streak')
@UseGuards(JwtAuthGuard)
export class StreakController {
  constructor(private readonly streak: StreakService) {}

  @Get()
  state(@CurrentUser() user: AuthenticatedUser | undefined): Promise<StreakStateView> {
    return this.streak.getState(requireUser(user).id);
  }

  @Post('claim')
  claim(@CurrentUser() user: AuthenticatedUser | undefined): Promise<StreakClaimResult> {
    return this.streak.claim(requireUser(user).id);
  }
}

function requireUser(user: AuthenticatedUser | undefined): AuthenticatedUser {
  if (!user) throw new UnauthorizedException();
  return user;
}
