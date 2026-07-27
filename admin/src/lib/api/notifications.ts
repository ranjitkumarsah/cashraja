import { api } from './client';
import type { BroadcastListResult, SendBroadcastRequest, SendBroadcastResult } from './types';

/** POST /api/admin/notifications/broadcast (super_admin) — compose + send. */
export async function sendBroadcast(body: SendBroadcastRequest): Promise<SendBroadcastResult> {
  const { data } = await api.post<SendBroadcastResult>('/admin/notifications/broadcast', body);
  return data;
}

/** GET /api/admin/notifications/broadcasts (super_admin) — recent history. */
export async function listBroadcasts(): Promise<BroadcastListResult> {
  const { data } = await api.get<BroadcastListResult>('/admin/notifications/broadcasts');
  return data;
}
