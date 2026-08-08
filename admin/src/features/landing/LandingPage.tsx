import {
  ArrowRight,
  Coins,
  Flame,
  Gamepad2,
  Gift,
  Smartphone,
  Sparkles,
  Ticket,
  UserPlus,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { CoinMark } from '../../components/CoinMark';
import { FaqAccordion } from './FaqAccordion';

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
}

/** Trust signals shown under the hero.
 *
 *  Deliberately scale-independent: these are facts about how Cash Raja works,
 *  not usage counts. They replaced a live "total players / daily active users /
 *  rewards paid" strip, which on a new site advertised how few people had
 *  signed up — the opposite of reassurance in a category where the first
 *  question is always "is this a scam?". Every line here must stay literally
 *  true; never restate them as numbers.
 */
const TRUST_SIGNALS: readonly string[] = [
  'Rewards verified server-side before crediting',
  'Amazon, Flipkart & Google Play gift cards',
  '18+, one account per person, free to join',
];

const FEATURES: Feature[] = [
  {
    icon: Ticket,
    title: 'Offers',
    body: 'Complete curated offers from our partner networks and earn coins for every verified action.',
  },
  {
    icon: Gamepad2,
    title: 'Games',
    body: 'Play quick, fun games between tasks and turn your high scores into coins.',
  },
  {
    icon: Flame,
    title: 'Daily streaks',
    body: 'Come back each day to keep your streak alive and stack up bonus rewards.',
  },
  {
    icon: Sparkles,
    title: 'Scratch & spin',
    body: 'Try your luck with scratch cards and the spin wheel for surprise coin drops.',
  },
  {
    icon: UserPlus,
    title: 'Referrals',
    body: 'Invite friends and earn a bonus on their earnings for a limited time.',
  },
  {
    icon: Gift,
    title: 'Gift-card redemption',
    body: 'Redeem your coins for real digital gift cards, delivered straight to your account.',
  },
];

interface Step {
  icon: LucideIcon;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: Smartphone,
    title: 'Sign in with Google',
    body: 'Download Cash Raja and sign in — one account per person, no forms to fill.',
  },
  {
    icon: Coins,
    title: 'Play & earn coins',
    body: 'Complete offers, play games, keep streaks, and refer friends to build your balance.',
  },
  {
    icon: Wallet,
    title: 'Redeem gift cards',
    body: 'Cash your coins in for digital gift cards from the in-app catalogue.',
  },
];

function GetStartedCta({ className }: { className?: string }) {
  return (
    <Link
      to="/login"
      className={
        'inline-flex items-center justify-center gap-2.5 rounded-xl bg-gold-400 px-6 py-3.5 ' +
        'text-base font-semibold text-primary-950 shadow-lg shadow-gold-500/20 transition-colors ' +
        'hover:bg-gold-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 ' +
        'focus-visible:ring-offset-2 focus-visible:ring-offset-primary-950 ' +
        (className ?? '')
      }
    >
      Get Started
      <ArrowRight className="size-5" aria-hidden="true" />
    </Link>
  );
}

export function LandingPage() {
  return (
    // Force the dark, premium palette for the whole landing regardless of the
    // stored theme — the `dark` class flips the semantic surface/ink tokens.
    <div className="dark bg-primary-950 text-ink">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(55rem 38rem at 50% -10%, rgba(99, 102, 241, 0.28), transparent 60%), ' +
              'radial-gradient(40rem 30rem at 85% 20%, rgba(245, 197, 24, 0.12), transparent 60%)',
          }}
        />
        <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28">
          <CoinMark className="size-20 drop-shadow-[0_4px_20px_rgba(245,197,24,0.35)]" />
          <span className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-gold-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-gold-300">
            <Sparkles className="size-3.5" aria-hidden="true" /> For ages 18 and older
          </span>
          {/* The h1 carries the descriptive phrase, not just the brand name:
              nobody searches "Cash Raja" before they have heard of it, and this
              is the strongest heading on the site. The wordmark keeps its visual
              weight; the qualifying line is part of the same heading so the
              keywords are in the h1 rather than in a sibling paragraph. */}
          <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-white sm:text-6xl">
            Cash <span className="text-gold-300">Raja</span>
            <span className="mt-3 block text-xl font-bold text-indigo-100 sm:text-2xl">
              Play games and earn free gift cards in India
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-xl font-medium text-indigo-100 sm:text-2xl">
            Play. Earn. Redeem real gift cards.
          </p>
          <p className="mt-4 max-w-xl text-base text-indigo-200/80">
            Turn spare minutes into rewards. Complete offers, play games, and keep your streaks
            alive — then cash your coins in for digital gift cards.
          </p>
          <div className="mt-9">
            <GetStartedCta />
          </div>
          <p className="mt-4 text-xs text-indigo-300/70">
            Free to play · Gift-card rewards · Sign in with Google
          </p>
        </div>
      </section>

      {/* Trust signals — static facts about how the rewards work. Rendered
          server-side (no fetch), so they are in the prerendered HTML and cannot
          shift layout the way the old client-fetched stats strip did. */}
      <section className="relative border-y border-white/10 bg-primary-950/60">
        <div className="mx-auto grid w-full max-w-4xl grid-cols-1 divide-y divide-white/10 px-4 py-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6">
          {TRUST_SIGNALS.map((signal) => (
            <div key={signal} className="px-4 py-6 text-center">
              <p className="text-sm font-medium text-indigo-100">{signal}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Six ways to earn
          </h2>
          <p className="mt-4 text-indigo-200/80">
            Every reward is verified on our servers, so genuine players get rewarded fairly.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-gold-400/30 hover:bg-white/[0.05]"
            >
              <span className="inline-flex size-11 items-center justify-center rounded-xl bg-gold-400/10 text-gold-300">
                <feature.icon className="size-5.5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-indigo-200/80">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-white/10 bg-white/[0.02]">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              How it works
            </h2>
            <p className="mt-4 text-indigo-200/80">Three steps from download to gift card.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="relative flex flex-col items-center text-center">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-800 text-gold-300 ring-1 ring-white/10">
                  <step.icon className="size-6" aria-hidden="true" />
                </span>
                <span className="coin-num mt-4 text-xs font-bold uppercase tracking-widest text-gold-400">
                  Step {i + 1}
                </span>
                <h3 className="mt-1.5 text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-indigo-200/80">
                  {step.body}
                </p>
                {i < STEPS.length - 1 && (
                  <ArrowRight
                    aria-hidden="true"
                    className="absolute -right-3 top-4 hidden size-6 text-white/20 md:block"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Frequently asked questions
          </h2>
        </div>
        <FaqAccordion />
      </section>

      {/* Closing CTA */}
      <section className="border-t border-white/10">
        <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Ready to start earning?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-indigo-200/80">
            Download Cash Raja and turn your spare time into real gift cards.
          </p>
          <div className="mt-8">
            <GetStartedCta />
          </div>
        </div>
      </section>
    </div>
  );
}
