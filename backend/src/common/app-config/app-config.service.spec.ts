import { PrismaService } from '../prisma/prisma.service';
import { FakePhaseBPrisma } from '../../modules/postbacks/testing/fake-phase-b-prisma';
import { AppConfigService } from './app-config.service';

describe('AppConfigService', () => {
  let prisma: FakePhaseBPrisma;
  let service: AppConfigService;

  beforeEach(() => {
    prisma = new FakePhaseBPrisma();
    service = new AppConfigService(prisma as unknown as PrismaService);
  });

  it('falls back when the key or field is missing', async () => {
    await expect(service.getNumber('nope.key', 'days', 30)).resolves.toBe(30);
    prisma.setConfig('x', { other: 1 });
    await expect(service.getNumber('x', 'days', 7)).resolves.toBe(7);
    prisma.setConfig('y', { days: 'ten' });
    await expect(service.getNumber('y', 'days', 5)).resolves.toBe(5);
  });

  it('reads the field and honors the highest version (versioned writes)', async () => {
    prisma.setConfig('ads.daily_reward_cap', { views: 20 }, 1);
    prisma.setConfig('ads.daily_reward_cap', { views: 8 }, 3);
    prisma.setConfig('ads.daily_reward_cap', { views: 12 }, 2);
    await expect(service.getNumber('ads.daily_reward_cap', 'views', 99)).resolves.toBe(8);
  });

  it('caches reads until clearCache()', async () => {
    prisma.setConfig('k', { n: 1 });
    await expect(service.getNumber('k', 'n', 0)).resolves.toBe(1);
    prisma.setConfig('k', { n: 2 }, 2);
    await expect(service.getNumber('k', 'n', 0)).resolves.toBe(1); // cached
    service.clearCache();
    await expect(service.getNumber('k', 'n', 0)).resolves.toBe(2);
  });
});
