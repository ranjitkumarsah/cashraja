import { Body, Controller, Get, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../../common/auth';
import { CreateRedemptionDto } from './dto/create-redemption.dto';
import { RedemptionsService, RedemptionView } from './redemptions.service';

/**
 * TRD §3.8 — user redemption endpoints (JWT). /redemptions is money-critical,
 * so it carries a stricter throttle than the generous global default
 * (ARCHITECTURE_PLAN §2.5).
 */
@Controller('redemptions')
@UseGuards(JwtAuthGuard)
export class RedemptionsController {
  constructor(private readonly redemptions: RedemptionsService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() dto: CreateRedemptionDto,
  ): Promise<RedemptionView> {
    return this.redemptions.create(requireUser(user).id, dto.gift_card_id);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthenticatedUser | undefined): Promise<RedemptionView[]> {
    return this.redemptions.mine(requireUser(user).id);
  }
}

function requireUser(user: AuthenticatedUser | undefined): AuthenticatedUser {
  if (!user) throw new UnauthorizedException();
  return user;
}
