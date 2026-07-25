import { Body, Controller, Get, Param, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../../common/auth';
import { SubmitProofDto } from './dto/submit-proof.dto';
import {
  ManualOfferView,
  ManualOffersService,
  MyManualOfferSubmissionView,
} from './manual-offers.service';

/** H5 — user manual-offers surface: list active, submit proof, read own. */
@ApiTags('manual-offers')
@Controller('manual-offers')
@UseGuards(JwtAuthGuard)
export class ManualOffersController {
  constructor(private readonly offers: ManualOffersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser | undefined): Promise<ManualOfferView[]> {
    return this.offers.listForUser(requireUser(user).id);
  }

  @Get('mine')
  mine(
    @CurrentUser() user: AuthenticatedUser | undefined,
  ): Promise<MyManualOfferSubmissionView[]> {
    return this.offers.listMine(requireUser(user).id);
  }

  @Post(':id/submit')
  submit(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') offerId: string,
    @Body() dto: SubmitProofDto,
  ): Promise<MyManualOfferSubmissionView> {
    return this.offers.submit(requireUser(user).id, offerId, dto.proof_text);
  }
}

function requireUser(user: AuthenticatedUser | undefined): AuthenticatedUser {
  if (!user) throw new UnauthorizedException();
  return user;
}
