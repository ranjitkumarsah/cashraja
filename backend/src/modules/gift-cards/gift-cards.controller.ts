import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/auth';
import { GiftCardsService, GiftCardView } from './gift-cards.service';

/** TRD §3.8 — public gift-card catalog (JWT, active cards only). */
@ApiTags('gift-cards')
@Controller('gift-cards')
@UseGuards(JwtAuthGuard)
export class GiftCardsController {
  constructor(private readonly giftCards: GiftCardsService) {}

  @Get()
  list(): Promise<GiftCardView[]> {
    return this.giftCards.listActive();
  }
}
