import { ContentPage } from './ContentPage';
import { GetStartedCta, InternalLink, Lead, Section } from './marketing';

/** SEO landing page — "free Google Play gift card / redeem code" intent (India). */
export function FreeGooglePlayGiftCardPage() {
  return (
    <ContentPage>
      <article className="max-w-none">
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          Free Google Play Gift Card &amp; Redeem Code in India
        </h1>
        <Lead>
          Get a free Google Play gift card with Cash Raja, a free rewards app for India. Earn coins
          by completing tasks and redeem them for a Google Play code to buy apps, games,
          subscriptions and more. Free to join, no purchase required, ages 18+.
        </Lead>

        <Section title="How to get a free Google Play redeem code">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Sign in with Google for free.</li>
            <li>Earn coins with offers, surveys, games and referrals.</li>
            <li>Choose a <strong className="text-ink">Google Play</strong> gift card in the Rewards store.</li>
            <li>Redeem your coins — the redeem code is delivered digitally after review.</li>
          </ol>
          <p>
            See the <InternalLink to="/how-to-earn">step-by-step earning guide</InternalLink>.
          </p>
        </Section>

        <Section title="What can I use the code for?">
          <p>
            A Google Play redeem code adds balance to your Play Store account, which you can spend on
            paid apps and games, in-app purchases, and subscriptions like YouTube Premium — anything
            the Play Store supports.
          </p>
        </Section>

        <Section title="Is it free and genuine?">
          <p>
            Yes. Cash Raja is free and rewards are verified on our servers before they are credited.
            Coins have no cash value and can only be redeemed for the gift cards shown in the app.
            Cash Raja is a rewards app, not a job or a guaranteed source of income.
          </p>
        </Section>

        <Section title="More reward options">
          <p>
            You can also earn{' '}
            <InternalLink to="/free-amazon-gift-card">Amazon Pay</InternalLink> and{' '}
            <InternalLink to="/free-flipkart-gift-card">Flipkart</InternalLink> gift cards. Browse
            the <InternalLink to="/free-gift-cards">free gift cards</InternalLink> page.
          </p>
        </Section>

        <GetStartedCta heading="Earn your free Google Play code" />
      </article>
    </ContentPage>
  );
}
