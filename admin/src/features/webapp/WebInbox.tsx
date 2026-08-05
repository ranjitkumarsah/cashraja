import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { webApi } from '../webauth/web-api';

interface Note {
  id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export function WebInbox() {
  const qc = useQueryClient();
  const [items, setItems] = useState<Note[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useQuery({
    queryKey: ['web', 'inbox', 'first'],
    queryFn: async () => {
      const { data } = await webApi.get('/notifications', { params: { limit: 20 } });
      setItems(data.notifications ?? []);
      setCursor(data.next_cursor ?? null);
      setDone(!data.next_cursor);
      return data;
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => webApi.post(`/notifications/${id}/read`),
    onMutate: (id) => {
      setItems((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['web', 'inbox', 'unread'] }),
  });

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const { data } = await webApi.get('/notifications', { params: { cursor, limit: 20 } });
      setItems((l) => [...l, ...(data.notifications ?? [])]);
      setCursor(data.next_cursor ?? null);
      setDone(!data.next_cursor);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-extrabold text-white">Notifications</h1>
      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-indigo-300/70">
          You're all caught up. Rewards and updates will show up here.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => !n.read && markRead.mutate(n.id)}
                className={
                  'flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors ' +
                  (n.read
                    ? 'border-white/10 bg-white/[0.02]'
                    : 'border-gold-400/25 bg-gold-400/[0.06]')
                }
              >
                <span
                  className={
                    'mt-1.5 size-2.5 shrink-0 rounded-full ' +
                    (n.read ? 'bg-transparent' : 'bg-gold-400')
                  }
                />
                <span className="min-w-0">
                  <span className="block font-bold text-white">{n.title}</span>
                  <span className="mt-0.5 block text-sm text-indigo-200/80">{n.body}</span>
                  <span className="mt-1 block text-xs text-indigo-300/50">
                    {new Date(n.created_at).toLocaleString('en-IN')}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!done && items.length > 0 && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="mx-auto mt-4 block rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-indigo-200 hover:bg-white/5 disabled:opacity-60"
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
