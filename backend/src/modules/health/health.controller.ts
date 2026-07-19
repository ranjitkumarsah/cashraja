import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: process is up and the event loop responds. */
  @Get('healthz')
  healthz(): { status: string } {
    return { status: 'ok' };
  }

  /** Readiness: dependencies reachable (database ping). */
  @Get('readyz')
  async readyz(): Promise<{ status: string; checks: Record<string, string> }> {
    try {
      await this.prisma.ping();
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        checks: { database: 'unreachable' },
      });
    }
    return { status: 'ready', checks: { database: 'ok' } };
  }
}
