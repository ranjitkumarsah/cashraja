import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OfferCompletionStatus, OfferNetwork, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OfferwallRegistryService } from '../../providers/offerwall/offerwall-registry.service';

/** Audience for short-lived offer-launch tokens (postback matching). */
export const OFFER_LAUNCH_AUDIENCE = 'offer-launch';
export const OFFER_LAUNCH_TTL_SECONDS = 15 * 60;

export interface OfferListItem {
  id: string;
  network: string;
  title: string;
  description: string | null;
  coin_reward: number;
  requirements: unknown;
}

export interface LaunchResult {
  launch_url: string;
  expires_in_seconds: number;
}

/**
 * TRD §3.4. Eligibility filtering happens server-side: only enabled-network
 * active offers, minus offers the user already completed (pending or
 * credited — a rejected completion may be retried), minus offers whose
 * requirements.countries list excludes the user's GEO country.
 */
@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: OfferwallRegistryService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async listForUser(userId: string): Promise<OfferListItem[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { country: true },
    });
    const enabled = this.registry
      .enabledNetworks()
      .filter((n): n is OfferNetwork => (Object.values(OfferNetwork) as string[]).includes(n));
    if (enabled.length === 0) return [];

    const offers = await this.prisma.offer.findMany({
      where: { isActive: true, network: { in: enabled } },
      orderBy: { coinReward: 'desc' },
    });

    const done = await this.prisma.offerCompletion.findMany({
      where: {
        userId,
        offerId: { in: offers.map((o) => o.id) },
        status: { in: [OfferCompletionStatus.pending, OfferCompletionStatus.credited] },
      },
      select: { offerId: true },
    });
    const doneOfferIds = new Set(done.map((c) => c.offerId));

    return offers
      .filter((offer) => !doneOfferIds.has(offer.id))
      .filter((offer) => this.matchesCountry(offer.requirements, user?.country ?? null))
      .map((offer) => ({
        id: offer.id,
        network: offer.network,
        title: offer.title,
        description: offer.description,
        coin_reward: offer.coinReward,
        requirements: offer.requirements,
      }));
  }

  /**
   * TRD §3.4: signed launch token embedding user_id for postback matching.
   * The adapter renders it into the network's webview/SDK launch URL.
   */
  async launch(userId: string, offerId: string): Promise<LaunchResult> {
    const offer = await this.findLaunchableOffer(offerId);
    const adapter = this.registry.resolve(offer.network);
    if (!adapter) {
      throw new NotFoundException('Offer network is not enabled');
    }

    const launchToken = await this.jwt.signAsync(
      { sub: userId, offer_id: offer.id, network: offer.network },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        audience: OFFER_LAUNCH_AUDIENCE,
        expiresIn: OFFER_LAUNCH_TTL_SECONDS,
      },
    );

    const launchUrl = adapter.buildLaunchUrl(
      { id: userId },
      { id: offer.id, externalOfferId: offer.externalOfferId },
      launchToken,
    );

    // Launch log for postback matching / debugging (structured, greppable).
    this.logger.log(
      `offer launch: user=${userId} offer=${offer.id} network=${offer.network} external=${offer.externalOfferId}`,
    );

    return { launch_url: launchUrl, expires_in_seconds: OFFER_LAUNCH_TTL_SECONDS };
  }

  private async findLaunchableOffer(offerId: string): Promise<{
    id: string;
    network: string;
    externalOfferId: string;
  }> {
    let offer: { id: string; network: string; externalOfferId: string; isActive: boolean } | null =
      null;
    try {
      offer = await this.prisma.offer.findUnique({
        where: { id: offerId },
        select: { id: true, network: true, externalOfferId: true, isActive: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        throw new NotFoundException('Offer not found'); // malformed uuid
      }
      throw err;
    }
    if (!offer || !offer.isActive) {
      throw new NotFoundException('Offer not found');
    }
    return offer;
  }

  /** requirements.countries: ["IN", ...] — absent list = open to all GEOs. */
  private matchesCountry(requirements: Prisma.JsonValue | null, country: string | null): boolean {
    if (requirements === null || typeof requirements !== 'object' || Array.isArray(requirements)) {
      return true;
    }
    const countries = (requirements as Record<string, unknown>)['countries'];
    if (!Array.isArray(countries) || countries.length === 0) return true;
    if (country === null) return false; // GEO-restricted offer, unknown user GEO
    return countries.map((c) => String(c).toUpperCase()).includes(country.toUpperCase());
  }
}
