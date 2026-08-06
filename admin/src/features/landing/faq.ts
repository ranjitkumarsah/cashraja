/** Shared FAQ content — used by the landing FAQ section and the standalone
 *  `/faq` page. Keep answers honest and in step with the Terms + Privacy copy. */

export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    q: 'How do I earn coins?',
    a: 'Play quick games, complete verified offers, watch rewarded ads, keep daily streaks, and refer friends. Every reward is verified on our servers before it is credited to your balance.',
  },
  {
    q: 'What can I redeem my coins for?',
    a: 'Coins are redeemed for digital gift cards from the catalogue shown in the app, subject to availability. Coins have no cash value and cannot be transferred or exchanged for money.',
  },
  {
    q: 'Do I need to be 18 to use Cash Raja?',
    a: 'Yes. Cash Raja is intended only for users aged 18 and older. We do not knowingly collect data from anyone under 18.',
  },
  {
    q: 'How are gift cards delivered?',
    a: 'Approved redemptions are delivered digitally to the account on file. Requests are reviewed before fulfilment to protect against fraud and abuse.',
  },
  {
    q: 'How do referrals work?',
    a: 'When you refer a friend you can earn a bonus based on a percentage of their earnings for a limited time. Self-referrals and referrals between accounts on the same device are not eligible.',
  },
  {
    q: 'How long does a payout take?',
    a: 'Most redemptions are reviewed and fulfilled quickly, but review times can vary. You can track the status of any redemption from within the app.',
  },
  {
    q: 'Is Cash Raja legit and safe to use?',
    a: 'Yes. Cash Raja is a genuine rewards app: rewards are verified on our servers before they are credited, sign-in uses Google, and we keep a small data footprint. Coins are redeemable only for the digital gift cards shown in the app and have no cash value.',
  },
  {
    q: 'How can I earn a free Amazon gift card in India?',
    a: 'Join Cash Raja for free, complete offers, surveys and games to earn coins, then open the Rewards store and redeem your coins for an Amazon Pay gift card, subject to availability. Flipkart and Google Play gift cards are also available.',
  },
  {
    q: 'Is Cash Raja free to join?',
    a: 'Yes, Cash Raja is 100% free to join and use. There is no fee and no purchase is ever required to earn coins or redeem gift cards.',
  },
  {
    q: 'How much can I earn on Cash Raja?',
    a: 'Earnings depend on how many offers, surveys and games you complete and the rewards available at the time. Cash Raja is a rewards app, not a job or a guaranteed source of income.',
  },
];
