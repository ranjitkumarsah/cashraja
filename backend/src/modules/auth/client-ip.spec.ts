import { Request } from 'express';
import { clientIpOf } from './client-ip';

function reqWith(headers: Record<string, string | string[]>, ip?: string): Request {
  return { headers, ip } as unknown as Request;
}

describe('clientIpOf', () => {
  it('prefers CF-Connecting-IP', () => {
    const req = reqWith(
      { 'cf-connecting-ip': '198.51.100.9', 'x-forwarded-for': '203.0.113.1' },
      '10.0.0.1',
    );
    expect(clientIpOf(req)).toBe('198.51.100.9');
  });

  it('falls back to the first X-Forwarded-For hop', () => {
    const req = reqWith({ 'x-forwarded-for': '203.0.113.1, 10.0.0.2' }, '10.0.0.1');
    expect(clientIpOf(req)).toBe('203.0.113.1');
  });

  it('falls back to the socket address', () => {
    expect(clientIpOf(reqWith({}, '10.0.0.1'))).toBe('10.0.0.1');
  });

  it('returns null when nothing is available', () => {
    expect(clientIpOf(reqWith({}))).toBeNull();
  });
});
