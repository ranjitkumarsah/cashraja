import { Link } from 'react-router-dom';
import { ContentPage } from './ContentPage';

/**
 * SEO landing page targeting "earn money online India" / "earning app" intent,
 * framed honestly (a rewards app, not a job). Useful, factual content for
 * classic search + answer/generative engines.
 */
export function EarnMoneyOnlinePage() {
  return (
    <ContentPage>
      <article className="prose-invert max-w-none">
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          Earn Money Online in India with a Free Rewards App
        </h1>
        <p className="mt-3 text-ink-muted">
          Cash Raja is a free rewards app for India. Instead of cash, you earn coins for completing
          simple online tasks and redeem them for real digital gift cards from Amazon, Flipkart and
          Google Play. It&apos;s free to join, no purchase is ever required, and it&apos;s for users
          aged 18 and older.
        </p>

        <h2 className="mt-10 text-xl font-bold text-ink">Ways to earn on Cash Raja</h2>
        <ul className="mt-3 space-y-2 text-ink-muted">
          <li><strong className="text-ink">Offers &amp; tasks</strong> — try apps and services for coins.</li>
          <li><strong className="text-ink">Surveys</strong> — share your opinion and get rewarded.</li>
          <li><strong className="text-ink">Games &amp; daily rewards</strong> — quick ways to top up your balance.</li>
          <li><strong className="text-ink">Referrals</strong> — invite friends and earn a bonus on their activity.</li>
        </ul>
        <p className="mt-3 text-ink-muted">
          Every reward is verified on our servers before it is credited, so genuine users are
          rewarded fairly.
        </p>

        <h2 className="mt-10 text-xl font-bold text-ink">Turn coins into gift cards</h2>
        <p className="mt-3 text-ink-muted">
          Once you have enough coins, redeem them in the Rewards store for{' '}
          <Link to="/free-gift-cards" className="font-semibold text-primary-600 hover:underline">
            free Amazon, Flipkart or Google Play gift cards
          </Link>
          . Codes are delivered digitally after a quick review.
        </p>

        <h2 className="mt-10 text-xl font-bold text-ink">Is it worth it?</h2>
        <p className="mt-3 text-ink-muted">
          Cash Raja is a fun, low-effort way to earn rewards in your spare time — but it is a rewards
          app, not a job or guaranteed income. How much you earn depends on the tasks you complete
          and the rewards available. Coins have no cash value and can only be redeemed for gift
          cards shown in the app.
        </p>

        <div className="mt-10 rounded-2xl border border-edge bg-surface-muted p-6 text-center">
          <h2 className="text-lg font-bold text-ink">Start earning rewards online</h2>
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
