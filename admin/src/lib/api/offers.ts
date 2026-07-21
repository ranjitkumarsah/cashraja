import { api } from './client';
import type { AdminOfferView, PostbackLogPage } from './types';

/** GET /api/admin/offers. */
export async function listOffers(): Promise<AdminOfferView[]> {
  const { data } = await api.get<AdminOfferView[]>('/admin/offers');
  return data;
}

export interface UpdateOfferBody {
  is_active?: boolean;
  coin_reward?: number;
}

/** PATCH /api/admin/offers/:id (super_admin). */
export async function updateOffer(id: string, body: UpdateOfferBody): Promise<AdminOfferView> {
  const { data } = await api.patch<AdminOfferView>(`/admin/offers/${id}`, body);
  return data;
}

/** GET /api/admin/postback-logs — cursor-paginated raw postback log. */
export async function listPostbackLogs(cursor?: string, limit?: number): Promise<PostbackLogPage> {
  const { data } = await api.get<PostbackLogPage>('/admin/postback-logs', {
    params: { ...(cursor ? { cursor } : {}), ...(limit ? { limit } : {}) },
  });
  return data;
}
