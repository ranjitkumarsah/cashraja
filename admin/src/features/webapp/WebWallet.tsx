import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { webApi } from '../webauth/web-api';

interface LedgerEntry {
  id: string;
  amount: number;
  source_type: string;
  balance_after: number;
  created_at: string;
}

const SOURCE_LABELS: Record<string, string> = {
  game: 'Game reward',
  offer: 'Offer',
  ad: 'Watched ad',
  referral: 'Referral bonus',
  redemption: 'Gift-card redemption',
  admin_adjustment: 'Adjustment',
  streak: 'Daily streak',
  bonus: 'Scratch / Spin',
};

function inr(n: number): string {
  return n.toLocaleString('en-IN');
}

export function WebWallet() {
  const wallet = useQuery({
    queryKey: ['web', 'wallet'],
    queryFn: async () => (await webApi.get('/wallet')).data as { coin_balance: number },
  });

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const first = useQuery({
    queryKey: ['web', 'ledger', 'first'],
    queryFn: async () => {
      const { data } = await webApi.get('/wallet/ledger', { params: { limit: 20 } });
      setEntries(data.entries ?? []);
      setCursor(data.next_cursor ?? null);
      setDone(!data.next_cursor);
      return data;
    },
  });

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const { data } = await webApi.get('/wallet/ledger', { params: { cursor, limit: 20 } });
      setEntries((e) => [...e, ...(data.entries ?? [])]);
      setCursor(data.next_cursor ?? null);
      setDone(!data.next_cursor);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="rounded-3xl bg-gradient-to-br from-indigo-600/40 to-primary-900 p-6 shadow-xl">
        <p className="text-sm text-indigo-200/80">Coin balance</p>
        <p className="coin-num mt-1 text-4xl font-extrabold text-gold-300">
          {wallet.data ? inr(wallet.data.coin_balance) : '…'}
        </p>
      </div>

      <h2 className="mt-6 mb-2 text-lg font-bold text-white">History</h2>
      {first.isLoading ? (
        <p className="py-8 text-center text-sm text-indigo-300/70">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-indigo-300/70">
          No activity yet. Earn some coins and it'll show up here.
        </p>
      ) : (
        <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 bg-white/[0.02] px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {SOURCE_LABELS[e.source_type] ?? e.source_type}
                </p>
                <p className="text-xs text-indigo-300/60">
                  {new Date(e.created_at).toLocaleString('en-IN')}
                </p>
              </div>
              <span
                className={
                  'coin-num shrink-0 text-sm font-extrabold ' +
                  (e.amount >= 0 ? 'text-emerald-400' : 'text-red-400')
                }
              >
                {e.amount >= 0 ? '+' : ''}
                {inr(e.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!done && entries.length > 0 && (
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
