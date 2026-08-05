import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CoinMark } from '../../components/CoinMark';

/**
 * Web user sign-in (public route `/login`). The "Continue with Google" flow is
 * wired to Firebase web auth in phase W2 (needs the Firebase Web app config).
 * Until then the button shows a friendly status so the CTAs land on a real page.
 */
export function WebLoginPage() {
  const [status, setStatus] = useState<string | null>(null);

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
          <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-white">
            Sign in to Cash Raja
          </h1>
          <p className="mt-2 text-sm text-indigo-200/80">
            Play, earn coins, and redeem real gift cards. Free · for ages 18 and older.
          </p>

          <button
            type="button"
            onClick={() =>
              setStatus('Web sign-in is launching shortly. Thanks for your patience!')
            }
            className="mt-8 inline-flex w-full items-center justify-center gap-3 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-gray-800 shadow-lg transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          {status && (
            <p className="mt-4 rounded-lg bg-gold-400/10 px-3 py-2 text-xs font-medium text-gold-200">
              {status}
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
