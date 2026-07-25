import { Controller, Get, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../../common/auth';
import {
  MyCodeView,
  ReferralBreakdownView,
  ReferralService,
  ReferralStatsView,
} from './referral.service';

/** D4.1 — referral code + stats, JWT-guarded. */
@ApiTags('referral')
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

  @Get('breakdown')
  breakdown(@CurrentUser() user: AuthenticatedUser | undefined): Promise<ReferralBreakdownView> {
    return this.referral.breakdown(requireUser(user).id);
  }
}

function requireUser(user: AuthenticatedUser | undefined): AuthenticatedUser {
  if (!user) throw new UnauthorizedException();
  return user;
}
