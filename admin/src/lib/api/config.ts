import { api } from './client';
import type { ConfigView } from './types';

/** GET /api/admin/config (super_admin) — current value per key. */
export async function listConfig(): Promise<ConfigView[]> {
  const { data } = await api.get<ConfigView[]>('/admin/config');
  return data;
}

/** PATCH /api/admin/config/:key (super_admin) — appends a new version. */
export async function updateConfig(
  key: string,
  value: Record<string, unknown>,
): Promise<ConfigView> {
  const { data } = await api.patch<ConfigView>(`/admin/config/${encodeURIComponent(key)}`, {
    value,
  });
  return data;
}
