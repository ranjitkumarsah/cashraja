import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SeoManager } from './lib/seo/SeoManager';
import { AppShell } from './components/layout/AppShell';
import { RedirectIfAuthed, RequireAuth, RequireRole } from './components/guards';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './lib/auth/auth-context';
import { ThemeProvider } from './lib/theme/theme-context';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { UsersPage } from './features/users/UsersPage';
import { RedemptionsPage } from './features/redemptions/RedemptionsPage';
import { FraudPage } from './features/fraud/FraudPage';
import { FeedbackPage } from './features/feedback/FeedbackPage';
import { OffersPage } from './features/offers/OffersPage';
import { ManualOffersPage } from './features/manual-offers/ManualOffersPage';
import { InventoryPage } from './features/inventory/InventoryPage';
import { ConfigPage } from './features/config/ConfigPage';
import { AdminsPage } from './features/admins/AdminsPage';
import { NotificationsPage } from './features/notifications/NotificationsPage';
import { PublicLayout } from './features/public/PublicLayout';
// Web user app — lazy-loaded so the marketing pages don't ship Firebase + the
// signed-in app in the initial bundle (keeps public Core Web Vitals fast).
const WebLoginPage = lazy(() =>
  import('./features/webauth/WebLoginPage').then((m) => ({ default: m.WebLoginPage })),
);
const WebRequireAuth = lazy(() =>
  import('./features/webapp/WebAppLayout').then((m) => ({ default: m.WebRequireAuth })),
);
const WebAppLayout = lazy(() =>
  import('./features/webapp/WebAppLayout').then((m) => ({ default: m.WebAppLayout })),
);
const WebHome = lazy(() => import('./features/webapp/WebHome').then((m) => ({ default: m.WebHome })));
const WebEarn = lazy(() => import('./features/webapp/WebEarn').then((m) => ({ default: m.WebEarn })));
const WebWallet = lazy(() =>
  import('./features/webapp/WebWallet').then((m) => ({ default: m.WebWallet })),
);
const WebRewards = lazy(() =>
  import('./features/webapp/WebRewards').then((m) => ({ default: m.WebRewards })),
);
const WebProfile = lazy(() =>
  import('./features/webapp/WebProfile').then((m) => ({ default: m.WebProfile })),
);
const WebInbox = lazy(() =>
  import('./features/webapp/WebInbox').then((m) => ({ default: m.WebInbox })),
);
import { LandingPage } from './features/landing/LandingPage';
import { PrivacyPage } from './features/public/PrivacyPage';
import { TermsPage } from './features/public/TermsPage';
import { AboutPage } from './features/public/AboutPage';
import { FaqPage } from './features/public/FaqPage';
import { HowToEarnPage } from './features/public/HowToEarnPage';
import { FreeGiftCardsPage } from './features/public/FreeGiftCardsPage';
import { EarnMoneyOnlinePage } from './features/public/EarnMoneyOnlinePage';
import { FreeAmazonGiftCardPage } from './features/public/FreeAmazonGiftCardPage';
import { FreeFlipkartGiftCardPage } from './features/public/FreeFlipkartGiftCardPage';
import { FreeGooglePlayGiftCardPage } from './features/public/FreeGooglePlayGiftCardPage';
import { ReferAndEarnPage } from './features/public/ReferAndEarnPage';
import { BlogIndexPage } from './features/blog/BlogIndexPage';
import { BlogPostPage } from './features/blog/BlogPostPage';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Public marketing site — no auth. */}
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="how-to-earn" element={<HowToEarnPage />} />
        <Route path="free-gift-cards" element={<FreeGiftCardsPage />} />
        <Route path="earn-money-online" element={<EarnMoneyOnlinePage />} />
        <Route path="free-amazon-gift-card" element={<FreeAmazonGiftCardPage />} />
        <Route path="free-flipkart-gift-card" element={<FreeFlipkartGiftCardPage />} />
        <Route path="free-google-play-gift-card" element={<FreeGooglePlayGiftCardPage />} />
        <Route path="refer-and-earn" element={<ReferAndEarnPage />} />
        <Route path="blog" element={<BlogIndexPage />} />
        <Route path="blog/:slug" element={<BlogPostPage />} />
        <Route path="faq" element={<FaqPage />} />
      </Route>

      {/* Web user app — Google sign-in + the signed-in, auth-gated experience. */}
      <Route path="login" element={<WebLoginPage />} />
      <Route element={<WebRequireAuth />}>
        <Route element={<WebAppLayout />}>
          <Route path="home" element={<WebHome />} />
          <Route path="earn" element={<WebEarn />} />
          <Route path="wallet" element={<WebWallet />} />
          <Route path="rewards" element={<WebRewards />} />
          <Route path="inbox" element={<WebInbox />} />
          <Route path="profile" element={<WebProfile />} />
        </Route>
      </Route>

      {/* Admin console — auth-gated, re-based under /admin. */}
      <Route path="admin">
        <Route element={<RedirectIfAuthed />}>
          <Route path="login" element={<LoginPage />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            {/* Dashboard is both the /admin index and /admin/dashboard (nav target). */}
            <Route index element={<DashboardPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="redemptions" element={<RedemptionsPage />} />
            <Route path="fraud" element={<FraudPage />} />
            <Route path="feedback" element={<FeedbackPage />} />
            <Route path="manual-offers" element={<ManualOffersPage />} />

            <Route element={<RequireRole role="super_admin" />}>
              <Route path="offers" element={<OffersPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="config" element={<ConfigPage />} />
              <Route path="admins" element={<AdminsPage />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <SeoManager />
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center bg-primary-950 text-sm text-indigo-300">
              Loading…
            </div>
          }
        >
          <AppRoutes />
        </Suspense>
      </AppProviders>
    </BrowserRouter>
  );
}
