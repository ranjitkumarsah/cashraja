import { Link } from 'react-router-dom';
import { ContentPage } from './ContentPage';

/**
 * SEO content page targeting India rewards-app search intent ("earn free gift
 * cards India", "free Amazon gift card app", etc.). Prerendered to static HTML.
 */
export function HowToEarnPage() {
  return (
    <ContentPage>
      <h1 className="text-3xl font-bold tracking-tight text-ink">
        How to earn free gift cards in India with Cash Raja
      </h1>
      <p className="mt-3 text-ink-muted">
        Cash Raja is a free rewards app for India. You earn <strong>coins</strong> by completing
        real tasks — offers, short surveys, quick games, daily streaks and referrals — and redeem
        them for genuine <strong>Amazon, Flipkart and Google Play gift cards</strong>. There's no
        purchase required and no hidden fee. Here's exactly how it works.
      </p>

      <h2 className="mt-10 text-2xl font-bold text-ink">Ways to earn coins</h2>
      <ul className="mt-4 space-y-3 text-ink-muted">
        <li>
          <strong className="text-ink">Complete offers.</strong> Install apps, try services or
          finish simple tasks from our partner offerwall and earn coins for every verified action.
        </li>
        <li>
          <strong className="text-ink">Answer surveys.</strong> Share your opinion in short paid
          surveys — one of the fastest ways to earn on the web.
        </li>
        <li>
          <strong className="text-ink">Play games &amp; scratch/spin.</strong> Take a break with
          quick games and daily scratch cards or the spin wheel for surprise coin drops.
        </li>
        <li>
          <strong className="text-ink">Keep a daily streak.</strong> Come back each day to grow
          your streak and stack bonus rewards.
        </li>
        <li>
          <strong className="text-ink">Refer friends.</strong> Share your referral code and earn a
          bonus on your friends' earnings for a limited time.
        </li>
      </ul>
      <p className="mt-4 text-ink-muted">
        Want to move faster? Our guide to the{' '}
        <Link
          to="/blog/best-ways-to-earn-coins-fast"
          className="font-semibold text-primary-600 hover:underline"
        >
          fastest ways to earn coins
        </Link>{' '}
        compares each earning method in detail.
      </p>

      <h2 className="mt-10 text-2xl font-bold text-ink">How to redeem your coins for gift cards</h2>
      <p className="mt-3 text-ink-muted">
        Once you have enough coins, open the <strong>Rewards</strong> store, choose a brand
        (Amazon, Flipkart or Google Play) and a denomination such as ₹50, ₹100 or ₹250, and redeem.
        Your gift-card code is delivered in-app after a quick review. Coins have no cash value and
        are redeemable only for digital gift cards. For the full walkthrough, see the{' '}
        <Link
          to="/blog/how-to-redeem-coins-for-gift-cards"
          className="font-semibold text-primary-600 hover:underline"
        >
          step-by-step redemption guide
        </Link>
        .
      </p>

      <h2 className="mt-10 text-2xl font-bold text-ink">Get started in 3 steps</h2>
      <ol className="mt-4 space-y-2 text-ink-muted">
        <li>
          <strong className="text-ink">1. Sign in with Google</strong> — one account per person, no
          long forms.
        </li>
        <li>
          <strong className="text-ink">2. Earn coins</strong> — complete offers, surveys, games and
          referrals to build your balance.
        </li>
        <li>
          <strong className="text-ink">3. Redeem gift cards</strong> — cash your coins in for Amazon,
          Flipkart or Google Play.
        </li>
      </ol>

      <h2 className="mt-10 text-2xl font-bold text-ink">Who can use Cash Raja?</h2>
      <p className="mt-3 text-ink-muted">
        Cash Raja is intended for users aged <strong>18 and older</strong> in India. It's free to
        join. Read our{' '}
        <Link to="/faq" className="text-gold-500 hover:underline">
          FAQ
        </Link>{' '}
        for more, or learn{' '}
        <Link to="/about" className="text-gold-500 hover:underline">
          about Cash Raja
        </Link>
        .
      </p>

      <div className="mt-10 rounded-2xl border border-gold-400/30 bg-gold-400/[0.06] p-6">
        <p className="text-lg font-bold text-ink">Ready to start earning?</p>
        <p className="mt-1 text-sm text-ink-muted">
          Sign in and turn your spare minutes into real gift cards.
        </p>
        <Link
          to="/login"
          className="mt-4 inline-flex rounded-full bg-gold-400 px-5 py-2.5 text-sm font-extrabold text-primary-950 hover:bg-gold-300"
        >
          Get Started
        </Link>
      </div>
    </ContentPage>
  );
}
