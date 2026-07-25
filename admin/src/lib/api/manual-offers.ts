import { api } from './client';
import type { AdminManualOfferSubmissionView, AdminManualOfferView } from './types';

// ── Offer management (super_admin) ──

/** GET /api/admin/manual-offers (reviewer-visible list; mutations super_admin). */
export async function listManualOffers(): Promise<AdminManualOfferView[]> {
  const { data } = await api.get<AdminManualOfferView[]>('/admin/manual-offers');
  return data;
}

export interface CreateManualOfferBody {
  title: string;
  description: string;
  instructions: string;
  coin_reward: number;
}

/** POST /api/admin/manual-offers (super_admin). */
export async function createManualOffer(
  body: CreateManualOfferBody,
): Promise<AdminManualOfferView> {
  const { data } = await api.post<AdminManualOfferView>('/admin/manual-offers', body);
  return data;
}

export interface UpdateManualOfferBody {
  is_active?: boolean;
  title?: string;
  description?: string;
  instructions?: string;
  coin_reward?: number;
}

/** PATCH /api/admin/manual-offers/:id (super_admin). */
export async function updateManualOffer(
  id: string,
  body: UpdateManualOfferBody,
): Promise<AdminManualOfferView> {
  const { data } = await api.patch<AdminManualOfferView>(`/admin/manual-offers/${id}`, body);
  return data;
}

// ── Submission review (reviewer + super_admin) ──

/** GET /api/admin/manual-offer-submissions?status= */
export async function listManualOfferSubmissions(
  status?: string,
): Promise<AdminManualOfferSubmissionView[]> {
  const { data } = await api.get<AdminManualOfferSubmissionView[]>(
    '/admin/manual-offer-submissions',
    { params: status ? { status } : {} },
  );
  return data;
}

/** POST /api/admin/manual-offer-submissions/:id/approve — credits the reward. */
export async function approveManualOfferSubmission(
  id: string,
): Promise<AdminManualOfferSubmissionView> {
  const { data } = await api.post<AdminManualOfferSubmissionView>(
    `/admin/manual-offer-submissions/${id}/approve`,
  );
  return data;
}

/** POST /api/admin/manual-offer-submissions/:id/reject — reason mandatory. */
export async function rejectManualOfferSubmission(
  id: string,
  body: { reason: string },
): Promise<AdminManualOfferSubmissionView> {
  const { data } = await api.post<AdminManualOfferSubmissionView>(
    `/admin/manual-offer-submissions/${id}/reject`,
    body,
  );
  return data;
}
