import type { AdminSummary } from '../api/types';

/**
 * Admin session holder: in-memory first (interceptor reads synchronously),
 * mirrored to sessionStorage so a page refresh within the 8-hour admin JWT
 * lifetime keeps the session, while closing the tab drops it.
 */

const STORAGE_KEY = 'cr-admin-session';

export interface StoredSession {
  token: string;
  admin: AdminSummary;
}

type Listener = () => void;

const listeners = new Set<Listener>();

function decodeJwtExp(token: string): number | null {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;
    const json = atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/'));
    const payload: unknown = JSON.parse(json);
    if (payload && typeof payload === 'object' && 'exp' in payload) {
      const exp = (payload as { exp: unknown }).exp;
      return typeof exp === 'number' ? exp : null;
    }
    return null;
  } catch {
    return null;
  }
}

function isExpired(token: string): boolean {
  const exp = decodeJwtExp(token);
  return exp !== null && exp * 1000 <= Date.now();
}

function restore(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof parsed.token !== 'string' || !parsed.admin) return null;
    if (isExpired(parsed.token)) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed as StoredSession;
  } catch {
    return null;
  }
}

let session: StoredSession | null = restore();

function emit(): void {
  for (const listener of listeners) listener();
}

export const tokenStore = {
  getSession(): StoredSession | null {
    return session;
  },

  getToken(): string | null {
    return session?.token ?? null;
  },

  set(next: StoredSession): void {
    session = next;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable (private mode edge case) — in-memory still works.
    }
    emit();
  },

  clear(): void {
    if (session === null) return;
    session = null;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    emit();
  },

  /** Re-read sessionStorage (used by tests and after external changes). */
  reload(): void {
    session = restore();
    emit();
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
