import { Controller, Get, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../../common/auth';
import { MyCodeView, ReferralService, ReferralStatsView } from './referral.service';

/** D4.1 — referral code + stats, JWT-guarded. */
@Controller('referral')
@UseGuards(JwtAuthGuard)
export class ReferralController {
  constructor(private readonly referral: ReferralService) {}

  @Get('my-code')
  myCode(@CurrentUser() user: AuthenticatedUser | undefined): Promise<MyCodeView> {
    return this.referral.myCode(requireUser(user).id);
  }

  @Get('stats')
  stats(@CurrentUser() user: AuthenticatedUser | undefined): Promise<ReferralStatsView> {
    return this.referral.stats(requireUser(user).id);
  }
}

function requireUser(user: AuthenticatedUser | undefined): AuthenticatedUser {
  if (!user) throw new UnauthorizedException();
  return user;
}
