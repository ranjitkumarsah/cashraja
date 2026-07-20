import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Gift, Megaphone, Package, Settings, ShieldAlert, UserCog, Users } from 'lucide-react';
import { AppShell } from './components/layout/AppShell';
import { RedirectIfAuthed, RequireAuth, RequireRole } from './components/guards';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './lib/auth/auth-context';
import { ThemeProvider } from './lib/theme/theme-context';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { PlaceholderPage } from './features/placeholder/PlaceholderPage';

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
      <Route element={<RedirectIfAuthed />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route
            path="users"
            element={
              <PlaceholderPage
                title="Users"
                description="Search users, inspect ledgers, flag or ban, adjust balances."
                icon={Users}
              />
            }
          />
          <Route
            path="redemptions"
            element={
              <PlaceholderPage
                title="Redemptions"
                description="Review queue, approve or reject with reasons, export payouts."
                icon={Gift}
              />
            }
          />
          <Route
            path="fraud"
            element={
              <PlaceholderPage
                title="Fraud"
                description="Flag review queue, velocity signals and rule outcomes."
                icon={ShieldAlert}
              />
            }
          />

          <Route element={<RequireRole role="super_admin" />}>
            <Route
              path="offers"
              element={
                <PlaceholderPage
                  title="Offers"
                  description="Enable, disable and tune offers; inspect postback logs."
                  icon={Megaphone}
                />
              }
            />
            <Route
              path="inventory"
              element={
                <PlaceholderPage
                  title="Inventory"
                  description="Upload gift-card codes, watch stock levels, audit reveals."
                  icon={Package}
                />
              }
            />
            <Route
              path="config"
              element={
                <PlaceholderPage
                  title="Config"
                  description="Rates, caps, referral percentages and probability tables."
                  icon={Settings}
                />
              }
            />
            <Route
              path="admins"
              element={
                <PlaceholderPage
                  title="Admins"
                  description="Create and disable admin accounts, assign roles."
                  icon={UserCog}
                />
              }
            />
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
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  );
}
