import { api } from './client';
import type { FraudFlagView, FraudResolveAction } from './types';

/** GET /api/admin/fraud-flags?status=open|resolved (reviewer-visible). */
export async function listFraudFlags(status?: string): Promise<FraudFlagView[]> {
  const { data } = await api.get<FraudFlagView[]>('/admin/fraud-flags', {
    params: status ? { status } : {},
  });
  return data;
}

export interface ResolveFraudBody {
  action: FraudResolveAction;
  note?: string;
}

/** POST /api/admin/fraud-flags/:id/resolve. */
export async function resolveFraudFlag(
  id: string,
  body: ResolveFraudBody,
): Promise<FraudFlagView> {
  const { data } = await api.post<FraudFlagView>(`/admin/fraud-flags/${id}/resolve`, body);
  return data;
}
