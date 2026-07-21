import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, renderApp, seedSession, superAdmin } from '../../test/utils';
import { ok } from '../../test/http';
import type { AdminView } from '../../lib/api/types';

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

const ADMINS: AdminView[] = [
  {
    id: 'a1',
    email: 'ops@cashraja.app',
    role: 'super_admin',
    status: 'active',
    totp_configured: true,
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

beforeEach(() => {
  clearSession();
  mockGet.mockReset();
  mockPost.mockReset();
  mockGet.mockReturnValue(ok(ADMINS));
});

describe('Admins screen', () => {
  it('lists admins with role and TOTP state', async () => {
    seedSession(superAdmin);
    renderApp('/admins');

    expect(await screen.findByText('ops@cashraja.app')).toBeInTheDocument();
    expect(screen.getByText('Configured')).toBeInTheDocument();
  });

  it('validates the new-admin email', async () => {
    seedSession(superAdmin);
    renderApp('/admins');

    await userEvent.click(await screen.findByRole('button', { name: /New admin/ }));
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Create admin' }));

    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('shows the one-time temp password after creating an admin', async () => {
    mockPost.mockReturnValue(
      ok({
        id: 'a2',
        email: 'new@cashraja.app',
        role: 'reviewer',
        status: 'active',
        totp_configured: false,
        created_at: '2026-07-20T00:00:00.000Z',
        temp_password: 'TempPass-9x7Q',
      }),
    );
    seedSession(superAdmin);
    renderApp('/admins');

    await userEvent.click(await screen.findByRole('button', { name: /New admin/ }));
    await userEvent.type(screen.getByLabelText('Email'), 'new@cashraja.app');
    await userEvent.click(screen.getByRole('button', { name: 'Create admin' }));

    expect(await screen.findByText('TempPass-9x7Q')).toBeInTheDocument();
    expect(screen.getByText(/shown once/)).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith('/admin/admins', {
      email: 'new@cashraja.app',
      role: 'reviewer',
    });
  });
});
