import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { webApi } from '../webauth/web-api';
import { webSignOut } from '../webauth/web-auth';
import { enableWebPush, pushPermission, webPushConfigured } from './webPush';

export function WebProfile() {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pushState, setPushState] = useState(pushPermission());
  const [pushBusy, setPushBusy] = useState(false);

  async function enablePush() {
    setPushBusy(true);
    const result = await enableWebPush();
    setPushState(pushPermission());
    setPushBusy(false);
    if (result === 'granted') alert('Notifications enabled ✓');
    else if (result === 'denied')
      alert('Notifications are blocked. Enable them in your browser site settings, then try again.');
    else if (result === 'unsupported')
      alert("Push isn't supported here. Use normal Chrome/Edge (not an in-app browser like Instagram/Facebook).");
    else
      alert('Could not set up notifications. Open the browser console (F12) and share any red "[webpush]" error.');
  }

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

      {webPushConfigured && pushState !== 'unsupported' && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-xl bg-gold-400/15 text-gold-300">
              <Bell className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-white">Notifications</p>
              <p className="text-xs text-indigo-200/70">
                Get alerts for rewards, offers &amp; gift card codes.
              </p>
            </div>
          </div>
          {pushState === 'granted' ? (
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
                On
              </span>
              <button
                type="button"
                onClick={enablePush}
                disabled={pushBusy}
                className="text-xs font-semibold text-indigo-300 underline hover:text-white disabled:opacity-60"
              >
                {pushBusy ? '…' : 'Re-sync'}
              </button>
            </div>
          ) : pushState === 'denied' ? (
            <span className="shrink-0 rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-300">
              Blocked
            </span>
          ) : (
            <button
              type="button"
              onClick={enablePush}
              disabled={pushBusy}
              className="shrink-0 rounded-full bg-gold-400 px-4 py-2 text-sm font-extrabold text-primary-950 hover:bg-gold-300 disabled:opacity-60"
            >
              {pushBusy ? '…' : 'Enable'}
            </button>
          )}
        </div>
      )}

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
