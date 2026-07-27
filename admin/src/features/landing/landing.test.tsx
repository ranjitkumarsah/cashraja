import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearSession, renderApp } from '../../test/utils';

// The public marketing routes make no network calls, so no axios mock is needed.

beforeEach(() => {
  clearSession();
});

describe('public marketing site', () => {
  it('renders the landing hero and the Google Play CTA at /', async () => {
    renderApp('/');

    expect(await screen.findByRole('heading', { level: 1, name: /Cash Raja/ })).toBeInTheDocument();
    expect(screen.getByText('Play. Earn. Redeem real gift cards.')).toBeInTheDocument();
    const ctas = screen.getAllByRole('link', { name: /Get it on Google Play/i });
    expect(ctas.length).toBeGreaterThanOrEqual(1);
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
