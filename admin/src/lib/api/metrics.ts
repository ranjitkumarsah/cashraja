import { api } from './client';
import type { DashboardMetrics } from './types';

/** GET /api/admin/dashboard/metrics — current aggregates + recent snapshot series. */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const { data } = await api.get<DashboardMetrics>('/admin/dashboard/metrics');
  return data;
}
