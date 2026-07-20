import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type Variant = 'indigo' | 'gold' | 'success' | 'danger' | 'neutral';

const variants: Record<Variant, string> = {
  indigo: 'bg-primary-100 text-primary-900 dark:bg-primary-900/50 dark:text-primary-200',
  gold: 'bg-gold-100 text-gold-600 dark:bg-gold-900/60 dark:text-gold-300',
  success: 'bg-success-100 text-success-700 dark:bg-success-900/60 dark:text-success-500',
  danger: 'bg-danger-100 text-danger-700 dark:bg-danger-900/60 dark:text-danger-500',
  neutral: 'bg-surface-muted text-ink-muted',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({ variant = 'indigo', className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        variants[variant],
        className,
      )}
      {...rest}
    />
  );
}
