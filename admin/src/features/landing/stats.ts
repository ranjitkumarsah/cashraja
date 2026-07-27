/** Headline stats shown on the marketing landing page.
 *
 *  These are PLACEHOLDER values for the pre-launch site. They are intentionally
 *  static and rounded so the numbers read as "so far" figures, not live counts.
 *
 *  // TODO: wire to GET /api/public/stats in Phase F (backend is off-limits this
 *  //       task, so no network call yet — a public, unauthenticated aggregate
 *  //       endpoint returns these three figures once it exists).
 */

export interface LandingStat {
  label: string;
  /** Pre-formatted display value (grouping/units already applied). */
  value: string;
}

export function getLandingStats(): LandingStat[] {
  return [
    { label: 'Total players', value: '50,000+' },
    { label: 'Daily active users', value: '8,200+' },
    { label: 'Rewards paid', value: '₹12,00,000+' },
  ];
}
