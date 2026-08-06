import { Link } from 'react-router-dom';
import { ContentPage } from '../public/ContentPage';
import { BLOG_POSTS } from './posts-meta';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** Blog index — lists the guide articles. */
export function BlogIndexPage() {
  return (
    <ContentPage>
      <h1 className="text-3xl font-bold tracking-tight text-ink">Cash Raja Blog &amp; Guides</h1>
      <p className="mt-3 text-ink-muted">
        Tips and honest guides on earning coins and redeeming free gift cards in India.
      </p>

      <div className="mt-8 space-y-4">
        {BLOG_POSTS.map((post) => (
          <Link
            key={post.slug}
            to={`/blog/${post.slug}`}
            className="block rounded-2xl border border-edge bg-surface-muted p-5 transition-colors hover:border-primary-500/40"
          >
            <h2 className="text-lg font-bold text-ink">{post.h1}</h2>
            <p className="mt-1 text-sm text-ink-muted">{post.excerpt}</p>
            <p className="mt-3 text-xs text-ink-faint">
              {fmtDate(post.date)} · {post.readingMinutes} min read
            </p>
          </Link>
        ))}
      </div>
    </ContentPage>
  );
}
