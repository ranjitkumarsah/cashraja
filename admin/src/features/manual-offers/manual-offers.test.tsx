import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, renderApp, reviewerAdmin, seedSession, superAdmin } from '../../test/utils';
import { ok } from '../../test/http';
import type {
  AdminManualOfferSubmissionView,
  AdminManualOfferView,
} from '../../lib/api/types';

const { mockGet, mockPost, mockPatch } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPatch: vi.fn(),
}));

vi.mock('axios', () => {
  const instance = {
    get: mockGet,
    post: mockPost,
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

const OFFER: AdminManualOfferView = {
  id: 'mo1',
  title: 'Follow us on Instagram',
  description: 'Follow @cashraja',
  instructions: 'Follow the page for 7 days',
  coin_reward: 60,
  is_active: true,
  created_by_admin_id: 'admin-sup',
  created_at: '2026-07-19T00:00:00.000Z',
  updated_at: '2026-07-19T00:00:00.000Z',
};

const SUBMISSION: AdminManualOfferSubmissionView = {
  id: 'sub1',
  offer: { id: 'mo1', title: 'Follow us on Instagram', coin_reward: 60 },
  user: { id: 'u1', email: 'anita@cashraja.app', display_name: 'Anita' },
  proof_text: 'My handle is @anita and I followed you.',
  status: 'pending',
  review_reason: null,
  reviewed_by_admin_id: null,
  created_at: '2026-07-19T00:00:00.000Z',
  reviewed_at: null,
};

beforeEach(() => {
  clearSession();
  mockGet.mockReset();
  mockPost.mockReset();
  mockPatch.mockReset();
  mockGet.mockImplementation((url: string) => {
    if (url === '/admin/manual-offers') return ok([OFFER]);
    if (url === '/admin/manual-offer-submissions') return ok([SUBMISSION]);
    return ok([]);
  });
});

describe('Manual offers (admin)', () => {
  it('reviewer sees the review queue but NOT the manage-offers section (RBAC)', async () => {
    seedSession(reviewerAdmin);
    renderApp('/admin/manual-offers');

    expect(await screen.findByText('anita@cashraja.app')).toBeInTheDocument();
    expect(screen.getByText('Submission review')).toBeInTheDocument();
    // Manage section (super_admin-only) is absent for a reviewer.
    expect(screen.queryByText('Manage offers')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New offer' })).not.toBeInTheDocument();
  });

  it('super_admin sees the manage-offers section', async () => {
    seedSession(superAdmin);
    renderApp('/admin/manual-offers');

    expect(await screen.findByText('Manage offers')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New offer' })).toBeInTheDocument();
    // The offers table renders each offer's description (unique to this section).
    expect(await screen.findByText('Follow @cashraja')).toBeInTheDocument();
  });

  it('reviewer approves a submission (credits the reward)', async () => {
    mockPost.mockReturnValue(ok({ ...SUBMISSION, status: 'approved' }));
    seedSession(reviewerAdmin);
    renderApp('/admin/manual-offers');

    await screen.findByText('anita@cashraja.app');
    await userEvent.click(screen.getByRole('button', { name: 'Review' }));

    // Proof text is shown in the review modal.
    expect(
      await screen.findByText('My handle is @anita and I followed you.'),
    ).toBeInTheDocument();

    const approve = screen.getByRole('button', { name: /Approve & credit/ });
    await userEvent.click(approve);

    expect(await screen.findByText('Approved & credited')).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith('/admin/manual-offer-submissions/sub1/approve');
  });

  it('reviewer rejects a submission with a reason', async () => {
    mockPost.mockReturnValue(ok({ ...SUBMISSION, status: 'rejected', review_reason: 'Blurry' }));
    seedSession(reviewerAdmin);
    renderApp('/admin/manual-offers');

    await screen.findByText('anita@cashraja.app');
    await userEvent.click(screen.getByRole('button', { name: 'Review' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    await userEvent.type(screen.getByLabelText('Rejection reason'), 'Proof is not verifiable');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm reject' }));

    expect(await screen.findByText('Submission rejected')).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith('/admin/manual-offer-submissions/sub1/reject', {
      reason: 'Proof is not verifiable',
    });
  });

  it('super_admin creates a manual offer', async () => {
    mockPost.mockReturnValue(ok({ ...OFFER, id: 'mo2', title: 'Join Telegram' }));
    seedSession(superAdmin);
    renderApp('/admin/manual-offers');

    await screen.findByText('Manage offers');
    await userEvent.click(screen.getByRole('button', { name: 'New offer' }));

    await userEvent.type(screen.getByLabelText('Title'), 'Join Telegram');
    await userEvent.type(screen.getByLabelText('Description'), 'Join our channel');
    await userEvent.type(screen.getByLabelText('Instructions'), 'Tap the link and join');
    const reward = screen.getByLabelText('Coin reward');
    await userEvent.clear(reward);
    await userEvent.type(reward, '40');

    await userEvent.click(screen.getByRole('button', { name: 'Create offer' }));

    expect(await screen.findByText('Offer created')).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith('/admin/manual-offers', {
      title: 'Join Telegram',
      description: 'Join our channel',
      instructions: 'Tap the link and join',
      coin_reward: 40,
    });
  });

  it('instructions field renders a markdown toolbar + live preview (H7)', async () => {
    seedSession(superAdmin);
    renderApp('/admin/manual-offers');

    await screen.findByText('Manage offers');
    await userEvent.click(screen.getByRole('button', { name: 'New offer' }));

    // The formatting toolbar is present.
    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Numbered list' })).toBeInTheDocument();

    // Typing markdown updates the live preview: **bold** → <strong>.
    await userEvent.type(screen.getByLabelText('Instructions'), 'Use **NOW** today');
    const bold = await screen.findByText('NOW');
    expect(bold.tagName).toBe('STRONG');

    // The Code toolbar button inserts an inline-code span, rendered as <code>.
    await userEvent.click(screen.getByRole('button', { name: 'Code' }));
    const code = await screen.findByText('code');
    expect(code.tagName).toBe('CODE');
  });
});
