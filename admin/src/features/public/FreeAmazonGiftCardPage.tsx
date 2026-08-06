import { ContentPage } from './ContentPage';
import { GetStartedCta, InternalLink, Lead, Section } from './marketing';

/** SEO landing page — "free Amazon gift card / Amazon Pay" intent (India). */
export function FreeAmazonGiftCardPage() {
  return (
    <ContentPage>
      <article className="max-w-none">
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          Free Amazon Gift Card (Amazon Pay) in India
        </h1>
        <Lead>
          Cash Raja is a free rewards app where you earn coins for completing simple tasks and
          redeem them for an Amazon Pay gift card. There&apos;s no fee to join and no purchase is
          ever required — you just need to be 18 or older and in India.
        </Lead>

        <Section title="How to get a free Amazon gift card">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Sign in with Google — it&apos;s free.</li>
            <li>Earn coins by completing offers, answering surveys, playing games and referring friends.</li>
            <li>Open the Rewards store and choose an <strong className="text-ink">Amazon Pay</strong> gift card.</li>
            <li>Redeem your coins — the code is delivered digitally after a quick review.</li>
          </ol>
          <p>
            New to this? Start with our <InternalLink to="/how-to-earn">how to earn guide</InternalLink>.
          </p>
        </Section>

        <Section title="How many coins do I need?">
          <p>
            The coin cost of each Amazon Pay denomination is shown live in the app and depends on the
            current reward rate and availability. Bigger denominations cost more coins — keep
            completing offers and surveys to reach them faster.
          </p>
        </Section>

        <Section title="Is it really free and safe?">
          <p>
            Yes. Cash Raja is completely free and every reward is verified on our servers before it
            is credited, which keeps things fair for genuine users. Coins have no cash value and can
            only be redeemed for the gift cards shown in the app. Cash Raja is a rewards app — not a
            job or a guaranteed source of income.
          </p>
        </Section>

        <Section title="Prefer a different brand?">
          <p>
            You can also redeem for{' '}
            <InternalLink to="/free-flipkart-gift-card">Flipkart</InternalLink> and{' '}
            <InternalLink to="/free-google-play-gift-card">Google Play</InternalLink> gift cards. See
            all options on the <InternalLink to="/free-gift-cards">free gift cards</InternalLink> page.
          </p>
        </Section>

        <GetStartedCta heading="Earn your free Amazon gift card" />
      </article>
    </ContentPage>
  );
}
