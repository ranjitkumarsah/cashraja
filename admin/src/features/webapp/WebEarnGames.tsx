import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flame, Clapperboard, Sparkles, Lock } from 'lucide-react';
import { webApi, webApiError } from '../webauth/web-api';
import { useToast } from '../../components/ui/Toast';

/** A rewarded-ad request — resolves true only if the user watched it through. */
type WatchAd = (seconds?: number) => Promise<boolean>;

function useInvalidateWallet() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['web', 'wallet'] });
    qc.invalidateQueries({ queryKey: ['web', 'me'] });
  };
}

/** Shared shell so every daily-reward card has the same look. */
function EarnCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-gold-400/15 text-gold-300">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-white">{title}</p>
          <p className="mt-0.5 text-sm text-indigo-200/70">{subtitle}</p>
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-full bg-gold-400 px-5 py-2.5 text-sm font-extrabold text-primary-950 hover:bg-gold-300 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/** Daily streak — one claim per day, gated by a rewarded ad. */
export function StreakCard({ watchAd }: { watchAd: WatchAd }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidateWallet = useInvalidateWallet();

  const q = useQuery({
    queryKey: ['web', 'streak'],
    queryFn: async () =>
      (await webApi.get('/streak')).data as {
        current_count: number;
        claimable_today: boolean;
        next_bonus: number;
      },
  });

  const claim = useMutation({
    mutationFn: async () =>
      (await webApi.post('/streak/claim')).data as {
        streak_count: number;
        coins_earned: number;
        new_balance: number;
      },
    onSuccess: (r) => {
      toast({
        title: `+${r.coins_earned.toLocaleString('en-IN')} coins!`,
        description: `Day ${r.streak_count} streak claimed 🔥`,
        variant: 'success',
      });
      qc.invalidateQueries({ queryKey: ['web', 'streak'] });
      invalidateWallet();
    },
    onError: (e) => toast({ title: webApiError(e, 'Could not claim. Try again.'), variant: 'error' }),
  });

  async function onClaim() {
    if (await watchAd()) claim.mutate();
  }

  const day = q.data?.current_count ?? 0;
  const bonus = q.data?.next_bonus ?? 0;

  return (
    <EarnCard
      icon={<Flame className="size-6" />}
      title="Daily streak"
      subtitle={day > 0 ? `You're on a ${day}-day streak. Keep it going!` : 'Claim every day to build your streak.'}
    >
      {q.isLoading ? (
        <p className="text-sm text-indigo-300/60">Loading…</p>
      ) : q.data?.claimable_today ? (
        <PrimaryButton onClick={onClaim} disabled={claim.isPending}>
          {claim.isPending ? 'Claiming…' : `Watch ad & claim +${bonus.toLocaleString('en-IN')}`}
        </PrimaryButton>
      ) : (
        <p className="rounded-lg bg-white/5 px-3 py-2 text-center text-sm font-medium text-indigo-200/80">
          Claimed today ✓ Come back tomorrow
        </p>
      )}
    </EarnCard>
  );
}

/** Watch & earn — a rewarded ad credits coins directly (daily cap + cooldown). */
export function WatchEarnCard({ watchAd }: { watchAd: WatchAd }) {
  const { toast } = useToast();
  const invalidateWallet = useInvalidateWallet();
  const [cooldown, setCooldown] = useState(0);

  const q = useQuery({
    queryKey: ['web', 'ads-reward-state'],
    queryFn: async () =>
      (await webApi.get('/ads/reward-state')).data as {
        daily_cap: number;
        rewards_remaining_today: number;
        cooldown_remaining_seconds: number;
        coins_per_view: number;
      },
  });

  // Sync + tick down the cooldown so the button re-enables on its own.
  useEffect(() => {
    setCooldown(q.data?.cooldown_remaining_seconds ?? 0);
  }, [q.data?.cooldown_remaining_seconds]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const reward = useMutation({
    mutationFn: async () =>
      (await webApi.post('/ads/reward')).data as {
        coins_earned: number;
        rewards_remaining_today: number;
        cooldown_seconds: number;
      },
    onSuccess: (r) => {
      toast({ title: `+${r.coins_earned.toLocaleString('en-IN')} coins!`, variant: 'success' });
      setCooldown(r.cooldown_seconds);
      q.refetch();
      invalidateWallet();
    },
    onError: (e) => toast({ title: webApiError(e, 'Could not credit. Try again.'), variant: 'error' }),
  });

  async function onWatch() {
    if (await watchAd()) reward.mutate();
  }

  const remainingToday = q.data?.rewards_remaining_today ?? 0;
  const perView = q.data?.coins_per_view ?? 0;
  const outOfWatches = remainingToday <= 0;

  return (
    <EarnCard
      icon={<Clapperboard className="size-6" />}
      title="Watch & earn"
      subtitle={
        outOfWatches
          ? "You've watched all of today's videos. Back tomorrow!"
          : `Watch a short video, earn coins. ${remainingToday} left today.`
      }
    >
      {q.isLoading ? (
        <p className="text-sm text-indigo-300/60">Loading…</p>
      ) : outOfWatches ? (
        <p className="rounded-lg bg-white/5 px-3 py-2 text-center text-sm font-medium text-indigo-200/80">
          Daily limit reached ✓
        </p>
      ) : cooldown > 0 ? (
        <PrimaryButton onClick={() => undefined} disabled>
          Next video in {cooldown}s…
        </PrimaryButton>
      ) : (
        <PrimaryButton onClick={onWatch} disabled={reward.isPending}>
          {reward.isPending ? 'Crediting…' : `Watch & earn +${perView.toLocaleString('en-IN')}`}
        </PrimaryButton>
      )}
    </EarnCard>
  );
}

/**
 * Scratch / Spin — two-step like the app: `roll` reserves the server-picked
 * prize (consumes the daily attempt), the user watches the ad, then `claim`
 * credits the reserved prize. Closing before claiming forfeits that prize.
 */
export function BonusCard({ kind, watchAd }: { kind: 'scratch' | 'spin'; watchAd: WatchAd }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidateWallet = useInvalidateWallet();
  const [pending, setPending] = useState<{ reservationId: string; prizeCoins: number } | null>(null);

  const meta =
    kind === 'scratch'
      ? { title: 'Scratch card', subtitle: 'Scratch to reveal a coin prize.', verb: 'Scratch', icon: '🎟️' }
      : { title: 'Spin the wheel', subtitle: 'Spin for a chance at big coins.', verb: 'Spin', icon: '🎡' };

  const q = useQuery({
    queryKey: ['web', 'bonus', kind],
    queryFn: async () =>
      (await webApi.get(`/bonus/${kind}`)).data as {
        attempts_remaining: number;
        attempts_per_day: number;
        unlocked: boolean;
      },
  });

  const roll = useMutation({
    mutationFn: async () =>
      (await webApi.post(`/bonus/${kind}/roll`)).data as {
        reservation_id: string;
        prize_coins: number;
        attempts_remaining: number;
      },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['web', 'bonus', kind] });
      if (r.prize_coins <= 0) {
        toast({ title: 'No win this time — try again tomorrow!', variant: 'info' });
        return;
      }
      setPending({ reservationId: r.reservation_id, prizeCoins: r.prize_coins });
      // Straight into the ad so the reserved prize gets collected.
      void collect(r.reservation_id, r.prize_coins);
    },
    onError: (e) => toast({ title: webApiError(e, `Could not ${meta.verb.toLowerCase()}. Try again.`), variant: 'error' }),
  });

  const claim = useMutation({
    mutationFn: async (reservationId: string) =>
      (await webApi.post(`/bonus/${kind}/claim`, { reservationId })).data as {
        prize_coins: number;
        new_balance: number;
      },
    onSuccess: (r) => {
      toast({ title: `You won +${r.prize_coins.toLocaleString('en-IN')} coins!`, variant: 'success' });
      setPending(null);
      invalidateWallet();
    },
    onError: (e) => {
      setPending(null);
      toast({ title: webApiError(e, 'Could not collect the prize.'), variant: 'error' });
    },
  });

  async function collect(reservationId: string, prizeCoins: number) {
    const watched = await watchAd();
    if (watched) {
      claim.mutate(reservationId);
    } else {
      // Forfeited — the roll already consumed the attempt (matches the app).
      setPending(null);
      toast({ title: `Ad skipped — ${prizeCoins} coins not collected.`, variant: 'info' });
    }
  }

  const busy = roll.isPending || claim.isPending || pending !== null;
  const locked = q.data && !q.data.unlocked;
  const attempts = q.data?.attempts_remaining ?? 0;

  return (
    <EarnCard icon={<span className="text-2xl">{meta.icon}</span>} title={meta.title} subtitle={meta.subtitle}>
      {q.isLoading ? (
        <p className="text-sm text-indigo-300/60">Loading…</p>
      ) : locked ? (
        <p className="flex items-center justify-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-center text-sm font-medium text-indigo-200/70">
          <Lock className="size-4" /> Keep earning to unlock
        </p>
      ) : attempts <= 0 ? (
        <p className="rounded-lg bg-white/5 px-3 py-2 text-center text-sm font-medium text-indigo-200/80">
          No {meta.verb.toLowerCase()}s left today — back tomorrow!
        </p>
      ) : (
        <>
          <PrimaryButton onClick={() => roll.mutate()} disabled={busy}>
            {busy ? 'Please wait…' : `${meta.verb} now (${attempts} left)`}
          </PrimaryButton>
          <p className="mt-2 text-center text-xs text-indigo-300/50">Watch a short ad to collect your prize.</p>
        </>
      )}
    </EarnCard>
  );
}

/** Section wrapper: the four ad-gated daily earns. */
export function DailyRewardsSection({ watchAd }: { watchAd: WatchAd }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-white">
        <Sparkles className="size-5 text-gold-300" /> Daily rewards
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <StreakCard watchAd={watchAd} />
        <WatchEarnCard watchAd={watchAd} />
        <BonusCard kind="scratch" watchAd={watchAd} />
        <BonusCard kind="spin" watchAd={watchAd} />
      </div>
    </section>
  );
}
