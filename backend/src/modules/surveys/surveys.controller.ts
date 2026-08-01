import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../../common/auth';
import { OfferwallRegistryService } from '../../providers/offerwall/offerwall-registry.service';

/**
 * Survey/offer WALL entry points (wall-style networks like CPX). The app asks
 * for its personalised wall URL and opens it in a webview; completions are
 * credited via the offerwall postback pipeline. The secure hash stays
 * server-side — never shipped to the client.
 */
@ApiTags('surveys')
@Controller('surveys')
@UseGuards(JwtAuthGuard)
export class SurveysController {
  constructor(private readonly registry: OfferwallRegistryService) {}

  @Get('cpx')
  @ApiOkResponse({ description: 'CPX survey-wall URL for the signed-in user (or unavailable).' })
  cpx(@CurrentUser() user: AuthenticatedUser): { available: boolean; url: string | null } {
    const adapter = this.registry.resolve('cpx');
    const url = adapter?.buildWallUrl ? adapter.buildWallUrl(user.id) : null;
    return { available: url != null, url };
  }
}
