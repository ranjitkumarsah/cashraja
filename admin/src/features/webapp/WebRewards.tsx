import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Check } from 'lucide-react';
import { webApi, webApiError } from '../webauth/web-api';

interface GiftCard {
  id: string;
  brand: string;
  denomination: number;
  coin_cost: number;
  available: number;
}
interface Redemption {
  id: string;
  coin_amount: number;
  status: string;
  created_at: string;
  rejection_reason?: string | null;
  gift_card?: { brand: string; denomination: number };
  /** Present (decrypted) only on the owner's issued redemption. */
  gift_card_code?: string | null;
}

/** Friendlier labels for the raw backend status strings. */
const STATUS_LABEL: Record<string, string> = {
  requested: 'Pending review',
  pending: 'Pending review',
  approved: 'Processing',
  issued: 'Delivered',
  rejected: 'Rejected',
};
const statusLabel = (s: string) => STATUS_LABEL[s] ?? s.replace(/_/g, ' ');

const BRANDS: Record<string, { label: string; color: string }> = {
  amazon: { label: 'Amazon', color: '#FF9900' },
  flipkart: { label: 'Flipkart', color: '#2874F0' },
  google_play: { label: 'Google Play', color: '#01875F' },
  googleplay: { label: 'Google Play', color: '#01875F' },
};
const brandLabel = (b: string) => BRANDS[b]?.label ?? b.replace(/_/g, ' ');
const brandColor = (b: string) => BRANDS[b]?.color ?? '#6366F1';
const inr = (n: number) => n.toLocaleString('en-IN');

export function WebRewards() {
  const qc = useQueryClient();
  const [brand, setBrand] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const cards = useQuery({
    queryKey: ['web', 'gift-cards'],
    queryFn: async () => (await webApi.get('/gift-cards')).data as GiftCard[],
  });
  const history = useQuery({
    queryKey: ['web', 'redemptions'],
    queryFn: async () => (await webApi.get('/redemptions/mine')).data as Redemption[],
  });

  const redeem = useMutation({
    mutationFn: async (giftCardId: string) =>
      (await webApi.post('/redemptions', { gift_card_id: giftCardId })).data,
    onSuccess: () => {
      setMsg({ ok: true, text: 'Redeemed! Check your rewards history for the status.' });
      qc.invalidateQueries({ queryKey: ['web', 'wallet'] });
      qc.invalidateQueries({ queryKey: ['web', 'redemptions'] });
      qc.invalidateQueries({ queryKey: ['web', 'gift-cards'] });
    },
    onError: (e) => setMsg({ ok: false, text: webApiError(e, 'Could not redeem right now.') }),
  });

  const byBrand = new Map<string, GiftCard[]>();
  for (const c of cards.data ?? []) {
    if (c.available <= 0) continue;
    (byBrand.get(c.brand) ?? byBrand.set(c.brand, []).get(c.brand)!).push(c);
  }
  const brands = [...byBrand.keys()];
  const denoms = (brand && byBrand.get(brand)) || [];

  return (
    <div>
      {msg && (
        <p
          className={
            'mb-4 rounded-lg px-3 py-2 text-sm font-medium ' +
            (msg.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300')
          }
        >
          {msg.text}
        </p>
      )}

      {!brand ? (
        <>
          <h1 className="mb-3 text-xl font-extrabold text-white">Redeem your coins</h1>
          {cards.isLoading ? (
            <p className="py-8 text-center text-sm text-indigo-300/70">Loading…</p>
          ) : brands.length === 0 ? (
            <p className="py-8 text-center text-sm text-indigo-300/70">
              No gift cards in stock right now. Please check back soon.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {brands.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => {
                    setBrand(b);
                    setMsg(null);
                  }}
                  className="flex aspect-[4/3] flex-col items-center justify-center rounded-2xl border border-white/10 p-4 font-extrabold text-white shadow-lg transition-transform hover:scale-[1.02]"
                  style={{ background: `linear-gradient(135deg, ${brandColor(b)}, #111827)` }}
                >
                  <span className="text-lg">{brandLabel(b)}</span>
                  <span className="mt-1 text-xs font-medium text-white/70">Gift card</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setBrand(null)}
            className="mb-3 text-sm font-semibold text-indigo-300 hover:text-white"
          >
            ← All brands
          </button>
          <h1 className="mb-3 text-xl font-extrabold text-white">{brandLabel(brand)}</h1>
          <div className="space-y-3">
            {denoms
              .slice()
              .sort((a, b) => a.denomination - b.denomination)
              .map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div>
                    <p className="text-lg font-extrabold text-white">₹{inr(c.denomination)}</p>
                    <p className="coin-num text-xs text-gold-300">{inr(c.coin_cost)} coins</p>
                  </div>
                  <button
                    type="button"
                    disabled={redeem.isPending}
                    onClick={() => redeem.mutate(c.id)}
                    className="rounded-full bg-gold-400 px-5 py-2 text-sm font-extrabold text-primary-950 hover:bg-gold-300 disabled:opacity-60"
                  >
                    {redeem.isPending ? '…' : 'Redeem'}
                  </button>
                </div>
              ))}
          </div>
        </>
      )}

      <h2 className="mt-8 mb-2 text-lg font-bold text-white">Your redemptions</h2>
      {history.data && history.data.length > 0 ? (
        <ul className="space-y-3">
          {history.data.map((r) => (
            <RedemptionRow key={r.id} r={r} />
          ))}
        </ul>
      ) : (
        <p className="py-4 text-sm text-indigo-300/60">No redemptions yet.</p>
      )}
    </div>
  );
}

function RedemptionRow({ r }: { r: Redemption }) {
  const [copied, setCopied] = useState(false);
  const isRejected = r.status === 'rejected';

  async function copy() {
    if (!r.gift_card_code) return;
    await navigator.clipboard.writeText(r.gift_card_code).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">
            {r.gift_card ? `${brandLabel(r.gift_card.brand)} ₹${inr(r.gift_card.denomination)}` : 'Gift card'}
          </p>
          <p className="text-xs text-indigo-300/60">
            {new Date(r.created_at).toLocaleDateString('en-IN')}
          </p>
        </div>
        <span
          className={
            'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ' +
            (r.status === 'issued'
              ? 'bg-emerald-500/15 text-emerald-300'
              : isRejected
                ? 'bg-red-500/15 text-red-300'
                : 'bg-white/10 text-indigo-200')
          }
        >
          {statusLabel(r.status)}
        </span>
      </div>

      {r.gift_card_code ? (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-indigo-300/70">Your gift card code</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 select-all break-all rounded-lg bg-primary-950/70 px-3 py-2 text-center text-base font-bold tracking-wide text-gold-300">
              {r.gift_card_code}
            </code>
            <button
              type="button"
              onClick={copy}
              aria-label="Copy code"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gold-400 px-3 py-2 text-sm font-extrabold text-primary-950 hover:bg-gold-300"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-indigo-300/50">
            Redeem it in your {r.gift_card ? brandLabel(r.gift_card.brand) : ''} account. Keep it private.
          </p>
        </div>
      ) : isRejected && r.rejection_reason ? (
        <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {r.rejection_reason}
        </p>
      ) : r.status !== 'issued' && !isRejected ? (
        <p className="mt-2 text-xs text-indigo-300/50">
          Your code will appear here once it's approved.
        </p>
      ) : null}
    </li>
  );
}
