import type { ReactNode } from 'react';

/** Shared container for the readable public content pages (privacy / terms /
 *  about / faq): centered column, comfortable measure, theme-aware surface. */
export function ContentPage({
  children,
  lastUpdated,
}: {
  children: ReactNode;
  lastUpdated?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      {children}
      {lastUpdated && <p className="mt-10 text-xs text-ink-faint">{lastUpdated}</p>}
    </div>
  );
}
