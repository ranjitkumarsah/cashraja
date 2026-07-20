import { LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../lib/auth/auth-context';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent } from '../../components/ui/Card';

/** Dashboard shell — charts arrive with the metrics API (C5.4). */
export function DashboardPage() {
  const { admin } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Welcome back{admin ? `, ${admin.email}` : ''}. Here is the state of the realm.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {['DAU', 'Coins issued', 'Coins redeemed', 'Liability'].map((label) => (
          <Card key={label}>
            <CardContent className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {label}
              </p>
              <p className="coin-num text-2xl font-bold text-ink">—</p>
              <p className="text-xs text-ink-faint">Awaiting metrics API</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-100 dark:bg-primary-900/50">
            <LayoutDashboard className="size-7 text-primary-700 dark:text-primary-300" />
          </span>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-ink">Charts land with the metrics API</h2>
            <p className="max-w-md text-sm text-ink-muted">
              DAU, coins issued vs redeemed, completion rates and outstanding liability will render
              here (Recharts) once C4 aggregates ship.
            </p>
          </div>
          <Badge variant="gold">Coming in Phase C</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
