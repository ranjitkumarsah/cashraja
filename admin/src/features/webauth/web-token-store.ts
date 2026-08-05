/**
 * Web USER session tokens (distinct from the admin session store). Persisted in
 * localStorage so a signed-in web user stays logged in across reloads. A stable
 * per-browser device id is generated once for the backend's device/fraud checks.
 */
const ACCESS = 'cr-web-access';
const REFRESH = 'cr-web-refresh';
const DEVICE = 'cr-web-device';

export const webTokens = {
  access(): string | null {
    return localStorage.getItem(ACCESS);
  },
  refresh(): string | null {
    return localStorage.getItem(REFRESH);
  },
  set(access: string, refresh: string): void {
    localStorage.setItem(ACCESS, access);
    localStorage.setItem(REFRESH, refresh);
  },
  updateAccess(access: string): void {
    localStorage.setItem(ACCESS, access);
  },
  clear(): void {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
  isAuthed(): boolean {
    return !!localStorage.getItem(ACCESS);
  },
  deviceId(): string {
    let id = localStorage.getItem(DEVICE);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEVICE, id);
    }
    return id;
  },
};
