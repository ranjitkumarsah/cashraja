import type { ReactNode } from 'react';
import { InternalLink, Section } from '../public/marketing';

/** Article bodies keyed by slug. Metadata (title/description/dates) is in
 *  posts-meta.ts; these are the readable contents rendered by BlogPostPage. */
export const POST_BODIES: Record<string, ReactNode> = {
  'how-to-earn-free-gift-cards-india-2026': (
    <>
      <p className="text-ink-muted">
        Free gift cards are one of the most popular online rewards in India — and you don&apos;t need
        any special skills to earn them. With a rewards app like Cash Raja you complete simple tasks
        to earn coins, then swap those coins for Amazon, Flipkart or Google Play gift cards. Here is
        how it works in 2026, honestly.
      </p>

      <Section title="1. Join a genuine rewards app">
        <p>
          Start with an app that verifies rewards and pays in gift cards you actually recognise.
          Cash Raja is free to join, uses Google sign-in, and is for users aged 18 and older in
          India. There is no fee and no purchase is ever required.
        </p>
      </Section>

      <Section title="2. Earn coins with everyday tasks">
        <p>The main ways to earn are:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-ink">Offers</strong> — try apps and services for coins.</li>
          <li><strong className="text-ink">Surveys</strong> — share your opinion and get rewarded.</li>
          <li><strong className="text-ink">Games &amp; daily rewards</strong> — quick top-ups.</li>
          <li><strong className="text-ink">Referrals</strong> — invite friends with{' '}
            <InternalLink to="/refer-and-earn">refer and earn</InternalLink>.</li>
        </ul>
        <p>Every reward is verified on the server before it is credited, which keeps things fair.</p>
      </Section>

      <Section title="3. Redeem coins for gift cards">
        <p>
          When you have enough coins, open the Rewards store and choose a brand — a{' '}
          <InternalLink to="/free-amazon-gift-card">free Amazon gift card</InternalLink>, a{' '}
          <InternalLink to="/free-flipkart-gift-card">Flipkart gift card</InternalLink>, or a{' '}
          <InternalLink to="/free-google-play-gift-card">Google Play code</InternalLink>. The code is
          delivered digitally after a quick review.
        </p>
      </Section>

      <Section title="A realistic expectation">
        <p>
          Rewards apps are a fun way to earn small rewards in your spare time — not a job or a source
          of guaranteed income. How much you earn depends on the tasks you complete and what&apos;s
          available. Coins have no cash value and are redeemable only for the gift cards shown in the
          app. For a full walkthrough, see <InternalLink to="/how-to-earn">how to earn</InternalLink>.
        </p>
      </Section>
    </>
  ),

  'is-cash-raja-legit': (
    <>
      <p className="text-ink-muted">
        &ldquo;Is Cash Raja real or fake?&rdquo; is a fair question to ask before spending time on any
        rewards app. Here is an honest explanation of how Cash Raja works and what it is — and
        isn&apos;t.
      </p>

      <Section title="How the rewards are verified">
        <p>
          Every reward on Cash Raja is verified on our servers before it is credited to your balance.
          That server-side check is what keeps the rewards fair for genuine users and blocks abuse.
          Sign-in uses Google, and we keep a deliberately small data footprint.
        </p>
      </Section>

      <Section title="What you can actually redeem">
        <p>
          Coins are redeemed for digital gift cards from the catalogue shown in the app —{' '}
          <InternalLink to="/free-gift-cards">Amazon, Flipkart and Google Play</InternalLink>,
          subject to availability. Approved redemptions are reviewed before fulfilment to protect
          against fraud, then delivered digitally.
        </p>
      </Section>

      <Section title="What Cash Raja is not">
        <ul className="list-disc space-y-2 pl-5">
          <li>It is not a job or a source of guaranteed income.</li>
          <li>Coins have no cash value and cannot be exchanged for money.</li>
          <li>It is for users aged 18 and older; one account per person.</li>
        </ul>
        <p>
          If an app promises guaranteed money or huge payouts for no effort, be cautious — that is
          usually a red flag. Cash Raja is upfront: real tasks, verified rewards, gift cards only.
        </p>
      </Section>

      <Section title="The bottom line">
        <p>
          Cash Raja is a genuine rewards app for India that pays in digital gift cards for verified
          activity. Read the <InternalLink to="/faq">FAQ</InternalLink> or{' '}
          <InternalLink to="/terms">Terms</InternalLink> for the finer details.
        </p>
      </Section>
    </>
  ),

  'best-ways-to-earn-coins-fast': (
    <>
      <p className="text-ink-muted">
        Want to reach that gift card sooner? Here are the most effective ways to build your coin
        balance on Cash Raja — no shortcuts, just the offers and habits that add up fastest.
      </p>

      <Section title="1. Prioritise higher-value offers">
        <p>
          Offers that involve installing and genuinely using an app usually pay more coins than a
          quick click. Read the requirements, complete every step, and give the reward time to verify
          — partial completions don&apos;t credit.
        </p>
      </Section>

      <Section title="2. Do surveys that match you">
        <p>
          Surveys reward your opinion. Answer honestly and consistently so you qualify for more —
          rushing or contradicting yourself gets you screened out.
        </p>
      </Section>

      <Section title="3. Claim daily rewards and streaks">
        <p>
          Small daily rewards are easy to forget but add up over a month. Open the app each day to
          keep your streak going and collect what&apos;s on offer.
        </p>
      </Section>

      <Section title="4. Invite friends">
        <p>
          <InternalLink to="/refer-and-earn">Refer and earn</InternalLink> is one of the best
          multipliers: you earn a bonus based on your friends&apos; activity for a limited time.
          Share your code with people who&apos;ll actually use the app — self-referrals and
          same-device accounts don&apos;t qualify.
        </p>
      </Section>

      <Section title="5. Then redeem smart">
        <p>
          When your balance is ready, pick the brand you&apos;ll actually use —{' '}
          <InternalLink to="/free-amazon-gift-card">Amazon</InternalLink>,{' '}
          <InternalLink to="/free-flipkart-gift-card">Flipkart</InternalLink> or{' '}
          <InternalLink to="/free-google-play-gift-card">Google Play</InternalLink>. Remember: coins
          have no cash value and Cash Raja is a rewards app, not guaranteed income.
        </p>
      </Section>
    </>
  ),

  'how-to-redeem-coins-for-gift-cards': (
    <>
      <p className="text-ink-muted">
        Earning coins is only half the fun — the best part is turning them into a real gift card.
        On Cash Raja, redeeming is quick and happens entirely in the app. Here&apos;s exactly how it
        works, how long it takes, and what to expect.
      </p>

      <Section title="First, earn enough coins">
        <p>
          Every gift card denomination has a coin cost, shown live in the Rewards store. Build your
          balance by completing offers, answering surveys, playing games, claiming daily rewards, and
          inviting friends. If you&apos;re just getting started, our{' '}
          <InternalLink to="/how-to-earn">how to earn guide</InternalLink> walks through each method.
        </p>
      </Section>

      <Section title="Step by step: redeeming your coins">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Open the <strong className="text-ink">Rewards</strong> store in the app.</li>
          <li>Choose a brand — Amazon Pay, Flipkart or Google Play.</li>
          <li>Pick a denomination you can afford with your current coin balance.</li>
          <li>Confirm the redemption — your coins are reserved straight away.</li>
          <li>After a quick review, your gift-card code is delivered digitally in the app.</li>
        </ol>
      </Section>

      <Section title="How long does it take?">
        <p>
          Most redemptions are reviewed and fulfilled quickly, but review times can vary depending on
          demand and stock. You can always track the status of any redemption from within the app, so
          you&apos;ll know exactly where it stands. The review step is there to protect against fraud
          and keep rewards fair for genuine users.
        </p>
      </Section>

      <Section title="Which gift card should you pick?">
        <p>
          Choose the brand you&apos;ll actually use:{' '}
          <InternalLink to="/free-amazon-gift-card">Amazon Pay</InternalLink> for almost anything on
          Amazon.in, <InternalLink to="/free-flipkart-gift-card">Flipkart</InternalLink> for
          electronics and fashion, or{' '}
          <InternalLink to="/free-google-play-gift-card">Google Play</InternalLink> for apps, games
          and subscriptions. See every option on the{' '}
          <InternalLink to="/free-gift-cards">free gift cards</InternalLink> page.
        </p>
      </Section>

      <Section title="A few things to remember">
        <ul className="list-disc space-y-2 pl-5">
          <li>Coins have no cash value and can only be redeemed for the gift cards shown in the app.</li>
          <li>Denominations and availability change over time — grab one when it&apos;s in stock.</li>
          <li>Cash Raja is for users aged 18 and older, and is a rewards app — not a job or guaranteed income.</li>
        </ul>
        <p>
          That&apos;s it. Once your code arrives, redeem it in your chosen brand&apos;s account and
          enjoy. Have a question about redemptions? Check the{' '}
          <InternalLink to="/faq">FAQ</InternalLink>.
        </p>
      </Section>
    </>
  ),
};
