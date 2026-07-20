import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth';
import { GiftCardsService, GiftCardView } from './gift-cards.service';

/** TRD §3.8 — public gift-card catalog (JWT, active cards only). */
@Controller('gift-cards')
@UseGuards(JwtAuthGuard)
export class GiftCardsController {
  constructor(private readonly giftCards: GiftCardsService) {}

  @Get()
  list(): Promise<GiftCardView[]> {
    return this.giftCards.listActive();
  }
}
