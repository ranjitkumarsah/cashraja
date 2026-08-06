import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Shared building blocks for the SEO marketing/content pages. */

export function Lead({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-ink-muted">{children}</p>;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-ink-muted">{children}</div>
    </section>
  );
}

export function InternalLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="font-semibold text-primary-600 hover:underline">
      {children}
    </Link>
  );
}

export function GetStartedCta({
  heading = 'Start earning today',
  sub = 'Free to join · for ages 18+ in India.',
}: {
  heading?: string;
  sub?: string;
}) {
  return (
    <div className="mt-12 rounded-2xl border border-edge bg-surface-muted p-6 text-center">
      <h2 className="text-lg font-bold text-ink">{heading}</h2>
      <p className="mt-1 text-sm text-ink-muted">{sub}</p>
      <Link
        to="/login"
        className="mt-4 inline-flex rounded-full bg-primary-600 px-6 py-2.5 text-sm font-extrabold text-white hover:bg-primary-500"
      >
        Get started
      </Link>
    </div>
  );
}
