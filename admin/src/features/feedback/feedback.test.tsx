import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, renderApp, reviewerAdmin, seedSession } from '../../test/utils';
import { ok } from '../../test/http';
import type { AdminFeedbackView } from '../../lib/api/types';

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

const ITEM: AdminFeedbackView = {
  id: 'fb1',
  user: { id: 'u1', email: 'anita@cashraja.app', display_name: 'Anita' },
  type: 'complaint',
  subject: 'Coins missing after offer',
  message: 'I completed the survey but no coins arrived.',
  status: 'open',
  admin_reply: null,
  resolved_by_admin_id: null,
  created_at: '2026-07-19T00:00:00.000Z',
  resolved_at: null,
};

beforeEach(() => {
  clearSession();
  mockGet.mockReset();
  mockPost.mockReset();
  mockGet.mockReturnValue(ok([ITEM]));
});

describe('Feedback queue (reviewer-visible)', () => {
  it('renders the open queue with a submission subject and email', async () => {
    seedSession(reviewerAdmin);
    renderApp('/admin/feedback');

    expect(await screen.findByText('Coins missing after offer')).toBeInTheDocument();
    expect(screen.getByText('anita@cashraja.app')).toBeInTheDocument();
  });

  it('lets a reviewer reply to a submission', async () => {
    mockPost.mockReturnValue(ok({ ...ITEM, status: 'in_review', admin_reply: 'Looking into it' }));
    seedSession(reviewerAdmin);
    renderApp('/admin/feedback');

    await screen.findByText('Coins missing after offer');
    await userEvent.click(screen.getByRole('button', { name: 'View' }));

    await userEvent.type(screen.getByLabelText('Reply'), 'Looking into it');

    const sendButtons = screen.getAllByRole('button', { name: 'Send reply' });
    await userEvent.click(sendButtons[sendButtons.length - 1]);

    expect(await screen.findByText('Reply sent')).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith('/admin/feedback/fb1/reply', {
      reply: 'Looking into it',
    });
  });

  it('lets a reviewer resolve a submission', async () => {
    mockPost.mockReturnValue(ok({ ...ITEM, status: 'resolved' }));
    seedSession(reviewerAdmin);
    renderApp('/admin/feedback');

    await screen.findByText('Coins missing after offer');
    await userEvent.click(screen.getByRole('button', { name: 'View' }));

    const resolveButtons = screen.getAllByRole('button', { name: 'Resolve' });
    await userEvent.click(resolveButtons[resolveButtons.length - 1]);

    expect(await screen.findByText('Marked resolved')).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith('/admin/feedback/fb1/resolve');
  });
});
