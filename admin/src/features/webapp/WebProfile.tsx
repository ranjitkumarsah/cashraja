import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { webApi } from '../webauth/web-api';
import { webSignOut } from '../webauth/web-auth';

export function WebProfile() {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const me = useQuery({
    queryKey: ['web', 'me'],
    queryFn: async () =>
      (await webApi.get('/me')).data as { display_name?: string; email?: string; referral_code?: string },
  });

  function signOut() {
    webSignOut();
    navigate('/login', { replace: true });
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      await webApi.delete('/account');
      webSignOut();
      navigate('/', { replace: true });
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold text-white">Profile</h1>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-lg font-bold text-white">{me.data?.display_name || '—'}</p>
        <p className="text-sm text-indigo-200/70">{me.data?.email || ''}</p>
        {me.data?.referral_code && (
          <p className="coin-num mt-3 text-sm text-gold-300">
            Referral code: <span className="font-extrabold">{me.data.referral_code}</span>
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <Link to="/terms" className="block bg-white/[0.02] px-4 py-3 text-sm text-indigo-100 hover:bg-white/5">
          Terms &amp; Conditions
        </Link>
        <Link to="/privacy" className="block border-t border-white/5 bg-white/[0.02] px-4 py-3 text-sm text-indigo-100 hover:bg-white/5">
          Privacy Policy
        </Link>
        <a
          href="mailto:support.cashraja@gmail.com"
          className="block border-t border-white/5 bg-white/[0.02] px-4 py-3 text-sm text-indigo-100 hover:bg-white/5"
        >
          Contact support
        </a>
      </div>

      <button
        type="button"
        onClick={signOut}
        className="w-full rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-indigo-100 hover:bg-white/5"
      >
        Sign out
      </button>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full text-center text-xs font-medium text-red-400/80 hover:text-red-300"
        >
          Delete my account
        </button>
      ) : (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-4 text-center">
          <p className="text-sm text-red-200">
            This permanently deletes your account. Coins and history cannot be recovered.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex-1 rounded-lg border border-white/15 py-2 text-sm font-semibold text-indigo-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={deleteAccount}
              className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-60"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
