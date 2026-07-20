import axios, { type AxiosError } from 'axios';
import { tokenStore } from '../auth/token-store';

/**
 * Single axios instance for the whole panel. In dev, /api is proxied by Vite
 * to the backend (vite.config.ts); in production the panel is served behind
 * the same origin as the API, so the relative base works everywhere.
 */
export const api = axios.create({
  baseURL: '/api',
  timeout: 15_000,
});

api.interceptors.request.use((config) => {
  const token = tokenStore.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url ?? '';
    // Session expiry: any authenticated call answering 401 clears the session;
    // route guards react to the store change and land on /login. Auth endpoints
    // are excluded — a wrong password must not "log out" a login attempt.
    if (status === 401 && !url.startsWith('/admin-auth')) {
      tokenStore.clear();
    }
    return Promise.reject(error);
  },
);

/** Best-effort human message out of a failed axios call. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    if (Array.isArray(data?.message)) return data.message.join(', ');
    if (typeof data?.message === 'string') return data.message;
    if (error.code === 'ERR_NETWORK') return 'Cannot reach the server. Is the backend running?';
  }
  return fallback;
}
