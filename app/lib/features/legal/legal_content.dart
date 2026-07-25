/// Draft legal + informational copy for Cash Raja, rendered by [PolicyScreen].
///
/// These are lightweight markdown-ish strings (see `PolicyScreen` for the
/// supported syntax: `#`/`##` headings, `- ` bullets, blank-line paragraphs).
///
/// IMPORTANT (owner action): this content is a DRAFT tailored to the app's
/// current data practices from docs/cash-mafia-clone-data-security.md + the PRD.
/// It is NOT a substitute for legal review. Before public launch:
///   1. Have a lawyer review Terms & Privacy Policy.
///   2. Replace the placeholder contact email `support@cashraja.app` with a
///      real, monitored address (TODO).
///   3. Keep the Play Store Data Safety form in sync with the "Data we collect"
///      and "Data we share" sections below.
abstract class LegalContent {
  /// Shown at the top of every policy screen.
  static const String draftNotice =
      'Draft pending legal review. Contact support@cashraja.app '
      '(placeholder — to be finalised).';

  /// Last-reviewed marker surfaced to users. Update on each real revision.
  static const String lastUpdated = 'Last updated: 25 July 2026';

  static const String privacyPolicy = '''
# Privacy Policy

Cash Raja ("we", "us", the "app") lets you earn coins through games, offers,
and rewarded ads, and redeem those coins for gift cards. This policy explains
what we collect, why, who we share it with, and the choices you have.

## Who can use Cash Raja
Cash Raja is intended only for users aged 18 or older. We do not knowingly
collect data from anyone under 18. If you are under 18, please do not use the
app.

## Data we collect
- Google account details (your email address, display name, and Google profile
  ID) when you sign in with Google. This is how we identify your account and
  enforce one account per person.
- Device identifiers and a device fingerprint, used to prevent multi-accounting
  and fraud.
- Your IP address, collected server-side from your requests, used for coarse
  location (country) and fraud/velocity checks.
- Your coin ledger and activity in the app (offers completed, ads watched,
  games played, redemptions requested) — this is the core record that powers
  your balance and rewards.
- Advertising identifiers and SDK-specific IDs required by our ad and offerwall
  partners to attribute your reward activity.

We do not collect your phone number, home address, bank or payment details, or
any government ID. The Google-only, gift-card-only design keeps the data we
hold deliberately narrow.

## How we use your data
- To run the core product: crediting coins, tracking your balance, and
  delivering gift-card redemptions.
- To prevent fraud and abuse: device fingerprinting, IP checks, and
  server-side verification of every reward.
- To show and attribute ads and offers through our partner networks.
- To understand engagement and improve the app (analytics).

## Data we share
- We share advertising identifiers and device identifiers with our ad and
  offerwall partners so your reward activity can be attributed and paid out.
- We share the minimum information needed with gift-card fulfilment providers to
  deliver a redemption you request.
- We do not sell your personal data.

## Data retention
- We keep your account data for as long as your account is active.
- If your account is inactive, we aim to remove or anonymise personal data
  after 24 months of inactivity.
- Issued gift-card codes are purged once delivery is confirmed and any dispute
  window has passed.

## Deleting your account
You can delete your account at any time from Profile → Delete account. Because
your coin ledger is also a financial and anti-fraud record, we anonymise your
personal details (email, name, device identifiers) in place rather than erasing
the ledger outright. After deletion your sessions end and the Google account is
unlinked, so you can start fresh if you sign in again.

## Security
We use TLS for all traffic, verify Google sign-in tokens server-side, encrypt
sensitive data (such as gift-card codes) at rest, and restrict admin access by
role. No system is perfectly secure, but we work to protect your data.

## Changes to this policy
We may update this policy as the app evolves. Material changes will be reflected
here with a new "last updated" date.

## Contact
Questions about your data or this policy? Email support@cashraja.app.
''';

  static const String terms = '''
# Terms & Conditions

By using Cash Raja you agree to these terms. Please read them carefully.

## Eligibility
You must be at least 18 years old to use Cash Raja. You may hold only one
account. Creating multiple accounts, or using another person's account, is not
permitted.

## Coins and rewards
- Coins are an in-app rewards unit with no cash value and cannot be transferred,
  sold, or exchanged for money.
- Coins are earned only through legitimate in-app activity: games, verified
  offers, rewarded ads, streaks, bonuses, and referrals.
- Every reward is verified server-side. Coins credited in error, or through
  manipulation, may be reversed.

## Redemptions
- Coins may be redeemed only for the gift cards offered in the app, subject to
  availability.
- Redemption requests are reviewed before fulfilment. We may hold, reject, or
  reverse a redemption if we detect fraud, abuse, or a violation of these terms.
- Gift cards are delivered digitally to the account on file.

## Referrals
When you refer a friend, you may earn a bonus based on a percentage of their
earnings for a limited time. The exact percentage and window are shown in the
app and may change for new referrals. Self-referrals and referrals between
accounts on the same device are not eligible and may be blocked.

## Prohibited conduct
You agree not to use bots, emulators, automation, VPN-based location spoofing,
or any method designed to earn coins without genuinely completing activities, or
to farm rewards across multiple accounts or devices.

## Fraud and account action
We may flag, suspend, or ban accounts, and void coin balances or redemptions,
where we reasonably suspect fraud, multi-accounting, or abuse.

## Availability and changes
The app, its offers, gift-card catalogue, and reward rates are provided as-is
and may change or be discontinued at any time. We may update these terms; your
continued use means you accept the updated terms.

## Contact
Questions about these terms? Email support@cashraja.app.
''';

  static const String aboutUs = '''
# About Cash Raja

Cash Raja is a rewards app: play quick games, complete offers, and watch
rewarded ads to earn coins, then redeem your coins for gift cards.

## What we're about
- A simple, honest rewards loop — earn coins, redeem for gift cards.
- Gift-card-only rewards, sign in with Google, and a deliberately small data
  footprint.
- Strong anti-fraud so genuine users get rewarded fairly.

## Good to know
- Cash Raja is for users aged 18 and older.
- Coins have no cash value and can only be redeemed for the gift cards shown in
  the app.
- Rewards, offers, and availability can change over time.

## Get in touch
We'd love your feedback. Use Profile → Send feedback in the app, or email us at
support@cashraja.app.
''';
}
