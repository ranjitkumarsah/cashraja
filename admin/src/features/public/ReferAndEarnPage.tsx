import { ContentPage } from './ContentPage';
import { GetStartedCta, InternalLink, Lead, Section } from './marketing';

/** SEO landing page — "refer and earn / invite and earn" intent (India). */
export function ReferAndEarnPage() {
  return (
    <ContentPage>
      <article className="max-w-none">
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          Refer and Earn — Invite Friends, Earn Bonus Coins
        </h1>
        <Lead>
          Cash Raja&apos;s refer-and-earn programme rewards you for inviting friends. Share your
          referral code, and when your friends join and start earning, you get a bonus — all free,
          for users aged 18 and older in India.
        </Lead>

        <Section title="How refer and earn works">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Open Cash Raja and find your unique referral code in your profile.</li>
            <li>Share it with friends via WhatsApp, Instagram or any app.</li>
            <li>Your friend signs up with your code and starts completing tasks.</li>
            <li>You earn a bonus based on a percentage of their earnings for a limited time.</li>
          </ol>
        </Section>

        <Section title="Referral rules (please read)">
          <ul className="list-disc space-y-2 pl-5">
            <li>Self-referrals are not allowed.</li>
            <li>Referrals between accounts on the same device are not eligible.</li>
            <li>One account per person; fraudulent referrals are removed and can lead to a ban.</li>
          </ul>
          <p>
            These rules keep the programme fair for everyone. See the{' '}
            <InternalLink to="/terms">Terms &amp; Conditions</InternalLink> for the full details.
          </p>
        </Section>

        <Section title="What can I do with the coins?">
          <p>
            Referral bonuses are credited as coins, which you can redeem for{' '}
            <InternalLink to="/free-gift-cards">
              Amazon, Flipkart and Google Play gift cards
            </InternalLink>{' '}
            in the Rewards store — the same as coins you earn from offers and surveys.
          </p>
        </Section>

        <GetStartedCta heading="Start inviting and earning" />
      </article>
    </ContentPage>
  );
}
