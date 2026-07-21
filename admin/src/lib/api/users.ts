import { api } from './client';
import type {
  AdjustBalanceRequest,
  AdjustBalanceResult,
  AdminUserDetail,
  AdminUserListPage,
  LedgerPageView,
} from './types';

export interface UserListParams {
  status?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

/** GET /api/admin/users — searchable, filterable, cursor-paginated. */
export async function listUsers(params: UserListParams): Promise<AdminUserListPage> {
  const { data } = await api.get<AdminUserListPage>('/admin/users', { params });
  return data;
}

/** GET /api/admin/users/:id — detail with devices + fraud flags. */
export async function getUser(id: string): Promise<AdminUserDetail> {
  const { data } = await api.get<AdminUserDetail>(`/admin/users/${id}`);
  return data;
}

/** GET /api/admin/users/:id/ledger — keyset-paginated coin ledger. */
export async function getUserLedger(id: string, cursor?: string): Promise<LedgerPageView> {
  const { data } = await api.get<LedgerPageView>(`/admin/users/${id}/ledger`, {
    params: cursor ? { cursor } : {},
  });
  return data;
}

/** POST /api/admin/users/:id/adjust-balance (super_admin). */
export async function adjustBalance(
  id: string,
  body: AdjustBalanceRequest,
): Promise<AdjustBalanceResult> {
  const { data } = await api.post<AdjustBalanceResult>(`/admin/users/${id}/adjust-balance`, body);
  return data;
}

/** POST /api/admin/users/:id/ban (super_admin). */
export async function banUser(id: string, reason?: string): Promise<AdminUserDetail> {
  const { data } = await api.post<AdminUserDetail>(`/admin/users/${id}/ban`, { reason });
  return data;
}

/** POST /api/admin/users/:id/unban (super_admin). */
export async function unbanUser(id: string, reason?: string): Promise<AdminUserDetail> {
  const { data } = await api.post<AdminUserDetail>(`/admin/users/${id}/unban`, { reason });
  return data;
}
