import { renderToString } from 'react-dom/server';
import { Route, Routes } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server';
import { PublicLayout } from './features/public/PublicLayout';
import { LandingPage } from './features/landing/LandingPage';
import { AboutPage } from './features/public/AboutPage';
import { FaqPage } from './features/public/FaqPage';
import { HowToEarnPage } from './features/public/HowToEarnPage';
import { FreeGiftCardsPage } from './features/public/FreeGiftCardsPage';
import { EarnMoneyOnlinePage } from './features/public/EarnMoneyOnlinePage';
import { PrivacyPage } from './features/public/PrivacyPage';
import { TermsPage } from './features/public/TermsPage';
import { PRERENDER_ROUTES, renderHead, seoFor, SITE_URL } from './lib/seo/seo-config';

/**
 * Public-only route tree for static prerendering. Deliberately does NOT import
 * AppRoutes/admin pages, so the SSR bundle stays small and can't be broken by
 * browser-only code in the authenticated app. The client SPA (main.tsx) is
 * unchanged and still owns all routing at runtime.
 */
function PublicRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="how-to-earn" element={<HowToEarnPage />} />
        <Route path="free-gift-cards" element={<FreeGiftCardsPage />} />
        <Route path="earn-money-online" element={<EarnMoneyOnlinePage />} />
        <Route path="faq" element={<FaqPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="terms" element={<TermsPage />} />
      </Route>
    </Routes>
  );
}

export function render(url: string): { html: string; head: string } {
  const html = renderToString(
    <StaticRouter location={url}>
      <PublicRoutes />
    </StaticRouter>,
  );
  const seo = seoFor(url);
  return { html, head: seo ? renderHead(seo) : '' };
}

export const routesToPrerender = PRERENDER_ROUTES;
export const siteUrl = SITE_URL;
