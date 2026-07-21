import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
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
import { OffersPage } from './features/offers/OffersPage';
import { InventoryPage } from './features/inventory/InventoryPage';
import { ConfigPage } from './features/config/ConfigPage';
import { AdminsPage } from './features/admins/AdminsPage';

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
          <Route path="users" element={<UsersPage />} />
          <Route path="redemptions" element={<RedemptionsPage />} />
          <Route path="fraud" element={<FraudPage />} />

          <Route element={<RequireRole role="super_admin" />}>
            <Route path="offers" element={<OffersPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="config" element={<ConfigPage />} />
            <Route path="admins" element={<AdminsPage />} />
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
