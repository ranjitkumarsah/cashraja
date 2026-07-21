import { ApiTags } from '@nestjs/swagger';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { AdSsvRegistryService } from '../../providers/ad-ssv/ad-ssv-registry.service';
import { AdIntakeResult, AdIntakeService } from './ad-intake.service';
import { toPostbackRequest } from './offerwall-webhook.controller';

/**
 * TRD §3.6 — POST /api/webhooks/ads/:network (server-side verification
 * callbacks from ad-network backends, never the client). Same shape as the
 * offerwall webhook: resolve adapter (404) → verifyCallback (401) → record
 * impression → cap check → enqueue credit → 200 fast. GET accepted because
 * AdMob/AppLovin/LevelPlay SSV callbacks are GETs.
 */
@SkipThrottle()
@ApiTags('webhooks')
@Controller('webhooks/ads')
export class AdsWebhookController {
  constructor(
    private readonly registry: AdSsvRegistryService,
    private readonly intake: AdIntakeService,
  ) {}

  @Post(':network')
  @HttpCode(HttpStatus.OK)
  handlePost(
    @Param('network') network: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<AdIntakeResult> {
    return this.handle(network, req);
  }

  @Get(':network')
  @HttpCode(HttpStatus.OK)
  handleGet(
    @Param('network') network: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<AdIntakeResult> {
    return this.handle(network, req);
  }

  private async handle(network: string, req: RawBodyRequest<Request>): Promise<AdIntakeResult> {
    const adapter = this.registry.resolve(network);
    if (!adapter) {
      throw new NotFoundException(`Unknown or disabled ad network "${network}"`);
    }

    const reward = await adapter.verifyCallback(toPostbackRequest(req));
    if (!reward) {
      throw new UnauthorizedException('SSV verification failed');
    }

    return this.intake.intakeAdReward(adapter.dbNetwork, reward);
  }
}
