import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, makeJwt, renderApp, superAdmin } from '../../test/utils';

/**
 * Auth-flow state machine against a mocked axios: all three /login response
 * branches (direct session, totp_required, totp_setup_required) plus errors.
 */
const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }));

vi.mock('axios', () => {
  const instance = {
    post: mockPost,
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  return {
    default: {
      create: () => instance,
      isAxiosError: (error: unknown) =>
        typeof error === 'object' && error !== null && 'isAxiosError' in error,
    },
  };
});

function http401(message: string) {
  return {
    isAxiosError: true,
    config: { url: '/admin-auth/login' },
    response: { status: 401, data: { message, statusCode: 401 } },
  };
}

async function submitCredentials(email = 'root@cashraja.app', password = 'hunter2hunter2') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  return user;
}

const session = () => ({
  data: { access_token: makeJwt(), admin: superAdmin },
});

beforeEach(() => {
  clearSession();
  mockPost.mockReset();
});

describe('login flow', () => {
  it('signs straight in when /login returns a direct session (no-TOTP branch)', async () => {
    mockPost.mockResolvedValueOnce(session());
    renderApp('/login');

    await submitCredentials();

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith('/admin-auth/login', {
      email: 'root@cashraja.app',
      password: 'hunter2hunter2',
    });
    expect(sessionStorage.getItem('cr-admin-session')).toContain('root@cashraja.app');
  });

  it('walks the totp_required branch: challenge → code → session', async () => {
    mockPost
      .mockResolvedValueOnce({ data: { totp_required: true, challenge_token: 'ct-totp' } })
      .mockResolvedValueOnce(session());
    renderApp('/login');

    const user = await submitCredentials();

    expect(
      await screen.findByRole('heading', { name: 'Two-factor verification' }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText('Authentication code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(mockPost).toHaveBeenLastCalledWith('/admin-auth/totp', {
      challenge_token: 'ct-totp',
      code: '123456',
    });
  });

  it('walks the totp_setup_required branch: QR + code → /totp-setup → session', async () => {
    mockPost
      .mockResolvedValueOnce({
        data: {
          totp_setup_required: true,
          challenge_token: 'ct-setup',
          otpauth_url: 'otpauth://totp/Cash%20Raja:root%40cashraja.app?secret=ABC123',
        },
      })
      .mockResolvedValueOnce(session());
    renderApp('/login');

    const user = await submitCredentials();

    expect(
      await screen.findByRole('heading', { name: 'Set up two-factor authentication' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'TOTP setup QR code' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Authentication code'), '654321');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(mockPost).toHaveBeenLastCalledWith('/admin-auth/totp-setup', {
      challenge_token: 'ct-setup',
      code: '654321',
    });
  });

  it('surfaces the backend message on a rejected password', async () => {
    mockPost.mockRejectedValueOnce(http401('Invalid credentials'));
    renderApp('/login');

    await submitCredentials();

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
    // Still on the credentials step.
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('keeps the code step open and shows the error on a bad TOTP code', async () => {
    mockPost
      .mockResolvedValueOnce({ data: { totp_required: true, challenge_token: 'ct-totp' } })
      .mockRejectedValueOnce(http401('Invalid TOTP code'));
    renderApp('/login');

    const user = await submitCredentials();
    await user.type(await screen.findByLabelText('Authentication code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid TOTP code');
    expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument();
  });

  it('validates the code shape client-side before calling the API', async () => {
    mockPost.mockResolvedValueOnce({ data: { totp_required: true, challenge_token: 'ct' } });
    renderApp('/login');

    const user = await submitCredentials();
    await user.type(await screen.findByLabelText('Authentication code'), '12a');
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/6-digit code/i);
    expect(mockPost).toHaveBeenCalledTimes(1); // only the login call
  });
});
