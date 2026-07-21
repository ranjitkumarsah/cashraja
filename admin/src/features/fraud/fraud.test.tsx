import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, renderApp, reviewerAdmin, seedSession } from '../../test/utils';
import { ok } from '../../test/http';
import type { FraudFlagView } from '../../lib/api/types';

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

const FLAG: FraudFlagView = {
  id: 'f1',
  user: { id: 'u1', email: 'anita@cashraja.app', status: 'flagged' },
  rule_triggered: 'offer_velocity',
  severity: 'high',
  auto_action: 'hold',
  status: 'open',
  resolution_action: null,
  resolved_by_admin_id: null,
  resolved_at: null,
  created_at: '2026-07-19T00:00:00.000Z',
};

beforeEach(() => {
  clearSession();
  mockGet.mockReset();
  mockPost.mockReset();
  mockGet.mockReturnValue(ok([FLAG]));
});

describe('Fraud queue (reviewer-visible)', () => {
  it('lets a reviewer see the flag queue with severity', async () => {
    seedSession(reviewerAdmin);
    renderApp('/fraud');

    expect(await screen.findByText('Offer Velocity')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('anita@cashraja.app')).toBeInTheDocument();
  });

  it('resolves a flag with an action and note', async () => {
    mockPost.mockReturnValue(ok({ ...FLAG, status: 'resolved', resolution_action: 'ban_user' }));
    seedSession(reviewerAdmin);
    renderApp('/fraud');

    await screen.findByText('Offer Velocity');
    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }));

    await userEvent.selectOptions(screen.getByLabelText('Action'), 'ban_user');
    await userEvent.type(screen.getByLabelText('Note (optional)'), 'Confirmed abuse');

    const resolveButtons = screen.getAllByRole('button', { name: 'Resolve' });
    await userEvent.click(resolveButtons[resolveButtons.length - 1]);

    expect(await screen.findByText('Flag resolved')).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith('/admin/fraud-flags/f1/resolve', {
      action: 'ban_user',
      note: 'Confirmed abuse',
    });
  });
});
