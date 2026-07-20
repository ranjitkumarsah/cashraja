import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OfferwallRegistryService } from '../../providers/offerwall/offerwall-registry.service';
import { FakePhaseBPrisma } from '../postbacks/testing/fake-phase-b-prisma';
import { OFFER_LAUNCH_AUDIENCE, OffersService } from './offers.service';

const ACCESS_SECRET = 'unit-test-access-secret';

function build(networks = 'mock'): { prisma: FakePhaseBPrisma; service: OffersService } {
  const prisma = new FakePhaseBPrisma();
  const config = {
    get: (key: string) =>
      ({
        OFFERWALL_NETWORKS: networks,
        MOCK_OFFERWALL_SECRET: 'secret-12345',
        JWT_ACCESS_SECRET: ACCESS_SECRET,
      })[key],
  } as unknown as ConfigService;
  const registry = new OfferwallRegistryService(config);
  const service = new OffersService(
    prisma as unknown as PrismaService,
    registry,
    new JwtService({}),
    config,
  );
  return { prisma, service };
}

describe('OffersService', () => {
  describe('eligibility filtering (GET /api/offers)', () => {
    it('returns active enabled-network offers, highest reward first', async () => {
      const { prisma, service } = build();
      const userId = prisma.addUser();
      prisma.addOffer({ externalOfferId: 'a', coinReward: 100 });
      prisma.addOffer({ externalOfferId: 'b', coinReward: 500 });
      prisma.addOffer({ externalOfferId: 'inactive', coinReward: 900, isActive: false });
      prisma.addOffer({ externalOfferId: 'other-net', network: 'adjoe', coinReward: 800 });

      const offers = await service.listForUser(userId);

      expect(offers.map((o) => o.coin_reward)).toEqual([500, 100]);
      expect(offers[0]).toMatchObject({ network: 'mock', title: 'b' });
    });

    it('excludes offers the user already completed (pending or credited) but keeps rejected ones retryable', async () => {
      const { prisma, service } = build();
      const userId = prisma.addUser();
      const pending = prisma.addOffer({ externalOfferId: 'p' });
      const credited = prisma.addOffer({ externalOfferId: 'c' });
      const rejected = prisma.addOffer({ externalOfferId: 'r' });
      prisma.addCompletion({ userId, offerId: pending.id, status: 'pending' });
      prisma.addCompletion({ userId, offerId: credited.id, externalTxnId: 'x2', status: 'credited' });
      prisma.addCompletion({ userId, offerId: rejected.id, externalTxnId: 'x3', status: 'rejected' });

      const offers = await service.listForUser(userId);
      expect(offers.map((o) => o.id)).toEqual([rejected.id]);
    });

    it("another user's completions do not affect eligibility", async () => {
      const { prisma, service } = build();
      const userId = prisma.addUser();
      const otherId = prisma.addUser();
      const offer = prisma.addOffer({ externalOfferId: 'o' });
      prisma.addCompletion({ userId: otherId, offerId: offer.id, status: 'credited' });

      const offers = await service.listForUser(userId);
      expect(offers).toHaveLength(1);
    });

    it('country requirement: matching GEO passes, mismatched GEO and unknown GEO are excluded', async () => {
      const { prisma, service } = build();
      const indian = prisma.addUser(undefined, 'IN');
      const american = prisma.addUser(undefined, 'US');
      const unknownGeo = prisma.addUser(undefined, null);
      prisma.addOffer({ externalOfferId: 'geo', requirements: { countries: ['in'] } });
      prisma.addOffer({ externalOfferId: 'open', requirements: { min_android: 12 } });

      expect((await service.listForUser(indian)).map((o) => o.title).sort()).toEqual([
        'geo',
        'open',
      ]);
      expect((await service.listForUser(american)).map((o) => o.title)).toEqual(['open']);
      expect((await service.listForUser(unknownGeo)).map((o) => o.title)).toEqual(['open']);
    });

    it('returns [] when no networks are enabled', async () => {
      const { prisma, service } = build(' ');
      const userId = prisma.addUser();
      prisma.addOffer({ externalOfferId: 'a' });
      await expect(service.listForUser(userId)).resolves.toEqual([]);
    });
  });

  describe('POST /api/offers/:id/launch', () => {
    it('returns the adapter launch URL embedding user id and a signed short-lived token', async () => {
      const { prisma, service } = build();
      const userId = prisma.addUser();
      const offer = prisma.addOffer({ externalOfferId: 'mock-1' });

      const result = await service.launch(userId, offer.id);
      const url = new URL(result.launch_url);
      expect(url.searchParams.get('user')).toBe(userId);
      expect(url.searchParams.get('offer')).toBe('mock-1');
      expect(result.expires_in_seconds).toBe(15 * 60);

      const token = url.searchParams.get('token');
      expect(token).toBeTruthy();
      const payload = await new JwtService({}).verifyAsync<{
        sub: string;
        offer_id: string;
        network: string;
        exp: number;
        iat: number;
      }>(token as string, { secret: ACCESS_SECRET, audience: OFFER_LAUNCH_AUDIENCE });
      expect(payload.sub).toBe(userId);
      expect(payload.offer_id).toBe(offer.id);
      expect(payload.network).toBe('mock');
      expect(payload.exp - payload.iat).toBe(15 * 60);
    });

    it('launch tokens are NOT valid as app access tokens (audience separation)', async () => {
      const { prisma, service } = build();
      const userId = prisma.addUser();
      const offer = prisma.addOffer({ externalOfferId: 'mock-1' });
      const result = await service.launch(userId, offer.id);
      const token = new URL(result.launch_url).searchParams.get('token') as string;

      await expect(
        new JwtService({}).verifyAsync(token, { secret: ACCESS_SECRET, audience: 'app' }),
      ).rejects.toThrow();
    });

    it('404s on unknown, malformed, inactive, and disabled-network offers', async () => {
      const { prisma, service } = build();
      const userId = prisma.addUser();
      const inactive = prisma.addOffer({ externalOfferId: 'x', isActive: false });
      const disabledNet = prisma.addOffer({ externalOfferId: 'y', network: 'adjoe' });

      await expect(
        service.launch(userId, '00000000-0000-4000-8000-000000000000'),
      ).rejects.toThrow(NotFoundException);
      await expect(service.launch(userId, 'not-a-uuid')).rejects.toThrow(NotFoundException);
      await expect(service.launch(userId, inactive.id)).rejects.toThrow(NotFoundException);
      await expect(service.launch(userId, disabledNet.id)).rejects.toThrow(NotFoundException);
    });
  });
});
