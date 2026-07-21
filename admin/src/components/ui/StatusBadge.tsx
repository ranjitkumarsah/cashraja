import { Badge, type BadgeProps } from './Badge';
import { humanize } from '../../lib/format';

type Variant = NonNullable<BadgeProps['variant']>;

/** Consistent status → colour mapping across every screen. */
const STATUS_VARIANT: Record<string, Variant> = {
  // users
  active: 'success',
  flagged: 'gold',
  banned: 'danger',
  // redemptions
  requested: 'neutral',
  under_review: 'gold',
  approved: 'indigo',
  rejected: 'danger',
  issued: 'success',
  // inventory
  unused: 'success',
  reserved: 'gold',
  // fraud
  open: 'gold',
  resolved: 'success',
  // admins
  disabled: 'danger',
  // severity
  low: 'neutral',
  medium: 'gold',
  high: 'danger',
  critical: 'danger',
  // postbacks
  credited: 'success',
  pending: 'gold',
  duplicate: 'neutral',
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const variant = STATUS_VARIANT[status.toLowerCase()] ?? 'neutral';
  return <Badge variant={variant}>{label ?? humanize(status)}</Badge>;
}
