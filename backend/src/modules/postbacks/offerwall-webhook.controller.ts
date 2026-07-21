import { ApiTags } from '@nestjs/swagger';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import {
  CanonicalPostback,
  PostbackParseError,
  PostbackRequest,
} from '../../providers/offerwall/offerwall-adapter';
import { OfferwallRegistryService } from '../../providers/offerwall/offerwall-registry.service';
import { IntakeResult, PostbackIntakeService } from './postback-intake.service';

/**
 * TRD §3.5 — POST /api/webhooks/offerwall/:network (public webhook,
 * HMAC-verified, NOT JWT'd). GET is also accepted because most production
 * offerwalls (adjoe/adgate/offertoro/cpx) deliver postbacks as GETs with
 * query macros.
 *
 * Throttling is skipped: authenticity comes from the signature, and networks
 * retry in bursts — rate-limiting them would only cause retry storms.
 * Order of checks: resolve adapter (404) → verify signature (401) → parse →
 * persist+enqueue → 200 fast (no heavy work inline; NFR §9 budget 500ms).
 */
@SkipThrottle()
@ApiTags('webhooks')
@Controller('webhooks/offerwall')
export class OfferwallWebhookController {
  private readonly logger = new Logger(OfferwallWebhookController.name);

  constructor(
    private readonly registry: OfferwallRegistryService,
    private readonly intake: PostbackIntakeService,
  ) {}

  @Post(':network')
  @HttpCode(HttpStatus.OK)
  handlePost(
    @Param('network') network: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<IntakeResult> {
    return this.handle(network, req);
  }

  @Get(':network')
  @HttpCode(HttpStatus.OK)
  handleGet(
    @Param('network') network: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<IntakeResult> {
    return this.handle(network, req);
  }

  private async handle(network: string, req: RawBodyRequest<Request>): Promise<IntakeResult> {
    const adapter = this.registry.resolve(network);
    if (!adapter) {
      throw new NotFoundException(`Unknown or disabled offerwall network "${network}"`);
    }

    const postbackReq = toPostbackRequest(req);
    if (!adapter.verifySignature(postbackReq)) {
      throw new UnauthorizedException('Invalid postback signature');
    }

    let canonical: CanonicalPostback;
    try {
      canonical = adapter.parsePostback(postbackReq);
    } catch (err) {
      if (err instanceof PostbackParseError) {
        // Signed but malformed: a permanent condition on our/our-partner's
        // config — 200 stops the retry storm, the log keeps the evidence.
        this.logger.error(err.message);
        return { status: 'rejected', reason: 'unparseable' };
      }
      throw err;
    }

    return this.intake.intakeOffer(adapter.network, canonical);
  }
}

/** Express request → adapter-facing shape (raw bytes + parsed views). */
export function toPostbackRequest(req: RawBodyRequest<Request>): PostbackRequest {
  return {
    rawBody: req.rawBody ?? Buffer.alloc(0),
    body: isRecord(req.body) ? req.body : {},
    headers: req.headers,
    query: req.query as Record<string, string | string[] | undefined>,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
