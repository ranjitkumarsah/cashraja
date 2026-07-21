import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, renderApp, seedSession, superAdmin } from '../../test/utils';
import { ok, fail } from '../../test/http';
import type { DashboardMetrics } from '../../lib/api/types';

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock('axios', () => {
  const instance = {
    get: mockGet,
    post: vi.fn(),
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

const METRICS: DashboardMetrics = {
  current: {
    dau: 1200,
    coins_issued: 45000,
    coins_redeemed: 12000,
    offer_completion_rate: 0.725,
    outstanding_liability: 8000,
  },
  series: [
    {
      captured_at: '2026-07-20T10:00:00.000Z',
      dau: 1100,
      coins_issued: 40000,
      coins_redeemed: 11000,
      offer_completion_rate: 0.7,
      outstanding_liability: 7500,
    },
  ],
};

beforeEach(() => {
  clearSession();
  mockGet.mockReset();
});

describe('Dashboard', () => {
  it('renders stat tiles from the metrics API', async () => {
    mockGet.mockReturnValue(ok(METRICS));
    seedSession(superAdmin);
    renderApp('/');

    expect(await screen.findByText('1,200')).toBeInTheDocument(); // DAU
    expect(screen.getByText('45,000')).toBeInTheDocument(); // coins issued
    expect(screen.getByText('12,000')).toBeInTheDocument(); // coins redeemed
    expect(screen.getByText('72.5%')).toBeInTheDocument(); // completion rate
    expect(mockGet).toHaveBeenCalledWith('/admin/dashboard/metrics');
  });

  it('shows an error panel when metrics fail', async () => {
    mockGet.mockReturnValue(fail(500, 'Metrics unavailable'));
    seedSession(superAdmin);
    renderApp('/');

    expect(await screen.findByText('Metrics unavailable', {}, { timeout: 4000 })).toBeInTheDocument();
  });
});
