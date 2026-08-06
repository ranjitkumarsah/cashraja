import { ContentPage } from './ContentPage';
import { GetStartedCta, InternalLink, Lead, Section } from './marketing';

/** SEO landing page — "free Flipkart gift card / voucher" intent (India). */
export function FreeFlipkartGiftCardPage() {
  return (
    <ContentPage>
      <article className="max-w-none">
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          Free Flipkart Gift Card in India
        </h1>
        <Lead>
          Earn a free Flipkart gift card with Cash Raja — a free rewards app for India. Complete
          simple tasks to earn coins, then redeem them for a Flipkart gift card to shop electronics,
          fashion, home and more. Free to join, no purchase required, for ages 18+.
        </Lead>

        <Section title="How to get a free Flipkart gift card">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Sign in with Google for free.</li>
            <li>Earn coins through offers, surveys, games and referrals.</li>
            <li>Open the Rewards store and pick a <strong className="text-ink">Flipkart</strong> gift card.</li>
            <li>Redeem — your code is delivered digitally after review.</li>
          </ol>
          <p>
            Full walkthrough: <InternalLink to="/how-to-earn">how to earn on Cash Raja</InternalLink>.
          </p>
        </Section>

        <Section title="How many coins does it cost?">
          <p>
            Each Flipkart denomination shows its coin cost live in the app, based on the current
            reward rate and stock. Keep completing tasks to unlock higher-value cards sooner.
          </p>
        </Section>

        <Section title="Is Cash Raja legit?">
          <p>
            Yes — Cash Raja is a genuine rewards app. Rewards are verified server-side before they
            are credited, sign-in uses Google, and coins are redeemable only for the gift cards shown
            in the app. Coins have no cash value, and Cash Raja is not a job or guaranteed income.
          </p>
        </Section>

        <Section title="Other gift cards">
          <p>
            You can also earn{' '}
            <InternalLink to="/free-amazon-gift-card">Amazon Pay</InternalLink> and{' '}
            <InternalLink to="/free-google-play-gift-card">Google Play</InternalLink> gift cards — see
            the <InternalLink to="/free-gift-cards">full list</InternalLink>.
          </p>
        </Section>

        <GetStartedCta heading="Earn your free Flipkart gift card" />
      </article>
    </ContentPage>
  );
}
