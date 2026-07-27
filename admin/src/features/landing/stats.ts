import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../lib/api/base';

/** Headline stats shown on the marketing landing page.
 *
 *  Live figures from GET /api/public/stats (aggregate only, no PII). The hook
 *  returns `null` until loaded, and stays `null` if the request fails OR every
 *  figure is zero — so the landing shows REAL numbers or nothing at all, never
 *  fabricated ones. That keeps a brand-new, low-traffic site honest.
 */

export interface LandingStat {
  label: string;
  /** Pre-formatted display value (Indian grouping / ₹ already applied). */
  value: string;
}

interface PublicStats {
  total_users: number;
  daily_active_users: number;
  rewards_paid_rupees: number;
}

const inIN = new Intl.NumberFormat('en-IN');

function format(stats: PublicStats): LandingStat[] {
  return [
    { label: 'Total players', value: inIN.format(stats.total_users) },
    { label: 'Daily active users', value: inIN.format(stats.daily_active_users) },
    { label: 'Rewards paid', value: `₹${inIN.format(stats.rewards_paid_rupees)}` },
  ];
}

export function useLandingStats(): LandingStat[] | null {
  const [stats, setStats] = useState<LandingStat[] | null>(null);

  useEffect(() => {
    if (typeof fetch !== 'function') return;
    let alive = true;
    fetch(`${API_BASE_URL}/public/stats`, { headers: { Accept: 'application/json' } })
      .then((res) => (res.ok ? (res.json() as Promise<PublicStats>) : Promise.reject(res.status)))
      .then((data) => {
        if (!alive) return;
        const anyData =
          data.total_users + data.daily_active_users + data.rewards_paid_rupees > 0;
        setStats(anyData ? format(data) : null);
      })
      .catch(() => {
        if (alive) setStats(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  return stats;
}
