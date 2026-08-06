import { Link, useParams } from 'react-router-dom';
import { ContentPage } from '../public/ContentPage';
import { GetStartedCta } from '../public/marketing';
import { blogPostBySlug } from './posts-meta';
import { POST_BODIES } from './posts-content';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** Renders a single blog article by slug (works under StaticRouter for prerender). */
export function BlogPostPage() {
  const { slug = '' } = useParams();
  const post = blogPostBySlug(slug);
  const body = POST_BODIES[slug];

  if (!post || !body) {
    return (
      <ContentPage>
        <h1 className="text-2xl font-bold text-ink">Article not found</h1>
        <p className="mt-3 text-ink-muted">
          This guide doesn&apos;t exist. Browse all{' '}
          <Link to="/blog" className="font-semibold text-primary-600 hover:underline">
            guides
          </Link>
          .
        </p>
      </ContentPage>
    );
  }

  return (
    <ContentPage>
      <article className="max-w-none">
        <nav className="mb-4 text-sm">
          <Link to="/blog" className="font-semibold text-primary-600 hover:underline">
            ← All guides
          </Link>
        </nav>
        <h1 className="text-3xl font-bold tracking-tight text-ink">{post.h1}</h1>
        <p className="mt-2 text-xs text-ink-faint">
          {fmtDate(post.date)} · {post.readingMinutes} min read
        </p>
        <div className="mt-6">{body}</div>
        <GetStartedCta />
      </article>
    </ContentPage>
  );
}
