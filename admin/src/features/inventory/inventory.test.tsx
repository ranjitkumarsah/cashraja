import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, renderApp, seedSession, superAdmin } from '../../test/utils';
import { ok } from '../../test/http';
import type { InventoryItemView, StockLevel } from '../../lib/api/types';

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

const STOCK: StockLevel[] = [
  { brand: 'Amazon', denomination: 100, unused: 3, reserved: 1, issued: 20 }, // low stock
  { brand: 'Flipkart', denomination: 500, unused: 40, reserved: 0, issued: 5 },
];

const ITEM: InventoryItemView = {
  id: 'i1',
  brand: 'Amazon',
  denomination: 100,
  status: 'unused',
  code_masked: '****',
  redemption_id: null,
  created_at: '2026-07-01T00:00:00.000Z',
};

beforeEach(() => {
  clearSession();
  mockGet.mockReset();
  mockPost.mockReset();
  mockGet.mockImplementation((url: string) =>
    url.includes('/stock-levels') ? ok(STOCK) : ok([ITEM]),
  );
});

describe('Inventory screen', () => {
  it('shows stock levels and flags low stock', async () => {
    seedSession(superAdmin);
    renderApp('/inventory');

    expect(await screen.findByText('Amazon · ₹100')).toBeInTheDocument();
    expect(screen.getByLabelText('Low stock')).toBeInTheDocument();
  });

  it('uploads codes and reports the insert/skip result', async () => {
    mockPost.mockReturnValue(ok({ inserted: 2, skipped: 1, total_submitted: 3 }));
    seedSession(superAdmin);
    renderApp('/inventory');

    await screen.findByRole('heading', { name: 'Upload codes' });
    await userEvent.selectOptions(screen.getByLabelText('Brand'), 'amazon');
    await userEvent.type(screen.getByLabelText('Denomination (₹)'), '100');
    await userEvent.type(screen.getByLabelText('Codes'), 'AAA-1\nBBB-2\nCCC-3');
    await userEvent.click(screen.getByRole('button', { name: /Upload 3 codes/ }));

    expect(await screen.findByText('Codes uploaded')).toBeInTheDocument();
    // Brand is the lowercase enum value; codes are sent as the raw pasted string
    // (the backend splits/trims/dedupes server-side).
    expect(mockPost).toHaveBeenCalledWith('/admin/inventory', {
      brand: 'amazon',
      denomination: 100,
      codes: 'AAA-1\nBBB-2\nCCC-3',
    });
  });

  it('reveals a code behind an audited confirm', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/stock-levels')) return ok(STOCK);
      if (url.includes('/reveal')) return ok({ code: 'REAL-CODE-42', status: 'unused' });
      return ok([ITEM]);
    });
    seedSession(superAdmin);
    renderApp('/inventory');

    await userEvent.click(await screen.findByRole('button', { name: /Reveal/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Reveal code' }));

    expect(await screen.findByText('REAL-CODE-42')).toBeInTheDocument();
  });
});
