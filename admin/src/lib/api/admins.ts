import { api } from './client';
import type { AdminRole, AdminView, CreateAdminResult } from './types';

/** GET /api/admin/admins (super_admin). */
export async function listAdmins(): Promise<AdminView[]> {
  const { data } = await api.get<AdminView[]>('/admin/admins');
  return data;
}

export interface CreateAdminBody {
  email: string;
  role: AdminRole;
}

/** POST /api/admin/admins (super_admin) — returns a one-time temp password. */
export async function createAdmin(body: CreateAdminBody): Promise<CreateAdminResult> {
  const { data } = await api.post<CreateAdminResult>('/admin/admins', body);
  return data;
}

/** POST /api/admin/admins/:id/disable (super_admin). */
export async function disableAdmin(id: string): Promise<AdminView> {
  const { data } = await api.post<AdminView>(`/admin/admins/${id}/disable`);
  return data;
}
