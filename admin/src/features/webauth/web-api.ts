import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../../lib/api/base';
import { webTokens } from './web-token-store';

/**
 * Axios instance for the WEB USER app (separate from the admin `api` instance).
 * Attaches the web user access token, and on a 401 transparently refreshes the
 * token (honouring refresh rotation) and retries once. A dead session clears
 * tokens and sends the user to /login.
 */
export const webApi = axios.create({ baseURL: API_BASE_URL, timeout: 60_000 });

// Bare instance for /auth/refresh so refresh never recurses through interceptors.
const refreshApi = axios.create({ baseURL: API_BASE_URL, timeout: 60_000 });

webApi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (!config.headers.get?.('skip-auth')) {
    const token = webTokens.access();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const refresh = webTokens.refresh();
  if (!refresh) return null;
  try {
    const res = await refreshApi.post('/auth/refresh', { refresh_token: refresh });
    const access = res.data?.access_token as string | undefined;
    const newRefresh = res.data?.refresh_token as string | undefined;
    if (!access) return null;
    if (newRefresh) webTokens.set(access, newRefresh);
    else webTokens.updateAccess(access);
    return access;
  } catch {
    return null;
  }
}

webApi.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = error.response?.status;
    const url = original?.url ?? '';
    if (status !== 401 || !original || original._retried || url.includes('/auth/')) {
      return Promise.reject(error);
    }
    // Serialize concurrent refreshes so we only hit /auth/refresh once.
    refreshing ??= doRefresh().finally(() => {
      refreshing = null;
    });
    const access = await refreshing;
    if (!access) {
      webTokens.clear();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
      return Promise.reject(error);
    }
    original._retried = true;
    original.headers.Authorization = `Bearer ${access}`;
    return webApi(original);
  },
);

/** Friendly message from a failed web API call. */
export function webApiError(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { message?: string | string[] } | undefined;
    if (Array.isArray(data?.message)) return data.message.join(', ');
    if (typeof data?.message === 'string') return data.message;
    if (e.code === 'ERR_NETWORK') return 'Cannot reach the server. Please try again.';
  }
  return fallback;
}
