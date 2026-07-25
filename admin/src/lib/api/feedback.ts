import { api } from './client';
import type { AdminFeedbackView } from './types';

/** GET /api/admin/feedback?status=open|in_review|resolved (reviewer-visible). */
export async function listFeedback(status?: string): Promise<AdminFeedbackView[]> {
  const { data } = await api.get<AdminFeedbackView[]>('/admin/feedback', {
    params: status ? { status } : {},
  });
  return data;
}

/** POST /api/admin/feedback/:id/reply. */
export async function replyFeedback(
  id: string,
  body: { reply: string },
): Promise<AdminFeedbackView> {
  const { data } = await api.post<AdminFeedbackView>(`/admin/feedback/${id}/reply`, body);
  return data;
}

/** POST /api/admin/feedback/:id/resolve. */
export async function resolveFeedback(id: string): Promise<AdminFeedbackView> {
  const { data } = await api.post<AdminFeedbackView>(`/admin/feedback/${id}/resolve`);
  return data;
}
