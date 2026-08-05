import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gamepad2, X } from 'lucide-react';
import { webApi, webApiError } from '../webauth/web-api';
import { useToast } from '../../components/ui/Toast';

type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * Backend min-play-seconds per tier (game.min_play_seconds default: 10/20/30).
 * The round is rejected as `round_completed_too_fast` if completed sooner, so
 * the game holds the round open at least this long (+ a small buffer). The
 * reward is fixed per tier — taps make it fun but don't change the payout.
 */
const MIN_PLAY_SECONDS: Record<Difficulty, number> = { easy: 10, medium: 20, hard: 30 };
const BUFFER_SECONDS = 2;

const TIERS: { key: Difficulty; label: string; emoji: string }[] = [
  { key: 'easy', label: 'Easy', emoji: '🙂' },
  { key: 'medium', label: 'Medium', emoji: '😎' },
  { key: 'hard', label: 'Hard', emoji: '🔥' },
];

interface GameConfig {
  coins_per_round: Record<Difficulty, number>;
}

/** Card on the Earn page that launches the whack-a-coin game. */
export function GameCard() {
  const [open, setOpen] = useState(false);
  const config = useQuery({
    queryKey: ['web', 'game-config'],
    queryFn: async () => (await webApi.get('/game/config')).data as GameConfig,
  });

  const rewards = config.data?.coins_per_round;
  const maxReward = rewards ? Math.max(rewards.easy, rewards.medium, rewards.hard) : 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-gold-500/20 to-primary-900 p-5 text-left shadow-lg transition-transform hover:scale-[1.01]"
      >
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-gold-400/15 text-gold-300">
          <Gamepad2 className="size-7" />
        </span>
        <span className="min-w-0">
          <span className="block font-extrabold text-white">Play &amp; win</span>
          <span className="block text-sm text-indigo-200/80">
            Tap the coins to win up to {maxReward.toLocaleString('en-IN')} coins a round.
          </span>
        </span>
      </button>

      {open && rewards && (
        <GameModal rewards={rewards} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

type Phase = 'choose' | 'playing' | 'submitting' | 'done';

function GameModal({
  rewards,
  onClose,
}: {
  rewards: Record<Difficulty, number>;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>('choose');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [elapsed, setElapsed] = useState(0);
  const [score, setScore] = useState(0);
  const [cell, setCell] = useState(4);
  const [earned, setEarned] = useState(0);
  const roundIdRef = useRef<string | null>(null);

  const duration = MIN_PLAY_SECONDS[difficulty] + BUFFER_SECONDS;

  const start = useMutation({
    mutationFn: async (d: Difficulty) =>
      (await webApi.post('/game/round-start', { difficulty: d })).data as {
        round_id: string;
        daily_cap_remaining: number;
        reward_preview: number;
      },
    onSuccess: (r) => {
      roundIdRef.current = r.round_id;
      setElapsed(0);
      setScore(0);
      setPhase('playing');
    },
    onError: (e) => {
      toast({ title: webApiError(e, 'Could not start the game. Try again.'), variant: 'error' });
      onClose();
    },
  });

  const complete = useMutation({
    mutationFn: async (clientScore: number) =>
      (await webApi.post('/game/round-complete', {
        round_id: roundIdRef.current,
        client_score: clientScore,
      })).data as { coins_earned: number; new_balance: number; daily_cap_remaining: number },
    onSuccess: (r) => {
      setEarned(r.coins_earned);
      setPhase('done');
      qc.invalidateQueries({ queryKey: ['web', 'wallet'] });
      qc.invalidateQueries({ queryKey: ['web', 'me'] });
    },
    onError: (e) => {
      toast({ title: webApiError(e, 'Could not submit your round.'), variant: 'error' });
      onClose();
    },
  });

  // Game clock — ticks once a second while playing; auto-completes at duration.
  useEffect(() => {
    if (phase !== 'playing') return;
    if (elapsed >= duration) {
      setPhase('submitting');
      complete.mutate(score);
      return;
    }
    const t = window.setTimeout(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearTimeout(t);
    // score is intentionally read at completion time via the closure above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, elapsed, duration]);

  const tapCoin = useCallback(() => {
    setScore((s) => s + 1);
    setCell((c) => {
      let next = c;
      while (next === c) next = Math.floor(Math.random() * 9);
      return next;
    });
  }, []);

  const remaining = Math.max(0, duration - elapsed);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-primary-950">
      <div className="flex h-12 items-center justify-between border-b border-white/10 px-4">
        <span className="text-sm font-bold text-white">Play &amp; win</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close game"
          className="rounded-full border border-white/15 p-1 text-indigo-200 hover:bg-white/5"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center p-6">
        {phase === 'choose' && (
          <div className="w-full max-w-sm text-center">
            <h2 className="text-xl font-extrabold text-white">Choose a level</h2>
            <p className="mt-1 text-sm text-indigo-200/70">
              Tap the coin as many times as you can. Higher levels pay more.
            </p>
            <div className="mt-5 space-y-3">
              {TIERS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setDifficulty(t.key);
                    start.mutate(t.key);
                  }}
                  disabled={start.isPending}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-left hover:border-gold-400/40 disabled:opacity-50"
                >
                  <span className="flex items-center gap-3">
                    <span className="text-2xl">{t.emoji}</span>
                    <span className="font-bold text-white">{t.label}</span>
                    <span className="text-xs text-indigo-300/60">
                      {MIN_PLAY_SECONDS[t.key] + BUFFER_SECONDS}s
                    </span>
                  </span>
                  <span className="coin-num rounded-full bg-gold-400/15 px-3 py-1 text-sm font-extrabold text-gold-300">
                    +{rewards[t.key].toLocaleString('en-IN')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === 'playing' && (
          <div className="w-full max-w-sm">
            <div className="mb-4 flex items-center justify-between text-sm font-bold">
              <span className="text-indigo-200">
                Score: <span className="coin-num text-gold-300">{score}</span>
              </span>
              <span className="text-indigo-200">
                Time: <span className="coin-num text-white">{remaining}s</span>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 9 }, (_, i) => (
                <div
                  key={i}
                  className="flex aspect-square items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]"
                >
                  {i === cell && (
                    <button
                      type="button"
                      onClick={tapCoin}
                      aria-label="Tap the coin"
                      className="flex size-full items-center justify-center rounded-2xl bg-gold-400/20 text-4xl transition-transform active:scale-90"
                    >
                      🪙
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-indigo-300/50">
              Keep tapping — your coins are credited when the timer ends.
            </p>
          </div>
        )}

        {phase === 'submitting' && (
          <p className="text-sm font-medium text-indigo-200">Counting your coins…</p>
        )}

        {phase === 'done' && (
          <div className="text-center">
            <div className="text-6xl">🎉</div>
            <p className="mt-4 text-2xl font-extrabold text-white">
              +{earned.toLocaleString('en-IN')} coins
            </p>
            <p className="mt-1 text-sm text-indigo-200/70">Nice play! Come back for more.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 rounded-full bg-gold-400 px-8 py-2.5 text-sm font-extrabold text-primary-950 hover:bg-gold-300"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
