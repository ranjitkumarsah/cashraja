import { Link } from 'react-router-dom';
import { ContentPage } from './ContentPage';

/**
 * SEO landing page targeting "free gift cards in India" and brand queries
 * (free Amazon / Flipkart / Google Play gift card). Genuinely useful, factual
 * content — good for both classic search and answer/generative engines.
 */
export function FreeGiftCardsPage() {
  return (
    <ContentPage>
      <article className="prose-invert max-w-none">
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          Free Gift Cards in India — Amazon, Flipkart &amp; Google Play
        </h1>
        <p className="mt-3 text-ink-muted">
          Cash Raja is a free rewards app for India where you earn coins by completing simple
          tasks and redeem them for real digital gift cards. There is no fee to join and no
          purchase is ever required — you only need to be 18 or older.
        </p>

        <h2 className="mt-10 text-xl font-bold text-ink">Which gift cards can I get?</h2>
        <ul className="mt-3 space-y-2 text-ink-muted">
          <li>
            <Link to="/free-amazon-gift-card" className="font-semibold text-primary-600 hover:underline">
              Amazon Pay gift cards
            </Link>{' '}
            — spend across Amazon.in on almost anything.
          </li>
          <li>
            <Link to="/free-flipkart-gift-card" className="font-semibold text-primary-600 hover:underline">
              Flipkart gift cards
            </Link>{' '}
            — shop electronics, fashion and more on Flipkart.
          </li>
          <li>
            <Link
              to="/free-google-play-gift-card"
              className="font-semibold text-primary-600 hover:underline"
            >
              Google Play gift cards
            </Link>{' '}
            — apps, games and subscriptions on the Play Store.
          </li>
        </ul>
        <p className="mt-3 text-ink-muted">
          Availability and denominations change over time and are shown live in the Rewards store.
        </p>

        <h2 className="mt-10 text-xl font-bold text-ink">How to get free gift cards with Cash Raja</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-ink-muted">
          <li>Sign in with Google — it&apos;s free, one account per person.</li>
          <li>Earn coins by completing offers, answering surveys, playing games and referring friends.</li>
          <li>Open the Rewards store, choose a brand and denomination, and redeem your coins.</li>
          <li>Your gift card code is delivered digitally after a quick review.</li>
        </ol>
        <p className="mt-4 text-ink-muted">
          See the full walkthrough in our{' '}
          <Link to="/how-to-earn" className="font-semibold text-primary-600 hover:underline">
            how to earn guide
          </Link>
          .
        </p>

        <h2 className="mt-10 text-xl font-bold text-ink">Is Cash Raja really free and legit?</h2>
        <p className="mt-3 text-ink-muted">
          Yes. Cash Raja is completely free and every reward is verified on our servers before it is
          credited, which keeps the rewards fair for genuine users. Coins have no cash value and can
          only be redeemed for the gift cards shown in the app — Cash Raja is a rewards app, not a
          job or a guaranteed source of income. Read more in our{' '}
          <Link to="/faq" className="font-semibold text-primary-600 hover:underline">
            FAQ
          </Link>
          .
        </p>

        <div className="mt-10 rounded-2xl border border-edge bg-surface-muted p-6 text-center">
          <h2 className="text-lg font-bold text-ink">Start earning free gift cards today</h2>
          <p className="mt-1 text-sm text-ink-muted">Free to join · for ages 18+ in India.</p>
          <Link
            to="/login"
            className="mt-4 inline-flex rounded-full bg-primary-600 px-6 py-2.5 text-sm font-extrabold text-white hover:bg-primary-500"
          >
            Get started
          </Link>
        </div>
      </article>
    </ContentPage>
  );
}
