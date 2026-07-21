import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, renderApp, seedSession, superAdmin } from '../../test/utils';
import { ok } from '../../test/http';
import type { ConfigView } from '../../lib/api/types';

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

const CONFIG: ConfigView[] = [
  {
    key: 'coin_conversion',
    value: { coins_per_rupee: 100 },
    version: 3,
    updated_at: '2026-07-10T00:00:00.000Z',
  },
];

beforeEach(() => {
  clearSession();
  mockGet.mockReset();
  mockPatch.mockReset();
  mockGet.mockReturnValue(ok(CONFIG));
});

describe('Config screen', () => {
  it('lists config keys with their version', async () => {
    seedSession(superAdmin);
    renderApp('/config');

    expect(await screen.findByText('Coin Conversion')).toBeInTheDocument();
    expect(screen.getByText('v3')).toBeInTheDocument();
  });

  it('rejects invalid JSON and saves a valid object as a new version', async () => {
    mockPatch.mockReturnValue(ok({ ...CONFIG[0], version: 4 }));
    seedSession(superAdmin);
    renderApp('/config');

    await screen.findByText('Coin Conversion');
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));

    const editor = screen.getByLabelText('Value (JSON)');
    await userEvent.clear(editor);
    await userEvent.type(editor, '{{ not json');
    await userEvent.click(screen.getByRole('button', { name: 'Save new version' }));

    expect(await screen.findByText('Value must be valid JSON.')).toBeInTheDocument();
    expect(mockPatch).not.toHaveBeenCalled();

    await userEvent.clear(editor);
    await userEvent.type(editor, '{{"coins_per_rupee": 120}');
    await userEvent.click(screen.getByRole('button', { name: 'Save new version' }));

    expect(await screen.findByText('Config updated')).toBeInTheDocument();
    expect(mockPatch).toHaveBeenCalledWith('/admin/config/coin_conversion', {
      value: { coins_per_rupee: 120 },
    });
  });
});
