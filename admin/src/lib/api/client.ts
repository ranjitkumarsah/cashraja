import axios, { type AxiosError } from 'axios';
import { tokenStore } from '../auth/token-store';
import { API_BASE_URL } from './base';

/**
 * Single axios instance for the whole panel. Base URL is API_BASE_URL: the
 * same-origin `/api` (dev Vite proxy + same-host prod reverse-proxy) by default,
 * or a cross-origin API when VITE_API_BASE_URL is set at build time (see base.ts).
 */
export const api = axios.create({
  baseURL: API_BASE_URL,
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
