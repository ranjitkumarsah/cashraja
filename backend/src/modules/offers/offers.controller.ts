import { Controller, Get, Param, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../../common/auth';
import { LaunchResult, OfferListItem, OffersService } from './offers.service';

/** TRD §3.4 — offers list + signed launch, JWT-guarded. */
@Controller('offers')
@UseGuards(JwtAuthGuard)
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser | undefined): Promise<OfferListItem[]> {
    return this.offers.listForUser(requireUser(user).id);
  }

  @Post(':id/launch')
  launch(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') offerId: string,
  ): Promise<LaunchResult> {
    return this.offers.launch(requireUser(user).id, offerId);
  }
}

function requireUser(user: AuthenticatedUser | undefined): AuthenticatedUser {
  if (!user) throw new UnauthorizedException();
  return user;
}
