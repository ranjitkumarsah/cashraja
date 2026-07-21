import type { ReactNode } from 'react';
import { AlertTriangle, Inbox } from 'lucide-react';
import { Spinner } from './ui/Spinner';
import { apiErrorMessage } from '../lib/api/client';

/** Centered loading state used inside cards/tables while a query resolves. */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-14 text-sm text-ink-muted">
      <Spinner className="size-5 text-primary-500" />
      {label}
    </div>
  );
}

/** Error panel with the server-supplied message when available. */
export function ErrorState({ error, fallback = 'Something went wrong.' }: {
  error: unknown;
  fallback?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-14 text-center">
      <AlertTriangle className="size-8 text-danger-500" />
      <p className="text-sm font-medium text-ink">{apiErrorMessage(error, fallback)}</p>
    </div>
  );
}

/** Friendly empty state. */
export function EmptyState({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-14 text-center">
      <Inbox className="size-8 text-ink-faint" />
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-muted">{description}</p>}
    </div>
  );
}
