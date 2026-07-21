import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, makeJwt, renderApp, reviewerAdmin, seedSession, superAdmin } from '../test/utils';
import { tokenStore } from '../lib/auth/token-store';

// Authenticated routes render data-fetching pages; mock the shared axios instance
// so those queries resolve instead of hitting a real (absent) backend.
const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));
vi.mock('axios', () => {
  const instance = {
    get: mockGet,
    post: vi.fn(),
    patch: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  };
  return { default: { create: () => instance, isAxiosError: () => false } };
});

const emptyMetrics = {
  current: {
    dau: 0,
    coins_issued: 0,
    coins_redeemed: 0,
    offer_completion_rate: 0,
    outstanding_liability: 0,
  },
  series: [],
};

beforeEach(() => {
  clearSession();
  mockGet.mockReset();
  mockGet.mockImplementation((url: string) =>
    Promise.resolve({ data: url.includes('dashboard/metrics') ? emptyMetrics : [] }),
  );
});

describe('route guards', () => {
  it('redirects unauthenticated visitors from / to the login page', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('redirects unauthenticated visitors from deep links to the login page', async () => {
    renderApp('/config');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('redirects an authenticated admin away from /login to the dashboard', async () => {
    seedSession(superAdmin);
    renderApp('/login');
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('treats an expired stored token as no session', async () => {
    sessionStorage.setItem(
      'cr-admin-session',
      JSON.stringify({ token: makeJwt(-60), admin: reviewerAdmin }),
    );
    tokenStore.reload();

    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });
});

describe('role gating (RBAC matrix)', () => {
  it('blocks a reviewer from super-admin sections with a Not authorized card', async () => {
    seedSession(reviewerAdmin);
    renderApp('/config');
    expect(await screen.findByRole('heading', { name: 'Not authorized' })).toBeInTheDocument();
  });

  it('lets a super-admin open super-admin sections', async () => {
    seedSession(superAdmin);
    renderApp('/config');
    expect(await screen.findByRole('heading', { name: 'Config', level: 1 })).toBeInTheDocument();
  });

  it('shows the reviewer only Dashboard, Users, Redemptions and Fraud in the nav', async () => {
    seedSession(reviewerAdmin);
    renderApp('/');

    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Dashboard',
      'Users',
      'Redemptions',
      'Fraud',
    ]);
  });

  it('shows the super-admin every section in the nav', async () => {
    seedSession(superAdmin);
    renderApp('/');

    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Dashboard',
      'Users',
      'Redemptions',
      'Offers',
      'Inventory',
      'Fraud',
      'Config',
      'Admins',
    ]);
  });
});
