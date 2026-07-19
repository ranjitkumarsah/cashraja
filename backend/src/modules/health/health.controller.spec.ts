import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('healthz always reports ok', () => {
    const controller = new HealthController({ ping: jest.fn() } as unknown as PrismaService);
    expect(controller.healthz()).toEqual({ status: 'ok' });
  });

  it('readyz reports ready when the database ping succeeds', async () => {
    const prisma = { ping: jest.fn().mockResolvedValue(undefined) };
    const controller = new HealthController(prisma as unknown as PrismaService);
    await expect(controller.readyz()).resolves.toEqual({
      status: 'ready',
      checks: { database: 'ok' },
    });
  });

  it('readyz throws 503 when the database is unreachable', async () => {
    const prisma = { ping: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) };
    const controller = new HealthController(prisma as unknown as PrismaService);
    await expect(controller.readyz()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
