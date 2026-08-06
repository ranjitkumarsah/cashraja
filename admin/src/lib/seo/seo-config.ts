/**
 * Central SEO/AEO/GEO config for the PUBLIC marketing pages. Used by both the
 * build-time prerender (entry-server.tsx → scripts/prerender.mjs) and the
 * client-side <Seo/> component so titles/meta/structured-data stay in one place.
 * Plain TS (no JSX) so the Node prerender can import it via the SSR bundle.
 *
 * Covers: classic SEO (titles, canonical, hreflang, OG/Twitter, sitemap), a
 * linked entity graph for AEO/answer engines (@id-linked Organization ↔ WebSite
 * ↔ WebPage + BreadcrumbList + FAQ + HowTo), Local SEO (India geo signals,
 * en-IN), and GEO (clean factual content + llms.txt + AI-crawler-friendly).
 */
import { FAQ_ITEMS } from '../../features/landing/faq';

export const SITE_URL = 'https://cashraja.graduatedcoder.in';
export const SITE_NAME = 'Cash Raja';
const OG_IMAGE = `${SITE_URL}/og-image.png`;
const CONTACT_EMAIL = 'support.cashraja@gmail.com';
const THEME_COLOR = '#1e1b4b';
/** Bump when public content is meaningfully updated (feeds dateModified). */
const LAST_MODIFIED = '2026-08-06';

const ORG_ID = `${SITE_URL}/#organization`;
const SITE_ID = `${SITE_URL}/#website`;

export interface PageSeo {
  path: string;
  title: string;
  description: string;
  /** Short label for the breadcrumb trail (defaults to a trimmed title). */
  crumb?: string;
  /** Extra page-specific JSON-LD (Organization + WebSite + WebPage are always added). */
  jsonLd?: Record<string, unknown>[];
}

// ── Sitewide structured data (linked @id graph) ─────────────────────────────
const organizationLd: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': ORG_ID,
  name: SITE_NAME,
  alternateName: 'Cash Raja Rewards',
  url: SITE_URL,
  logo: {
    '@type': 'ImageObject',
    url: `${SITE_URL}/favicon.svg`,
    caption: SITE_NAME,
  },
  image: OG_IMAGE,
  description:
    'Cash Raja is a free rewards platform in India where users aged 18+ earn coins by completing offers, surveys and games, then redeem the coins for Amazon, Flipkart and Google Play gift cards.',
  email: CONTACT_EMAIL,
  foundingDate: '2025',
  areaServed: { '@type': 'Country', name: 'India' },
  knowsLanguage: ['en', 'hi'],
  contactPoint: {
    '@type': 'ContactPoint',
    email: CONTACT_EMAIL,
    contactType: 'customer support',
    areaServed: 'IN',
    availableLanguage: ['English', 'Hindi'],
  },
};

const websiteLd: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': SITE_ID,
  name: SITE_NAME,
  url: SITE_URL,
  description:
    'Earn free Amazon, Flipkart and Google Play gift cards in India — complete offers, surveys and games, then redeem your coins.',
  inLanguage: 'en-IN',
  publisher: { '@id': ORG_ID },
};

const softwareAppLd: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'MobileApplication',
  name: SITE_NAME,
  operatingSystem: 'ANDROID',
  applicationCategory: 'LifestyleApplication',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
  publisher: { '@id': ORG_ID },
  countriesSupported: 'IN',
  featureList: [
    'Earn coins by completing offers and surveys',
    'Play games and daily rewards',
    'Refer friends for bonus coins',
    'Redeem coins for Amazon, Flipkart and Google Play gift cards',
  ],
  description:
    'Earn coins by playing games, completing offers and surveys, then redeem for Amazon, Flipkart and Google Play gift cards. For ages 18+ in India.',
};

const faqLd = (items: readonly { q: string; a: string }[]): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map(({ q, a }) => ({
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
    crumb: 'Home',
    jsonLd: [softwareAppLd, faqLd(FAQ_ITEMS)],
  },
  '/how-to-earn': {
    path: '/how-to-earn',
    title: 'How to Earn Free Gift Cards in India — Cash Raja Guide',
    description:
      'Step-by-step guide to earning free Amazon, Flipkart and Google Play gift cards in India with Cash Raja: complete offers, surveys, games and referrals, then redeem your coins.',
    crumb: 'How to earn',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: 'How to earn free gift cards in India with Cash Raja',
        totalTime: 'PT5M',
        estimatedCost: { '@type': 'MonetaryAmount', currency: 'INR', value: '0' },
        step: [
          { '@type': 'HowToStep', name: 'Sign in with Google', text: 'Create your free account with Google — one account per person.' },
          { '@type': 'HowToStep', name: 'Earn coins', text: 'Complete offers, answer surveys, play games and refer friends to build your coin balance.' },
          { '@type': 'HowToStep', name: 'Redeem gift cards', text: 'Exchange your coins for Amazon, Flipkart or Google Play gift cards in the Rewards store.' },
        ],
      },
    ],
  },
  '/free-gift-cards': {
    path: '/free-gift-cards',
    title: 'Free Gift Cards in India (2026) — Amazon, Flipkart & Google Play | Cash Raja',
    description:
      'Get free Amazon, Flipkart and Google Play gift cards in India with Cash Raja. Earn coins by completing offers, surveys and games, then redeem for real digital gift cards. Free · 18+.',
    crumb: 'Free gift cards',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Gift cards you can redeem on Cash Raja in India',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Amazon Pay gift card' },
          { '@type': 'ListItem', position: 2, name: 'Flipkart gift card' },
          { '@type': 'ListItem', position: 3, name: 'Google Play gift card' },
        ],
      },
    ],
  },
  '/earn-money-online': {
    path: '/earn-money-online',
    title: 'Earn Money Online in India — Free Rewards & Earning App | Cash Raja',
    description:
      'Looking to earn online in India? Cash Raja is a free rewards app — complete offers, surveys and games to earn coins and redeem them for Amazon, Flipkart and Google Play gift cards. 18+.',
    crumb: 'Earn online',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: 'How to earn online in India with Cash Raja',
        step: [
          { '@type': 'HowToStep', name: 'Join free', text: 'Sign in with Google — no fee, no purchase, ages 18+.' },
          { '@type': 'HowToStep', name: 'Complete tasks', text: 'Do offers, surveys and games; every reward is verified on our servers.' },
          { '@type': 'HowToStep', name: 'Redeem rewards', text: 'Turn coins into Amazon, Flipkart or Google Play gift cards.' },
        ],
      },
    ],
  },
  '/about': {
    path: '/about',
    title: 'About Cash Raja — India’s Play-and-Earn Rewards App',
    description:
      'Cash Raja is a free rewards app for India. Complete real tasks and offers to earn coins and redeem them for genuine digital gift cards. Learn how it works.',
    crumb: 'About',
  },
  '/faq': {
    path: '/faq',
    title: 'Cash Raja FAQ — How to Earn Coins & Redeem Gift Cards in India',
    description:
      'Answers to common questions about Cash Raja: how to earn coins, redeem Amazon/Flipkart/Google Play gift cards, referrals, payouts and eligibility (18+, India).',
    crumb: 'FAQ',
    jsonLd: [faqLd(FAQ_ITEMS)],
  },
  '/privacy': {
    path: '/privacy',
    title: 'Privacy Policy — Cash Raja',
    description:
      'How Cash Raja collects, uses and protects your data. Read our privacy policy for the Cash Raja rewards app and website.',
    crumb: 'Privacy',
  },
  '/terms': {
    path: '/terms',
    title: 'Terms & Conditions — Cash Raja',
    description:
      'The terms of service for using Cash Raja. Coins have no cash value and are redeemable only for digital gift cards. For users aged 18 and older in India.',
    crumb: 'Terms',
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

/** WebPage node linking the page into the entity graph (freshness + AEO). */
function webPageLd(seo: PageSeo, canonical: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${canonical}#webpage`,
    url: canonical,
    name: seo.title,
    description: seo.description,
    inLanguage: 'en-IN',
    isPartOf: { '@id': SITE_ID },
    about: { '@id': ORG_ID },
    primaryImageOfPage: OG_IMAGE,
    datePublished: '2025-01-01',
    dateModified: LAST_MODIFIED,
  };
}

/** Home > Page breadcrumb trail (skipped on the home page itself). */
function breadcrumbLd(seo: PageSeo, canonical: string): Record<string, unknown> | null {
  if (seo.path === '/') return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: seo.crumb ?? seo.title, item: canonical },
    ],
  };
}

/** Build the <head> tag string for a public page (used by the prerender). */
export function renderHead(seo: PageSeo): string {
  const canonical = SITE_URL + (seo.path === '/' ? '/' : seo.path);
  const tags: string[] = [
    `<title>${esc(seo.title)}</title>`,
    `<meta name="description" content="${esc(seo.description)}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    // Let Google/AI engines use large image + full-length snippets.
    `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />`,
    `<meta name="author" content="${SITE_NAME}" />`,
    `<meta name="publisher" content="${SITE_NAME}" />`,
    // Local SEO — India targeting.
    `<meta name="geo.region" content="IN" />`,
    `<meta name="geo.placename" content="India" />`,
    `<meta name="theme-color" content="${THEME_COLOR}" />`,
    `<link rel="alternate" hreflang="en-in" href="${canonical}" />`,
    `<link rel="alternate" hreflang="x-default" href="${canonical}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${esc(seo.title)}" />`,
    `<meta property="og:description" content="${esc(seo.description)}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:type" content="image/png" />`,
    `<meta property="og:image:alt" content="Cash Raja — earn free gift cards in India" />`,
    `<meta property="og:locale" content="en_IN" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(seo.title)}" />`,
    `<meta name="twitter:description" content="${esc(seo.description)}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE}" />`,
    `<meta name="twitter:image:alt" content="Cash Raja — earn free gift cards in India" />`,
  ];
  const ld: Record<string, unknown>[] = [
    organizationLd,
    websiteLd,
    webPageLd(seo, canonical),
    ...(seo.jsonLd ?? []),
  ];
  const breadcrumb = breadcrumbLd(seo, canonical);
  if (breadcrumb) ld.push(breadcrumb);
  for (const obj of ld) {
    tags.push(`<script type="application/ld+json">${JSON.stringify(obj)}</script>`);
  }
  return tags.join('\n    ');
}
