import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, renderApp, seedSession, superAdmin } from '../../test/utils';
import { ok } from '../../test/http';
import type { AdminOfferView, PostbackLogPage } from '../../lib/api/types';

const { mockGet, mockPatch } = vi.hoisted(() => ({ mockGet: vi.fn(), mockPatch: vi.fn() }));

vi.mock('axios', () => {
  const instance = {
    get: mockGet,
    post: vi.fn(),
    patch: mockPatch,
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  };
  return {
    default: {
      create: () => instance,
      isAxiosError: (e: unknown) => typeof e === 'object' && e !== null && 'isAxiosError' in e,
    },
  };
});

const OFFER: AdminOfferView = {
  id: 'o1',
  network: 'adgem',
  external_offer_id: 'ext-1',
  title: 'Install SuperApp',
  description: 'Install and open',
  coin_reward: 500,
  is_active: true,
  created_at: '2026-07-01T00:00:00.000Z',
};

const LOGS: PostbackLogPage = {
  logs: [
    {
      id: 'p1',
      user_id: 'u1',
      network: 'adgem',
      external_txn_id: 'txn-9',
      status: 'credited',
      coin_reward: 500,
      status_reason: null,
      network_payload: { secret_marker: 'PAYLOAD_XYZ' },
      created_at: '2026-07-19T00:00:00.000Z',
    },
  ],
  next_cursor: null,
};

beforeEach(() => {
  clearSession();
  mockGet.mockReset();
  mockPatch.mockReset();
  mockGet.mockImplementation((url: string) =>
    url.includes('/postback-logs') ? ok(LOGS) : ok([OFFER]),
  );
});

describe('Offers screen', () => {
  it('renders offers and postback logs', async () => {
    seedSession(superAdmin);
    renderApp('/offers');

    expect(await screen.findByText('Install SuperApp')).toBeInTheDocument();
    expect(screen.getByText('txn-9')).toBeInTheDocument();
  });

  it('toggles an offer active flag', async () => {
    mockPatch.mockReturnValue(ok({ ...OFFER, is_active: false }));
    seedSession(superAdmin);
    renderApp('/offers');

    await screen.findByText('Install SuperApp');
    await userEvent.click(screen.getByRole('switch', { name: /Toggle Install SuperApp/ }));

    expect(await screen.findByText('Offer disabled')).toBeInTheDocument();
    expect(mockPatch).toHaveBeenCalledWith('/admin/offers/o1', { is_active: false });
  });

  it('edits the coin reward inline', async () => {
    mockPatch.mockReturnValue(ok({ ...OFFER, coin_reward: 750 }));
    seedSession(superAdmin);
    renderApp('/offers');

    await screen.findByText('Install SuperApp');
    await userEvent.click(screen.getByRole('button', { name: '500' }));

    const input = screen.getByLabelText('Coin reward for Install SuperApp');
    await userEvent.clear(input);
    await userEvent.type(input, '750');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Reward updated')).toBeInTheDocument();
    expect(mockPatch).toHaveBeenCalledWith('/admin/offers/o1', { coin_reward: 750 });
  });

  it('expands a postback row to reveal the raw payload', async () => {
    seedSession(superAdmin);
    renderApp('/offers');

    await screen.findByText('txn-9');
    await userEvent.click(screen.getByText('txn-9'));

    expect(await screen.findByText(/PAYLOAD_XYZ/)).toBeInTheDocument();
  });
});
