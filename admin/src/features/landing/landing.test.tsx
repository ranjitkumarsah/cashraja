import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearSession, renderApp } from '../../test/utils';

beforeEach(() => {
  clearSession();
});

describe('public marketing site', () => {
  it('renders the landing hero and the Get Started CTA at /', async () => {
    renderApp('/');

    expect(await screen.findByRole('heading', { level: 1, name: /Cash Raja/ })).toBeInTheDocument();
    expect(screen.getByText('Play. Earn. Redeem real gift cards.')).toBeInTheDocument();
    const ctas = screen.getAllByRole('link', { name: /Get Started/i });
    expect(ctas.length).toBeGreaterThanOrEqual(1);
    // CTAs point at the web sign-in.
    ctas.forEach((cta) => expect(cta).toHaveAttribute('href', '/login'));
  });

  it('shows scale-independent trust signals under the hero', async () => {
    renderApp('/');

    expect(
      await screen.findByText('Rewards verified server-side before crediting'),
    ).toBeInTheDocument();
    expect(screen.getByText('Amazon, Flipkart & Google Play gift cards')).toBeInTheDocument();
    expect(screen.getByText('18+, one account per person, free to join')).toBeInTheDocument();
  });

  it('never renders usage counters on the landing page', async () => {
    // Regression guard: a live "total players / daily active users / rewards
    // paid" strip used to sit under the hero. On a new site it advertised how
    // few people had signed up, which is the opposite of reassurance in a
    // category where the first question is "is this a scam?". It must not
    // come back — and no fabricated stand-in may replace it.
    renderApp('/');

    expect(await screen.findByRole('heading', { level: 1, name: /Cash Raja/ })).toBeInTheDocument();
    expect(screen.queryByText('Total players')).not.toBeInTheDocument();
    expect(screen.queryByText('Daily active users')).not.toBeInTheDocument();
    expect(screen.queryByText('Rewards paid')).not.toBeInTheDocument();
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
