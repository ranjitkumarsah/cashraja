import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';
import { CoinMark } from '../../components/CoinMark';
import { CONTACT_EMAIL } from './legalContent';

/** Brand mark used in the public header + footer. */
function BrandMark({ className }: { className?: string }) {
  return (
    <Link to="/" className={className} aria-label="Cash Raja home">
      <span className="flex items-center gap-2.5">
        <CoinMark className="size-8" />
        <span className="text-lg font-bold tracking-tight text-white">
          Cash <span className="text-gold-300">Raja</span>
        </span>
      </span>
    </Link>
  );
}

/** Front-facing pages shown in the top navigation. */
const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/how-to-earn', label: 'How to earn' },
  { to: '/free-gift-cards', label: 'Free gift cards' },
  { to: '/faq', label: 'FAQ' },
] as const;

/** SEO guide pages, grouped in the footer. */
const GUIDE_LINKS = [
  { to: '/how-to-earn', label: 'How to earn' },
  { to: '/free-gift-cards', label: 'Free gift cards' },
  { to: '/earn-money-online', label: 'Earn money online' },
] as const;

const FOOTER_LINKS = [
  { to: '/about', label: 'About' },
  { to: '/faq', label: 'FAQ' },
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms & Conditions' },
] as const;

/**
 * Public shell for the marketing landing + content pages. A dark indigo brand
 * bar (front-facing links + a top-right Log in button) and a matching footer
 * wrap every public route; the page content area between them is theme-aware.
 */
export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-primary-950/95 backdrop-blur supports-[backdrop-filter]:bg-primary-950/80">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <BrandMark />
          <div className="flex items-center gap-2 sm:gap-7">
            <nav className="hidden items-center gap-7 sm:flex" aria-label="Public navigation">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-sm font-medium text-indigo-200 transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            {/* Log in — the web user sign-in. Top-right on every size. */}
            <Link
              to="/login"
              className="rounded-full bg-gold-400 px-4 py-2 text-sm font-extrabold text-primary-950 shadow-sm transition-colors hover:bg-gold-300"
            >
              Log in
            </Link>
            {/* Mobile menu toggle — the nav links live in a dropdown on phones. */}
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Menu"
              aria-expanded={menuOpen}
              className="rounded-lg p-1.5 text-indigo-200 hover:text-white sm:hidden"
            >
              {menuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav
            className="border-t border-white/10 bg-primary-950/95 sm:hidden"
            aria-label="Mobile navigation"
          >
            <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className="border-b border-white/5 py-3 text-sm font-medium text-indigo-200 last:border-0 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-white/10 bg-primary-950 text-indigo-200">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="space-y-3">
            <BrandMark />
            <p className="max-w-xs text-sm leading-relaxed text-indigo-300/80">
              Play games, complete offers, and redeem your coins for real Amazon, Flipkart and
              Google Play gift cards in India. For users aged 18 and older.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
              Guides
            </h2>
            <ul className="space-y-2 text-sm">
              {GUIDE_LINKS.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
              Company
            </h2>
            <ul className="space-y-2 text-sm">
              {FOOTER_LINKS.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
              Contact
            </h2>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-sm transition-colors hover:text-white"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-indigo-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>© {new Date().getFullYear()} Cash Raja. All rights reserved.</p>
            <p>Coins have no cash value. Cash Raja is not a job or guaranteed income.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
