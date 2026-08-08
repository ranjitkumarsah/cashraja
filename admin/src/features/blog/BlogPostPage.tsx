import { Link, useParams } from 'react-router-dom';
import { ContentPage } from '../public/ContentPage';
import { GetStartedCta } from '../public/marketing';
import { BLOG_POSTS, blogPostBySlug } from './posts-meta';
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
        <RelatedGuides slug={slug} />
        <GetStartedCta />
      </article>
    </ContentPage>
  );
}

/**
 * Links every other guide from each post.
 *
 * Without this each post had exactly one inbound internal link (the /blog hub),
 * while every marketing page had one from the global nav and footer — so the
 * articles sat at the bottom of the internal link graph despite being the pages
 * meant to earn rankings. Derived from BLOG_POSTS, so new posts join the mesh
 * automatically rather than needing a hand-maintained list.
 */
function RelatedGuides({ slug }: { slug: string }) {
  const others = BLOG_POSTS.filter((p) => p.slug !== slug);
  if (others.length === 0) return null;

  return (
    <nav aria-labelledby="related-guides" className="mt-12 border-t border-edge pt-8">
      <h2 id="related-guides" className="text-lg font-bold text-ink">
        Related guides
      </h2>
      <ul className="mt-4 space-y-4">
        {others.map((p) => (
          <li key={p.slug}>
            <Link
              to={`/blog/${p.slug}`}
              className="font-semibold text-primary-600 hover:underline"
            >
              {p.h1}
            </Link>
            <p className="mt-1 text-sm text-ink-muted">{p.excerpt}</p>
          </li>
        ))}
      </ul>
    </nav>
  );
}
