import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { CoinMark } from '../../components/CoinMark';
import { attest, authErrorMessage, isWebAuthed, signInWithGoogle } from './web-auth';

type Phase = 'signin' | 'attest';

/** Web user sign-in (`/login`): Google popup → 18+ attestation → /home. */
export function WebLoginPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('signin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dob, setDob] = useState('');
  const [referral, setReferral] = useState('');

  // Already signed in? Straight to the app.
  if (isWebAuthed() && phase === 'signin') {
    return <Navigate to="/home" replace />;
  }

  async function onGoogle() {
    setError(null);
    setBusy(true);
    try {
      const { needsAttestation } = await signInWithGoogle();
      if (needsAttestation) {
        setPhase('attest');
      } else {
        navigate('/home', { replace: true });
      }
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function onAttest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isAdult(dob)) {
      setError('You must be 18 or older to use Cash Raja.');
      return;
    }
    setBusy(true);
    try {
      await attest(dob, referral.trim() || undefined);
      navigate('/home', { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dark flex min-h-screen flex-col bg-primary-950 text-ink">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" aria-label="Cash Raja home">
          <CoinMark className="size-8" />
          <span className="text-lg font-bold tracking-tight text-white">
            Cash <span className="text-gold-300">Raja</span>
          </span>
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl">
          <CoinMark className="mx-auto size-16 drop-shadow-[0_4px_20px_rgba(245,197,24,0.35)]" />

          {phase === 'signin' ? (
            <>
              <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-white">
                Sign in to Cash Raja
              </h1>
              <p className="mt-2 text-sm text-indigo-200/80">
                Play, earn coins, and redeem real gift cards. Free · for ages 18 and older.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={onGoogle}
                className="mt-8 inline-flex w-full items-center justify-center gap-3 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-gray-800 shadow-lg transition-colors hover:bg-gray-100 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
              >
                <GoogleIcon />
                {busy ? 'Signing in…' : 'Continue with Google'}
              </button>
            </>
          ) : (
            <form onSubmit={onAttest} className="text-left">
              <h1 className="mt-6 text-center text-2xl font-extrabold tracking-tight text-white">
                One quick step
              </h1>
              <p className="mt-2 text-center text-sm text-indigo-200/80">
                Confirm your date of birth (18+) to finish setting up your account.
              </p>
              <label className="mt-6 block text-xs font-semibold uppercase tracking-wide text-indigo-300">
                Date of birth
              </label>
              <input
                type="date"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-gold-400"
              />
              <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-indigo-300">
                Referral code (optional)
              </label>
              <input
                type="text"
                value={referral}
                onChange={(e) => setReferral(e.target.value)}
                placeholder="Enter a friend's code"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-indigo-300/40 outline-none focus:border-gold-400"
              />
              <button
                type="submit"
                disabled={busy}
                className="mt-6 w-full rounded-xl bg-gold-400 px-5 py-3.5 text-sm font-extrabold text-primary-950 shadow-lg transition-colors hover:bg-gold-300 disabled:opacity-60"
              >
                {busy ? 'Finishing…' : 'Continue'}
              </button>
            </form>
          )}

          {error && (
            <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300">
              {error}
            </p>
          )}

          <p className="mt-6 text-xs leading-relaxed text-indigo-300/70">
            By continuing you agree to our{' '}
            <Link to="/terms" className="text-gold-300 hover:underline">
              Terms
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-gold-300 hover:underline">
              Privacy Policy
            </Link>
            . Coins have no cash value.
          </p>
        </div>
      </main>
    </div>
  );
}

/** True when the ISO date (YYYY-MM-DD) is at least 18 years ago. */
function isAdult(iso: string): boolean {
  if (!iso) return false;
  const dob = new Date(iso);
  if (Number.isNaN(dob.getTime())) return false;
  const eighteen = new Date();
  eighteen.setFullYear(eighteen.getFullYear() - 18);
  return dob <= eighteen;
}

function GoogleIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
