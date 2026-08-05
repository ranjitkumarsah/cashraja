import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Check } from 'lucide-react';
import { webApi, webApiError } from '../webauth/web-api';

interface ManualOffer {
  id: string;
  title: string;
  description: string;
  instructions: string;
  coin_reward: number;
  my_submission_status?: string | null;
}

const SITE = 'https://cashraja.graduatedcoder.in';

export function WebEarn() {
  const [wallOpen, setWallOpen] = useState(false);
  const wall = useQuery({
    queryKey: ['web', 'playtime-wall'],
    queryFn: async () =>
      (await webApi.get('/playtime/web-wall')).data as { available: boolean; url: string | null },
  });
  const code = useQuery({
    queryKey: ['web', 'referral-code'],
    queryFn: async () => (await webApi.get('/referral/my-code')).data as { code: string },
  });
  const offers = useQuery({
    queryKey: ['web', 'manual-offers'],
    queryFn: async () => (await webApi.get('/manual-offers')).data as ManualOffer[],
  });

  const wallUrl = wall.data?.available ? wall.data.url : null;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold text-white">Earn coins</h1>

      {wallUrl && (
        <button
          type="button"
          onClick={() => setWallOpen(true)}
          className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-600/40 to-primary-900 p-5 text-left shadow-lg transition-transform hover:scale-[1.01]"
        >
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-gold-400/15 text-2xl">
            🎮
          </span>
          <span>
            <span className="block font-extrabold text-white">Play &amp; earn</span>
            <span className="block text-sm text-indigo-200/80">
              Install apps, play games and complete offers for coins.
            </span>
          </span>
        </button>
      )}

      {wallOpen && wallUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-primary-950">
          <div className="flex h-12 items-center justify-between border-b border-white/10 px-4">
            <span className="text-sm font-bold text-white">Play &amp; earn</span>
            <button
              type="button"
              onClick={() => setWallOpen(false)}
              className="rounded-full border border-white/15 px-3 py-1 text-sm font-semibold text-indigo-200 hover:bg-white/5"
            >
              Close
            </button>
          </div>
          <iframe
            title="Offerwall"
            src={wallUrl}
            className="min-h-0 flex-1 border-0"
            allow="clipboard-write"
          />
        </div>
      )}

      <ReferralCard code={code.data?.code} />

      <section>
        <h2 className="mb-2 text-lg font-bold text-white">Tasks &amp; offers</h2>
        {offers.isLoading ? (
          <p className="py-6 text-center text-sm text-indigo-300/70">Loading…</p>
        ) : (offers.data ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-indigo-300/70">
            No tasks right now. Check back soon — new offers are added regularly.
          </p>
        ) : (
          <div className="space-y-3">
            {(offers.data ?? []).map((o) => (
              <ManualOfferCard key={o.id} offer={o} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ReferralCard({ code }: { code?: string }) {
  const [copied, setCopied] = useState(false);
  const link = code ? `${SITE}/login?ref=${code}` : SITE;

  async function share() {
    const text = `Join Cash Raja and earn real gift cards! Use my code ${code}: ${link}`;
    if (navigator.share) {
      await navigator.share({ title: 'Cash Raja', text, url: link }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(text).catch(() => undefined);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <section className="rounded-2xl border border-gold-400/20 bg-gold-400/[0.06] p-5">
      <h2 className="text-lg font-bold text-white">Invite &amp; earn</h2>
      <p className="mt-1 text-sm text-indigo-200/80">
        Share your code — earn a bonus on your friends' earnings.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <code className="coin-num flex-1 rounded-lg bg-primary-950/60 px-3 py-2 text-center text-lg font-extrabold tracking-widest text-gold-300">
          {code ?? '…'}
        </code>
        <button
          type="button"
          onClick={share}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gold-400 px-4 py-2 text-sm font-extrabold text-primary-950 hover:bg-gold-300"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Copied' : 'Share'}
        </button>
      </div>
    </section>
  );
}

function ManualOfferCard({ offer }: { offer: ManualOffer }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [proof, setProof] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: async () =>
      (await webApi.post(`/manual-offers/${offer.id}/submit`, { proof_text: proof })).data,
    onSuccess: () => {
      setMsg('Submitted! Your proof is under review.');
      qc.invalidateQueries({ queryKey: ['web', 'manual-offers'] });
    },
    onError: (e) => setMsg(webApiError(e, 'Could not submit. Please try again.')),
  });

  const status = offer.my_submission_status;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-white">{offer.title}</p>
          {offer.description && (
            <p className="mt-0.5 text-sm text-indigo-200/70">{offer.description}</p>
          )}
        </div>
        <span className="coin-num shrink-0 rounded-full bg-gold-400/15 px-2.5 py-1 text-xs font-extrabold text-gold-300">
          +{offer.coin_reward.toLocaleString('en-IN')}
        </span>
      </div>

      {status ? (
        <p className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-xs font-medium capitalize text-indigo-200">
          Status: {status.replace(/_/g, ' ')}
        </p>
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 rounded-full border border-white/15 px-4 py-1.5 text-sm font-semibold text-indigo-200 hover:bg-white/5"
        >
          View &amp; submit proof
        </button>
      ) : (
        <div className="mt-3">
          {offer.instructions && (
            <p className="whitespace-pre-wrap rounded-lg bg-primary-950/50 p-3 text-sm text-indigo-100/90">
              {offer.instructions}
            </p>
          )}
          <textarea
            value={proof}
            onChange={(e) => setProof(e.target.value)}
            placeholder="Paste your proof (screenshot link, username, transaction id…)"
            rows={3}
            className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-indigo-300/40 outline-none focus:border-gold-400"
          />
          <button
            type="button"
            disabled={submit.isPending || proof.trim().length < 3}
            onClick={() => submit.mutate()}
            className="mt-2 rounded-full bg-gold-400 px-5 py-2 text-sm font-extrabold text-primary-950 hover:bg-gold-300 disabled:opacity-50"
          >
            {submit.isPending ? 'Submitting…' : 'Submit proof'}
          </button>
        </div>
      )}
      {msg && <p className="mt-2 text-xs font-medium text-gold-200">{msg}</p>}
    </div>
  );
}
