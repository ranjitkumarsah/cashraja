import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, renderApp } from '../../test/utils';

// The landing fetches GET /api/public/stats (aggregate, no auth). Stub the
// global fetch per test to control what the live-stats strip renders.
function stubStatsFetch(body: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) }),
  );
}

beforeEach(() => {
  clearSession();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('public marketing site', () => {
  it('renders the landing hero and the Google Play CTA at /', async () => {
    stubStatsFetch({ total_users: 0, daily_active_users: 0, rewards_paid_rupees: 0 });
    renderApp('/');

    expect(await screen.findByRole('heading', { level: 1, name: /Cash Raja/ })).toBeInTheDocument();
    expect(screen.getByText('Play. Earn. Redeem real gift cards.')).toBeInTheDocument();
    const ctas = screen.getAllByRole('link', { name: /Get it on Google Play/i });
    expect(ctas.length).toBeGreaterThanOrEqual(1);
  });

  it('shows live stats with Indian grouping when the API returns non-zero figures', async () => {
    stubStatsFetch({ total_users: 50000, daily_active_users: 8200, rewards_paid_rupees: 1200000 });
    renderApp('/');

    expect(await screen.findByText('50,000')).toBeInTheDocument();
    expect(screen.getByText('8,200')).toBeInTheDocument();
    expect(screen.getByText('₹12,00,000')).toBeInTheDocument();
    expect(screen.getByText('Total players')).toBeInTheDocument();
  });

  it('hides the stats strip entirely when every figure is zero (no fabricated counts)', async () => {
    stubStatsFetch({ total_users: 0, daily_active_users: 0, rewards_paid_rupees: 0 });
    renderApp('/');

    // Hero renders...
    expect(await screen.findByRole('heading', { level: 1, name: /Cash Raja/ })).toBeInTheDocument();
    // ...but the stats labels never appear.
    await waitFor(() => {
      expect(screen.queryByText('Total players')).not.toBeInTheDocument();
    });
  });

  it('serves the Privacy Policy at /privacy (public, no auth)', async () => {
    renderApp('/privacy');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Privacy Policy' }),
    ).toBeInTheDocument();
    // A distinctive line from the mirrored in-app policy copy.
    expect(screen.getByText(/intended only for users aged 18 or older/i)).toBeInTheDocument();
  });

  it('redirects an unauthenticated visitor from /admin/dashboard to /admin/login', async () => {
    renderApp('/admin/dashboard');

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });
});
