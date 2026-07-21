import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, renderApp, reviewerAdmin, seedSession, superAdmin } from '../../test/utils';
import { ok } from '../../test/http';
import type { AdminUserDetail, AdminUserListPage, LedgerPageView } from '../../lib/api/types';

const { mockGet, mockPost } = vi.hoisted(() => ({ mockGet: vi.fn(), mockPost: vi.fn() }));

vi.mock('axios', () => {
  const instance = {
    get: mockGet,
    post: mockPost,
    patch: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  };
  return {
    default: {
      create: () => instance,
      isAxiosError: (e: unknown) => typeof e === 'object' && e !== null && 'isAxiosError' in e,
    },
  };
});

const LIST: AdminUserListPage = {
  users: [
    {
      id: 'u1',
      email: 'anita@cashraja.app',
      display_name: 'Anita',
      country: 'IN',
      status: 'active',
      coin_balance_cached: 5400,
      created_at: '2026-01-01T00:00:00.000Z',
      last_seen_at: '2026-07-19T00:00:00.000Z',
    },
  ],
  next_cursor: null,
};

const DETAIL: AdminUserDetail = {
  ...LIST.users[0],
  referral_code: 'RAJA123',
  devices: [],
  fraud_flags: [],
};

const LEDGER: LedgerPageView = {
  entries: [
    {
      id: 'l1',
      amount: 250,
      source_type: 'game',
      source_ref_id: null,
      balance_after: 5400,
      created_at: '2026-07-18T00:00:00.000Z',
    },
  ],
  next_cursor: null,
};

function routeGet(url: string) {
  if (url.includes('/ledger')) return ok(LEDGER);
  if (url.includes('/admin/users/u1')) return ok(DETAIL);
  return ok(LIST);
}

beforeEach(() => {
  clearSession();
  mockGet.mockReset();
  mockPost.mockReset();
  mockGet.mockImplementation(routeGet);
});

describe('Users screen', () => {
  it('renders the users table with balances', async () => {
    seedSession(superAdmin);
    renderApp('/users');

    expect(await screen.findByText('Anita')).toBeInTheDocument();
    expect(screen.getByText('anita@cashraja.app')).toBeInTheDocument();
    expect(screen.getByText('5,400')).toBeInTheDocument();
  });

  it('hides adjust-balance and ban actions from reviewers', async () => {
    seedSession(reviewerAdmin);
    renderApp('/users');

    await screen.findByText('Anita');
    await userEvent.click(screen.getByRole('button', { name: /Anita/ }));

    // Ledger still visible to reviewers.
    expect(await screen.findByText('Ledger history')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adjust balance' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ban user' })).not.toBeInTheDocument();
  });

  it('lets a super-admin adjust a balance with a reason', async () => {
    mockPost.mockReturnValue(ok({ balance_after: 5650, ledger_id: 'l2' }));
    seedSession(superAdmin);
    renderApp('/users');

    await screen.findByText('Anita');
    await userEvent.click(screen.getByRole('button', { name: /Anita/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Adjust balance' }));

    await userEvent.type(screen.getByLabelText('Amount (coins)'), '250');
    await userEvent.type(screen.getByLabelText('Reason'), 'Goodwill credit');
    await userEvent.click(screen.getByRole('button', { name: 'Credit coins' }));

    expect(await screen.findByText('Balance adjusted')).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith('/admin/users/u1/adjust-balance', {
      amount: 250,
      reason: 'Goodwill credit',
    });
  });

  it('validates the adjust-balance form', async () => {
    seedSession(superAdmin);
    renderApp('/users');

    await screen.findByText('Anita');
    await userEvent.click(screen.getByRole('button', { name: /Anita/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Adjust balance' }));
    await userEvent.click(screen.getByRole('button', { name: 'Credit coins' }));

    expect(await screen.findByText('Amount cannot be zero')).toBeInTheDocument();
    expect(screen.getByText(/A reason is required/)).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });
});
