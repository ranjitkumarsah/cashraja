import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OfferwallAdapter } from './offerwall-adapter';
import { AdgateAdapter } from './adgate.adapter';
import { AdjoeAdapter } from './adjoe.adapter';
import { CpxAdapter } from './cpx.adapter';
import { MockOfferwallAdapter } from './mock-offerwall.adapter';
import { OffertoroAdapter } from './offertoro.adapter';

/**
 * Env-driven adapter registry: OFFERWALL_NETWORKS (comma list, default
 * "mock") selects which adapters are live. Unknown or disabled networks
 * resolve to undefined → webhook responds 404 and offers from that network
 * are not served.
 */
@Injectable()
export class OfferwallRegistryService {
  private readonly logger = new Logger(OfferwallRegistryService.name);
  private readonly adapters = new Map<string, OfferwallAdapter>();

  constructor(config: ConfigService) {
    const str = (key: string): string => config.get<string>(key) ?? '';
    const all: OfferwallAdapter[] = [
      new MockOfferwallAdapter(str('MOCK_OFFERWALL_SECRET')),
      new AdjoeAdapter(str('ADJOE_S2S_SECRET')),
      new AdgateAdapter(str('ADGATE_POSTBACK_SECRET'), str('ADGATE_WALL_ID')),
      new OffertoroAdapter(
        str('OFFERTORO_SECRET_KEY'),
        str('OFFERTORO_APP_ID'),
        str('OFFERTORO_PUB_ID'),
      ),
      new CpxAdapter(str('CPX_SECURE_HASH'), str('CPX_APP_ID')),
    ];
    const byName = new Map(all.map((a) => [a.network, a]));

    const enabled = (config.get<string>('OFFERWALL_NETWORKS') ?? 'mock')
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    for (const name of enabled) {
      const adapter = byName.get(name);
      if (!adapter) {
        this.logger.warn(`OFFERWALL_NETWORKS lists unknown network "${name}" — ignored`);
        continue;
      }
      this.adapters.set(name, adapter);
    }
    this.logger.log(`Offerwall networks enabled: [${[...this.adapters.keys()].join(', ')}]`);
  }

  /** Adapter for an ENABLED network, else undefined (→ 404 at the webhook). */
  resolve(network: string): OfferwallAdapter | undefined {
    return this.adapters.get(network);
  }

  enabledNetworks(): string[] {
    return [...this.adapters.keys()];
  }

  isEnabled(network: string): boolean {
    return this.adapters.has(network);
  }
}
