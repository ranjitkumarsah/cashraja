import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { CoinMark } from '../../components/CoinMark';
import { webApi } from './web-api';
import { isWebAuthed, webSignOut } from './web-auth';

/**
 * Minimal signed-in web home (phase W2). Confirms the auth loop works end-to-end
 * and shows the coin balance. Earn / wallet / rewards screens land in W3–W4.
 */
export function WebHome() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState<number | null>(null);
  const [name, setName] = useState<string>('');

  useEffect(() => {
    let alive = true;
    webApi
      .get('/wallet')
      .then((r) => {
        if (alive) setBalance((r.data?.coin_balance as number) ?? 0);
      })
      .catch(() => undefined);
    webApi
      .get('/me')
      .then((r) => {
        if (alive) setName((r.data?.display_name as string) ?? '');
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (!isWebAuthed()) return <Navigate to="/login" replace />;

  function signOut() {
    webSignOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="dark min-h-screen bg-primary-950 text-ink">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-primary-950/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4">
          <span className="flex items-center gap-2.5">
            <CoinMark className="size-8" />
            <span className="text-lg font-bold tracking-tight text-white">
              Cash <span className="text-gold-300">Raja</span>
            </span>
          </span>
          <button
            type="button"
            onClick={signOut}
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-indigo-200 transition-colors hover:bg-white/5"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="rounded-3xl bg-gradient-to-br from-indigo-600/40 to-primary-900 p-8 shadow-2xl">
          <p className="text-sm text-indigo-200">
            {name ? `Welcome, ${name.split(' ')[0]}` : 'Welcome'} 👋
          </p>
          <p className="mt-3 text-sm text-indigo-200/80">Coin balance</p>
          <p className="coin-num mt-1 text-5xl font-extrabold text-gold-300">
            {balance === null ? '…' : balance.toLocaleString('en-IN')}
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-bold text-white">Your web app is on the way 🚀</h2>
          <p className="mt-2 text-sm leading-relaxed text-indigo-200/80">
            Earning (offers, surveys, referrals), your wallet history and the rewards store are
            being built for the web right now. In the meantime, you're signed in and your balance
            is live.
          </p>
        </div>
      </main>
    </div>
  );
}
