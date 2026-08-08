import { Link } from 'react-router-dom';

/**
 * Rendered for any URL that matches no route. The server returns HTTP 404 for
 * these paths (see backend/src/main.ts), so the page a visitor sees must match
 * that status — this replaced a redirect to `/`, which paired a 404 status with
 * homepage content and made every typo look like an indexable duplicate.
 */
export function NotFoundPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-24 text-center sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-widest text-gold-500">404</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Page not found</h1>
      <p className="mt-4 text-base text-muted">
        That page does not exist or has moved. It may have been a mistyped link.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/"
          className="rounded-xl bg-gold-400 px-5 py-3 text-sm font-semibold text-primary-950 transition hover:bg-gold-300"
        >
          Go to the homepage
        </Link>
        <Link
          to="/blog"
          className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold transition hover:bg-white/5"
        >
          Browse the guides
        </Link>
      </div>
    </div>
  );
}
