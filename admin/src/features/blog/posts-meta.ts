/**
 * Blog post metadata — plain TS (no JSX) so seo-config can import it to build
 * PAGE_SEO entries + BlogPosting schema without pulling React into the config.
 * The article bodies live in posts-content.tsx, keyed by slug.
 */
export interface BlogPostMeta {
  slug: string;
  /** Page <title>. */
  title: string;
  /** On-page H1. */
  h1: string;
  /** Meta description + og/twitter description. */
  description: string;
  /** Short teaser for the blog index cards. */
  excerpt: string;
  /** ISO date published. */
  date: string;
  /** ISO date last updated. */
  updated: string;
  readingMinutes: number;
  keywords: string[];
}

export const BLOG_POSTS: readonly BlogPostMeta[] = [
  {
    slug: 'how-to-earn-free-gift-cards-india-2026',
    title: 'How to Earn Free Gift Cards in India (2026) — Cash Raja',
    h1: 'How to Earn Free Gift Cards in India: 2026 Guide',
    description:
      'A practical 2026 guide to earning free Amazon, Flipkart and Google Play gift cards in India — offers, surveys, games and referrals, then redeem your coins.',
    excerpt:
      'The honest, practical way to earn free Amazon, Flipkart and Google Play gift cards in India this year.',
    date: '2026-08-06',
    updated: '2026-08-06',
    readingMinutes: 5,
    keywords: ['how to earn free gift cards in india', 'free amazon gift card', 'rewards app india'],
  },
  {
    slug: 'is-cash-raja-legit',
    title: 'Is Cash Raja Legit? An Honest Look — Cash Raja',
    h1: 'Is Cash Raja Legit? An Honest Look',
    description:
      'Is Cash Raja real or fake? An honest explanation of how the rewards app works, how rewards are verified, what you can redeem, and what it is not.',
    excerpt:
      'Real or fake? Exactly how Cash Raja works, how rewards are verified, and what it is not.',
    date: '2026-08-06',
    updated: '2026-08-06',
    readingMinutes: 4,
    keywords: ['is cash raja legit', 'is cash raja real or fake', 'cash raja review'],
  },
  {
    slug: 'best-ways-to-earn-coins-fast',
    title: 'Best Ways to Earn Coins Fast on Cash Raja — Cash Raja',
    h1: 'Best Ways to Earn Coins Fast on Cash Raja',
    description:
      'Tips to earn coins faster on Cash Raja: which offers and surveys pay best, using daily rewards and streaks, and inviting friends with refer and earn.',
    excerpt: 'Which offers pay best, how to use daily rewards, and how referrals speed things up.',
    date: '2026-08-06',
    updated: '2026-08-06',
    readingMinutes: 4,
    keywords: ['earn coins fast', 'best offers cash raja', 'refer and earn'],
  },
  {
    slug: 'how-to-redeem-coins-for-gift-cards',
    title: 'How to Redeem Coins for Gift Cards in India — Cash Raja',
    h1: 'How to Redeem Coins for Gift Cards on Cash Raja',
    description:
      'A simple guide to redeeming Cash Raja coins for Amazon, Flipkart and Google Play gift cards in India — how it works and how your code is delivered.',
    excerpt:
      'Turn coins into real gift cards — from picking a brand to getting your code, and how long it takes.',
    date: '2026-08-06',
    updated: '2026-08-06',
    readingMinutes: 4,
    keywords: ['how to redeem coins for gift cards', 'redeem gift cards india', 'cash raja rewards'],
  },
];

export function blogPostBySlug(slug: string): BlogPostMeta | null {
  return BLOG_POSTS.find((p) => p.slug === slug) ?? null;
}
