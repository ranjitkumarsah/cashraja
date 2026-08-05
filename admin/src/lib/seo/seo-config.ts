/**
 * Central SEO config for the PUBLIC marketing pages. Used by both the build-time
 * prerender (entry-server.tsx → scripts/prerender.mjs) and the client-side <Seo/>
 * component, so titles/meta/structured-data stay in one place. Plain TS (no JSX)
 * so the Node prerender can import it via the SSR bundle.
 */
export const SITE_URL = 'https://cashraja.graduatedcoder.in';
export const SITE_NAME = 'Cash Raja';
const OG_IMAGE = `${SITE_URL}/og-image.png`;

export interface PageSeo {
  path: string;
  title: string;
  description: string;
  /** Extra page-specific JSON-LD (Organization + WebSite are always included). */
  jsonLd?: Record<string, unknown>[];
}

// ── Sitewide structured data ────────────────────────────────────────────────
const organizationLd: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.svg`,
  email: 'support.cashraja@gmail.com',
  areaServed: 'IN',
};

const websiteLd: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  inLanguage: 'en-IN',
};

const softwareAppLd: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'MobileApplication',
  name: SITE_NAME,
  operatingSystem: 'ANDROID',
  applicationCategory: 'LifestyleApplication',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
  description:
    'Earn coins by playing games, completing offers and surveys, then redeem for Amazon, Flipkart and Google Play gift cards. For ages 18+ in India.',
};

const faqLd = (qa: [string, string][]): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: qa.map(([q, a]) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
});

// ── Per-page SEO ─────────────────────────────────────────────────────────────
export const PAGE_SEO: Record<string, PageSeo> = {
  '/': {
    path: '/',
    title: 'Cash Raja — Earn Free Gift Cards in India | Play, Earn & Redeem',
    description:
      'Earn coins by playing games, completing offers and surveys, then redeem for Amazon, Flipkart and Google Play gift cards. Free to join · for ages 18+ in India.',
    jsonLd: [softwareAppLd],
  },
  '/about': {
    path: '/about',
    title: 'About Cash Raja — India’s Play-and-Earn Rewards App',
    description:
      'Cash Raja is a free rewards app for India. Complete real tasks and offers to earn coins and redeem them for genuine digital gift cards. Learn how it works.',
  },
  '/faq': {
    path: '/faq',
    title: 'Cash Raja FAQ — How to Earn Coins & Redeem Gift Cards',
    description:
      'Answers to common questions about Cash Raja: how to earn coins, redeem Amazon/Flipkart/Google Play gift cards, referrals, payouts and eligibility (18+, India).',
    jsonLd: [
      faqLd([
        [
          'Is Cash Raja free to use?',
          'Yes. Cash Raja is completely free to join and use. You earn coins by completing offers, surveys, games and referrals, with no purchase required.',
        ],
        [
          'How do I redeem my coins?',
          'Once you have enough coins, open the Rewards store, pick a brand (Amazon, Flipkart or Google Play) and a denomination, and redeem. Gift-card codes are delivered in-app after review.',
        ],
        [
          'Who can use Cash Raja?',
          'Cash Raja is intended for users aged 18 and older in India. Coins have no cash value and are redeemable only for digital gift cards.',
        ],
      ]),
    ],
  },
  '/privacy': {
    path: '/privacy',
    title: 'Privacy Policy — Cash Raja',
    description:
      'How Cash Raja collects, uses and protects your data. Read our privacy policy for the Cash Raja rewards app and website.',
  },
  '/terms': {
    path: '/terms',
    title: 'Terms & Conditions — Cash Raja',
    description:
      'The terms of service for using Cash Raja. Coins have no cash value and are redeemable only for digital gift cards. For users aged 18 and older in India.',
  },
};

/** Public routes to statically prerender. */
export const PRERENDER_ROUTES = Object.keys(PAGE_SEO);

export function seoFor(path: string): PageSeo | null {
  return PAGE_SEO[path] ?? null;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Build the <head> tag string for a public page (used by the prerender). */
export function renderHead(seo: PageSeo): string {
  const canonical = SITE_URL + (seo.path === '/' ? '/' : seo.path);
  const tags: string[] = [
    `<title>${esc(seo.title)}</title>`,
    `<meta name="description" content="${esc(seo.description)}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    `<meta name="robots" content="index, follow" />`,
    `<link rel="alternate" hreflang="en-in" href="${canonical}" />`,
    `<link rel="alternate" hreflang="x-default" href="${canonical}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${esc(seo.title)}" />`,
    `<meta property="og:description" content="${esc(seo.description)}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    `<meta property="og:locale" content="en_IN" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(seo.title)}" />`,
    `<meta name="twitter:description" content="${esc(seo.description)}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE}" />`,
  ];
  const ld = [organizationLd, websiteLd, ...(seo.jsonLd ?? [])];
  for (const obj of ld) {
    tags.push(`<script type="application/ld+json">${JSON.stringify(obj)}</script>`);
  }
  return tags.join('\n    ');
}
