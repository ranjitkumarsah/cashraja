import { api } from './client';
import type { AdminRedemptionPage, ApproveResult } from './types';

export interface RedemptionListParams {
  status?: string;
  cursor?: string;
  limit?: number;
}

/** GET /api/admin/redemptions — the review queue, cursor-paginated. */
export async function listRedemptions(
  params: RedemptionListParams,
): Promise<AdminRedemptionPage> {
  const { data } = await api.get<AdminRedemptionPage>('/admin/redemptions', { params });
  return data;
}

/** POST /api/admin/redemptions/:id/approve. */
export async function approveRedemption(id: string): Promise<ApproveResult> {
  const { data } = await api.post<ApproveResult>(`/admin/redemptions/${id}/approve`);
  return data;
}

/** POST /api/admin/redemptions/:id/reject. */
export async function rejectRedemption(id: string, reason: string): Promise<unknown> {
  const { data } = await api.post(`/admin/redemptions/${id}/reject`, { reason });
  return data;
}

/** GET /api/admin/redemptions/export — CSV payout export. */
export async function exportRedemptions(status?: string): Promise<string> {
  const { data } = await api.get<string>('/admin/redemptions/export', {
    params: status ? { status } : {},
    responseType: 'text',
  });
  return data;
}
