import { Request } from 'express';

/** Extract the Bearer token from the Authorization header, or null. */
export function bearerTokenOf(request: Request): string | null {
  const header = request.headers.authorization;
  if (typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}
