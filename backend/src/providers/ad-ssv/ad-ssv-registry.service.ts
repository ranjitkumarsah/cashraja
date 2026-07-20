import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdSsvAdapter } from './ad-ssv-adapter';
import { AdmobAdSsvAdapter } from './admob-ad-ssv.adapter';
import { ApplovinAdSsvAdapter } from './applovin-ad-ssv.adapter';
import { LevelplayAdSsvAdapter } from './levelplay-ad-ssv.adapter';
import { MockAdSsvAdapter } from './mock-ad-ssv.adapter';

/**
 * Env-driven ad-SSV registry: AD_NETWORKS (comma list, default "mock").
 * Mirrors OfferwallRegistryService.
 */
@Injectable()
export class AdSsvRegistryService {
  private readonly logger = new Logger(AdSsvRegistryService.name);
  private readonly adapters = new Map<string, AdSsvAdapter>();

  constructor(config: ConfigService) {
    const str = (key: string): string => config.get<string>(key) ?? '';
    const all: AdSsvAdapter[] = [
      new MockAdSsvAdapter(str('MOCK_AD_SSV_SECRET')),
      new ApplovinAdSsvAdapter(str('APPLOVIN_CALLBACK_TOKEN')),
      new LevelplayAdSsvAdapter(str('LEVELPLAY_PRIVATE_KEY')),
      new AdmobAdSsvAdapter(str('ADMOB_SSV_KEY_SERVER_URL')),
    ];
    const byName = new Map(all.map((a) => [a.network, a]));

    const enabled = (config.get<string>('AD_NETWORKS') ?? 'mock')
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    for (const name of enabled) {
      const adapter = byName.get(name);
      if (!adapter) {
        this.logger.warn(`AD_NETWORKS lists unknown network "${name}" — ignored`);
        continue;
      }
      this.adapters.set(name, adapter);
    }
    this.logger.log(`Ad SSV networks enabled: [${[...this.adapters.keys()].join(', ')}]`);
  }

  resolve(network: string): AdSsvAdapter | undefined {
    return this.adapters.get(network);
  }

  enabledNetworks(): string[] {
    return [...this.adapters.keys()];
  }
}
