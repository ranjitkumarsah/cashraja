import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../../common/auth';
import { PlaytimeCallback, PlaytimeService } from './playtime.service';

/**
 * PlaytimeAds offerwall endpoints:
 *  - GET/POST /api/playtime/callback — public S2S postback (verified by SHA1
 *    signature, NOT JWT). Set this URL in the PlaytimeAds dashboard.
 *  - GET /api/playtime/config — whether Playtime is enabled + the SDK app key
 *    the app inits the native offerwall with.
 */
@ApiTags('playtime')
@Controller('playtime')
export class PlaytimeController {
  constructor(private readonly playtime: PlaytimeService) {}

  @Get('callback')
  async callbackGet(@Query() q: Record<string, string>): Promise<string> {
    return this.handle(q);
  }

  @Post('callback')
  async callbackPost(@Query() q: Record<string, string>): Promise<string> {
    return this.handle(q);
  }

  private async handle(q: Record<string, string>): Promise<string> {
    const cb: PlaytimeCallback = {
      userId: q.user_id ?? '',
      offerId: q.offer_id ?? '',
      amount: q.amount ?? '',
      signature: q.signature ?? '',
      taskId: q.task_id,
      offerName: q.offer_name,
    };
    // Reject forgeries — only a valid SHA1 signature (against a configured
    // secret) is credited. A 403 keeps fake completions out of the ledger.
    if (!this.playtime.verifySignature(cb)) {
      throw new ForbiddenException('invalid signature');
    }
    // Credit is idempotent; unknown-user / bad-amount are acked (nothing to do)
    // so PlaytimeAds doesn't retry a permanently-unprocessable postback.
    await this.playtime.credit(cb);
    return 'OK';
  }

  @Get('config')
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'Whether Playtime is enabled + the SDK app key.' })
  config(@CurrentUser() _user: AuthenticatedUser): { available: boolean; appKey: string | null } {
    const appKey = this.playtime.androidAppKey();
    return { available: appKey != null, appKey };
  }

  @Get('web-wall')
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'Hosted web offerwall URL for the signed-in user.' })
  webWall(@CurrentUser() user: AuthenticatedUser): { available: boolean; url: string | null } {
    const url = this.playtime.webWallUrl(user.id);
    return { available: url != null, url };
  }
}
