import { useEffect } from 'react';
import { Home, Gift, Wallet, Sparkles, User, Bell } from 'lucide-react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CoinMark } from '../../components/CoinMark';
import { isWebAuthed } from '../webauth/web-auth';
import { webApi } from '../webauth/web-api';
import { HilltopBanner } from './HilltopBanner';
import { loadHilltopPopunder } from './hilltopads';
import { initWebPush } from './webPush';

/** Route guard for the signed-in web app. */
export function WebRequireAuth() {
  return isWebAuthed() ? <Outlet /> : <Navigate to="/login" replace />;
}

function InboxBell() {
  const unread = useQuery({
    queryKey: ['web', 'inbox', 'unread'],
    queryFn: async () =>
      ((await webApi.get('/notifications', { params: { limit: 1 } })).data?.unread_count as number) ??
      0,
    refetchInterval: 60_000,
  });
  const count = unread.data ?? 0;
  return (
    <NavLink to="/inbox" className="relative p-1.5 text-indigo-200 hover:text-white" aria-label="Notifications">
      <Bell className="size-6" />
      {count > 0 && (
        <span className="absolute right-0 top-0 flex min-w-4 items-center justify-center rounded-full bg-gold-400 px-1 text-[10px] font-extrabold text-primary-950">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </NavLink>
  );
}

const TABS = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/earn', label: 'Earn', icon: Sparkles },
  { to: '/wallet', label: 'Wallet', icon: Wallet },
  { to: '/rewards', label: 'Rewards', icon: Gift },
  { to: '/profile', label: 'Profile', icon: User },
] as const;

/**
 * Responsive shell for the signed-in web app: a slim top brand bar + a bottom
 * tab bar (thumb-friendly on mobile, centred on desktop). Pages render in the
 * scrollable area between them.
 */
export function WebAppLayout() {
  // Load the HilltopAds popunder once (signed-in app only). It opens on user
  // clicks incl. earn taps. No-op until the popunder tag is configured.
  useEffect(() => {
    loadHilltopPopunder();
    // Web push: refresh the FCM token if already permitted + listen for
    // foreground messages. No-op until VITE_FIREBASE_VAPID_KEY is set.
    void initWebPush();
  }, []);

  return (
    <div className="dark flex min-h-screen flex-col bg-primary-950 text-ink">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-primary-950/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
          <NavLink to="/home" className="flex items-center gap-2.5" aria-label="Cash Raja home">
            <CoinMark className="size-7" />
            <span className="text-base font-bold tracking-tight text-white">
              Cash <span className="text-gold-300">Raja</span>
            </span>
          </NavLink>
          <InboxBell />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-4">
        <Outlet />
        <div className="mt-6">
          <HilltopBanner />
        </div>
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-primary-950/95 backdrop-blur"
      >
        <div className="mx-auto flex w-full max-w-3xl items-stretch justify-around">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors ' +
                (isActive ? 'text-gold-300' : 'text-indigo-300/70 hover:text-white')
              }
            >
              <tab.icon className="size-5" aria-hidden="true" />
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
