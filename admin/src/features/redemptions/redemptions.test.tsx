import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, renderApp, seedSession, superAdmin } from '../../test/utils';
import { ok } from '../../test/http';
import type { AdminRedemptionPage, AdminRedemptionView } from '../../lib/api/types';

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

const REDEMPTION: AdminRedemptionView = {
  id: 'r1',
  user: { id: 'u1', email: 'anita@cashraja.app' },
  gift_card: { id: 'g1', brand: 'Amazon', denomination: 100 },
  coin_amount: 10000,
  status: 'requested',
  rejection_reason: null,
  reviewed_by_admin_id: null,
  created_at: '2026-07-19T00:00:00.000Z',
  resolved_at: null,
  has_code: false,
};

const PAGE: AdminRedemptionPage = { redemptions: [REDEMPTION], next_cursor: null };

beforeEach(() => {
  clearSession();
  mockGet.mockReset();
  mockPost.mockReset();
  mockGet.mockImplementation((url: string) => (url.includes('/export') ? ok('csv') : ok(PAGE)));
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe('Redemptions queue', () => {
  it('renders the queue with user and gift-card details', async () => {
    seedSession(superAdmin);
    renderApp('/redemptions');

    expect(await screen.findByText('anita@cashraja.app')).toBeInTheDocument();
    expect(screen.getByText('Amazon')).toBeInTheDocument();
    expect(screen.getByText('10,000')).toBeInTheDocument();
  });

  it('explains the approved_pending outcome on approve', async () => {
    mockPost.mockReturnValue(
      ok({ outcome: 'approved_pending', redemption: REDEMPTION, reason: 'No stock available' }),
    );
    seedSession(superAdmin);
    renderApp('/redemptions');

    await screen.findByText('anita@cashraja.app');
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('Approved — awaiting stock')).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith('/admin/redemptions/r1/approve');
  });

  it('requires a reason to reject and posts it', async () => {
    mockPost.mockReturnValue(ok({}));
    seedSession(superAdmin);
    renderApp('/redemptions');

    await screen.findByText('anita@cashraja.app');
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));

    // The modal submit is the last matching "Reject" button (portal appended after the row).
    const submit = () => {
      const buttons = screen.getAllByRole('button', { name: 'Reject' });
      return buttons[buttons.length - 1];
    };

    // Submit with no reason → validation blocks the call.
    await userEvent.click(submit());
    expect(await screen.findByText(/A rejection reason is required/)).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();

    // Now fill and submit.
    await userEvent.type(screen.getByLabelText('Reason'), 'Suspected fraud');
    await userEvent.click(submit());

    expect(await screen.findByText('Redemption rejected')).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith('/admin/redemptions/r1/reject', {
      reason: 'Suspected fraud',
    });
  });

  it('exports the queue as CSV', async () => {
    seedSession(superAdmin);
    renderApp('/redemptions');

    await screen.findByText('anita@cashraja.app');
    await userEvent.click(screen.getByRole('button', { name: /Export CSV/ }));

    expect(await screen.findByText('Export ready')).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith(
      '/admin/redemptions/export',
      expect.objectContaining({ responseType: 'text' }),
    );
  });
});
