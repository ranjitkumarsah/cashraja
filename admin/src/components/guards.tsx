import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../lib/auth/auth-context';
import type { AdminRole } from '../lib/api/types';
import { Card, CardContent } from './ui/Card';

/** Everything behind the shell requires a live admin session. */
export function RequireAuth() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

/** /login is pointless with a live session — bounce to the dashboard. */
export function RedirectIfAuthed() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

/** Role gate for super-admin-only sections (RBAC matrix §2.3). */
export function RequireRole({ role }: { role: AdminRole }) {
  const { admin } = useAuth();

  if (admin?.role !== role) {
    return (
      <Card className="mx-auto mt-16 max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <ShieldAlert className="size-10 text-danger-500" />
          <h2 className="text-lg font-semibold text-ink">Not authorized</h2>
          <p className="text-sm text-ink-muted">
            Your role does not have access to this section. Contact a super-admin if you believe
            this is a mistake.
          </p>
        </CardContent>
      </Card>
    );
  }
  return <Outlet />;
}
