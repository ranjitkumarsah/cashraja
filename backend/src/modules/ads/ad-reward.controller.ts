import { Controller, Get, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../../common/auth';
import { AdRewardResult, AdRewardService, AdRewardState } from './ad-reward.service';

/**
 * G7 — client-gated rewarded-ad credit (the "Watch & earn" flow). JWT-guarded.
 * The app calls `reward` only after the AdMob SDK fires onUserEarnedReward;
 * the daily cap + cooldown are enforced server-side for integrity.
 */
@ApiTags('ads')
@Controller('ads')
@UseGuards(JwtAuthGuard)
export class AdRewardController {
  constructor(private readonly adReward: AdRewardService) {}

  @Get('reward-state')
  state(@CurrentUser() user: AuthenticatedUser | undefined): Promise<AdRewardState> {
    return this.adReward.getState(requireUser(user).id);
  }

  @Post('reward')
  reward(@CurrentUser() user: AuthenticatedUser | undefined): Promise<AdRewardResult> {
    return this.adReward.claimReward(requireUser(user).id);
  }
}

function requireUser(user: AuthenticatedUser | undefined): AuthenticatedUser {
  if (!user) throw new UnauthorizedException();
  return user;
}
