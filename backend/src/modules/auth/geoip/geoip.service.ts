/**
 * GeoIP stub interface (A4.2): resolves an ISO-3166 alpha-2 country from a
 * client IP. Only the mock driver exists for now (always 'IN' — launch
 * market); a real provider (MaxMind, Cloudflare header trust, etc.) slots in
 * behind the same token later.
 */
export const GEOIP_SERVICE = 'GEOIP_SERVICE';

export interface GeoipService {
  countryForIp(ip: string | null): Promise<string | null>;
}

export class MockGeoipService implements GeoipService {
  async countryForIp(_ip: string | null): Promise<string | null> {
    return 'IN';
  }
}
