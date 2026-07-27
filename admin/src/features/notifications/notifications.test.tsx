import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, renderApp, reviewerAdmin, seedSession, superAdmin } from '../../test/utils';
import { ok } from '../../test/http';
import type { AdminUserListPage, BroadcastListResult } from '../../lib/api/types';

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

const EMPTY_HISTORY: BroadcastListResult = { broadcasts: [] };

const USER_PAGE: AdminUserListPage = {
  users: [
    {
      id: 'user-1',
      email: 'fan@cashraja.app',
      display_name: 'Super Fan',
      country: 'IN',
      status: 'active',
      coin_balance_cached: 1200,
      created_at: '2026-01-01T00:00:00.000Z',
      last_seen_at: '2026-07-20T00:00:00.000Z',
    },
  ],
  next_cursor: null,
};

function routeGet(url: string) {
  if (url === '/admin/notifications/broadcasts') return ok(EMPTY_HISTORY);
  if (url === '/admin/users') return ok(USER_PAGE);
  return ok({});
}

beforeEach(() => {
  clearSession();
  mockGet.mockReset();
  mockPost.mockReset();
  mockGet.mockImplementation((url: string) => routeGet(url));
});

describe('Send notification screen', () => {
  it('is not accessible to reviewers (RBAC)', async () => {
    seedSession(reviewerAdmin);
    renderApp('/admin/notifications');
    expect(await screen.findByText('Not authorized')).toBeInTheDocument();
    expect(screen.queryByText('Compose')).not.toBeInTheDocument();
  });

  it('validates title and message before sending', async () => {
    seedSession(superAdmin);
    renderApp('/admin/notifications');

    await userEvent.click(await screen.findByRole('button', { name: /Send broadcast/ }));

    expect(await screen.findByText(/A title is required/)).toBeInTheDocument();
    expect(screen.getByText(/A message is required/)).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('sends a broadcast to all users after confirmation', async () => {
    mockPost.mockReturnValue(
      ok({
        broadcast: {
          id: 'b1',
          title: 'Hello',
          body: 'World news',
          audience_type: 'all',
          target_count: 42,
          sent_by_admin_id: 'admin-sup',
          sent_by_admin_email: 'root@cashraja.app',
          created_at: '2026-07-25T00:00:00.000Z',
        },
      }),
    );
    seedSession(superAdmin);
    renderApp('/admin/notifications');

    await userEvent.type(await screen.findByLabelText('Title'), 'Hello');
    await userEvent.type(screen.getByLabelText('Message'), 'World news');
    await userEvent.click(screen.getByRole('button', { name: /Send broadcast/ }));

    // Confirm-before-send dialog appears (All audience → danger confirm).
    const dialog = await screen.findByText('Send this broadcast?');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/ALL active users/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Send now' }));

    expect(mockPost).toHaveBeenCalledWith('/admin/notifications/broadcast', {
      title: 'Hello',
      body: 'World news',
      audience: { type: 'all' },
    });
    expect(await screen.findByText('Broadcast sent')).toBeInTheDocument();
  });

  it('targets specific users chosen from the searchable picker', async () => {
    mockPost.mockReturnValue(
      ok({
        broadcast: {
          id: 'b2',
          title: 'Thanks',
          body: 'A little bonus',
          audience_type: 'users',
          target_count: 1,
          sent_by_admin_id: 'admin-sup',
          sent_by_admin_email: 'root@cashraja.app',
          created_at: '2026-07-25T00:00:00.000Z',
        },
      }),
    );
    seedSession(superAdmin);
    renderApp('/admin/notifications');

    await userEvent.type(await screen.findByLabelText('Title'), 'Thanks');
    await userEvent.type(screen.getByLabelText('Message'), 'A little bonus');
    await userEvent.selectOptions(screen.getByLabelText('Audience'), 'users');

    // Search and pick a user.
    await userEvent.type(screen.getByLabelText('Recipients'), 'fan');
    await userEvent.click(await screen.findByText('fan@cashraja.app'));

    await userEvent.click(screen.getByRole('button', { name: /Send broadcast/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Send now' }));

    expect(mockPost).toHaveBeenCalledWith('/admin/notifications/broadcast', {
      title: 'Thanks',
      body: 'A little bonus',
      audience: { type: 'users', user_ids: ['user-1'] },
    });
  });

  it('blocks a specific-users send with no recipients selected', async () => {
    seedSession(superAdmin);
    renderApp('/admin/notifications');

    await userEvent.type(await screen.findByLabelText('Title'), 'Empty');
    await userEvent.type(screen.getByLabelText('Message'), 'No recipients');
    await userEvent.selectOptions(screen.getByLabelText('Audience'), 'users');
    await userEvent.click(screen.getByRole('button', { name: /Send broadcast/ }));

    expect(await screen.findByText(/Add at least one recipient/)).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });
});
