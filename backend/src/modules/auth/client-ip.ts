import { Request } from 'express';

/**
 * Client IP for GeoIP: CF-Connecting-IP (Cloudflare) wins, then the first
 * hop of X-Forwarded-For, then the socket address.
 */
export function clientIpOf(req: Request): string | null {
  const cf = req.headers['cf-connecting-ip'];
  const cfValue = Array.isArray(cf) ? cf[0] : cf;
  if (typeof cfValue === 'string' && cfValue.trim()) {
    return cfValue.trim();
  }
  const xff = req.headers['x-forwarded-for'];
  const xffValue = Array.isArray(xff) ? xff[0] : xff;
  if (typeof xffValue === 'string' && xffValue.trim()) {
    return xffValue.split(',')[0].trim();
  }
  return req.ip ?? null;
}
