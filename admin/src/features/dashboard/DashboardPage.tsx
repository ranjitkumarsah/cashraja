import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Coins, Gift, TrendingUp, Users, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../../lib/auth/auth-context';
import { getDashboardMetrics } from '../../lib/api/metrics';
import type { MetricsSnapshotView } from '../../lib/api/types';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, LoadingState } from '../../components/QueryState';
import { formatNumber, formatPercent } from '../../lib/format';

const CHART = {
  issued: '#6366f1', // primary-500
  redeemed: '#d4af37', // gold-400
  dau: '#4f46e5', // primary-600
  liability: '#e11d48', // danger-500
  grid: 'var(--color-edge)',
  axis: 'var(--color-ink-faint)',
};

const dashboardKeys = { metrics: ['dashboard', 'metrics'] as const };

function StatTile({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
            <Icon className="size-4" aria-hidden="true" />
          </span>
        </div>
        <p className="coin-num text-2xl font-bold text-ink">{value}</p>
        {hint && <p className="text-xs text-ink-faint">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/** Short time label from a snapshot's captured_at ISO string. */
function tickLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardContent>
        <div className="h-64 w-full">{children}</div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { admin } = useAuth();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: dashboardKeys.metrics,
    queryFn: getDashboardMetrics,
  });

  const series: MetricsSnapshotView[] = data?.series ?? [];
  const chartData = series.map((s) => ({ ...s, t: tickLabel(s.captured_at) }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Welcome back${admin ? `, ${admin.email}` : ''}. Here is the state of the realm.`}
      />

      {isLoading ? (
        <Card>
          <CardContent>
            <LoadingState label="Loading metrics…" />
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent>
            <ErrorState error={error} fallback="Could not load dashboard metrics." />
          </CardContent>
        </Card>
      ) : (
        data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <StatTile label="DAU" value={formatNumber(data.current.dau)} icon={Users} hint="Last 24h" />
              <StatTile
                label="Coins issued"
                value={formatNumber(data.current.coins_issued)}
                icon={Coins}
                hint="All time"
              />
              <StatTile
                label="Coins redeemed"
                value={formatNumber(data.current.coins_redeemed)}
                icon={Gift}
                hint="All time"
              />
              <StatTile
                label="Completion rate"
                value={formatPercent(data.current.offer_completion_rate)}
                icon={TrendingUp}
                hint="Offers credited"
              />
              <StatTile
                label="Liability"
                value={formatNumber(data.current.outstanding_liability)}
                icon={Wallet}
                hint="Coins reserved"
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <ChartCard
                title="Coins issued vs redeemed"
                description="Recent snapshot series"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="t" stroke={CHART.axis} fontSize={11} tickLine={false} />
                    <YAxis stroke={CHART.axis} fontSize={11} tickLine={false} width={44} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="coins_issued"
                      name="Issued"
                      stroke={CHART.issued}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="coins_redeemed"
                      name="Redeemed"
                      stroke={CHART.redeemed}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Daily active users" description="Snapshot trend">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="dau-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART.dau} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={CHART.dau} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="t" stroke={CHART.axis} fontSize={11} tickLine={false} />
                    <YAxis stroke={CHART.axis} fontSize={11} tickLine={false} width={44} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="dau"
                      name="DAU"
                      stroke={CHART.dau}
                      strokeWidth={2}
                      fill="url(#dau-fill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title="Outstanding liability"
                description="Coins reserved but not yet settled"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="liability-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART.liability} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={CHART.liability} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="t" stroke={CHART.axis} fontSize={11} tickLine={false} />
                    <YAxis stroke={CHART.axis} fontSize={11} tickLine={false} width={44} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="outstanding_liability"
                      name="Liability"
                      stroke={CHART.liability}
                      strokeWidth={2}
                      fill="url(#liability-fill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Offer completion rate" description="Share of offers credited">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="t" stroke={CHART.axis} fontSize={11} tickLine={false} />
                    <YAxis
                      stroke={CHART.axis}
                      fontSize={11}
                      tickLine={false}
                      width={44}
                      domain={[0, 1]}
                      tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                    />
                    <Tooltip formatter={(v) => formatPercent(Number(v))} />
                    <Line
                      type="monotone"
                      dataKey="offer_completion_rate"
                      name="Completion"
                      stroke={CHART.issued}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </>
        )
      )}
    </div>
  );
}
