import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders, AppRoutes } from '../App';
import type { AdminSummary } from '../lib/api/types';
import { tokenStore } from '../lib/auth/token-store';

/** Fake-but-decodable JWT with a real exp claim (no signature check client-side). */
export function makeJwt(expiresInSeconds = 3600): string {
  const payload = btoa(
    JSON.stringify({ sub: 'admin-1', exp: Math.floor(Date.now() / 1000) + expiresInSeconds }),
  );
  return `header.${payload}.signature`;
}

export const reviewerAdmin: AdminSummary = {
  id: 'admin-rev',
  email: 'reviewer@cashraja.app',
  role: 'reviewer',
};

export const superAdmin: AdminSummary = {
  id: 'admin-sup',
  email: 'root@cashraja.app',
  role: 'super_admin',
};

export function seedSession(admin: AdminSummary, expiresInSeconds = 3600): void {
  tokenStore.set({ token: makeJwt(expiresInSeconds), admin });
}

export function clearSession(): void {
  tokenStore.clear();
}

/** Render the full app (providers + routes) at a given URL. */
export function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>,
  );
}
