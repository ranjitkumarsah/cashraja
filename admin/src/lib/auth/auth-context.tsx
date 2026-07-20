import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { AdminSessionResult, AdminSummary } from '../api/types';
import { tokenStore, type StoredSession } from './token-store';

interface AuthContextValue {
  admin: AdminSummary | null;
  isAuthenticated: boolean;
  signIn: (result: AdminSessionResult) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function subscribe(listener: () => void): () => void {
  return tokenStore.subscribe(listener);
}

function getSnapshot(): StoredSession | null {
  return tokenStore.getSession();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const value = useMemo<AuthContextValue>(
    () => ({
      admin: session?.admin ?? null,
      isAuthenticated: session !== null,
      signIn: (result) => tokenStore.set({ token: result.access_token, admin: result.admin }),
      signOut: () => tokenStore.clear(),
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
