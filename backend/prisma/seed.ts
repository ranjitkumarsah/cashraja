/**
 * Dev/staging seed (A2.4): super-admin + app_config defaults. Idempotent —
 * safe to re-run.
 * Usage: npx prisma db seed   (requires a reachable DATABASE_URL)
 *
 * NOTE (H10): the gift-card catalog is NOT seeded here. Cards auto-create on
 * inventory upload, so seeding placeholder ₹50/₹100/₹250 rows with zero stock
 * would surface phantom "out of stock" cards in the store.
 */
import { OfferNetwork, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SUPER_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@cashraja.local';
const SUPER_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!Dev123';

const CONFIG_DEFAULTS: Array<{ key: string; value: object }> = [
  { key: 'game.daily_round_cap', value: { rounds: 20 } },
  // Conservative launch economics (owner): every reward is ad-gated, so a reward
  // must stay within ~60% of one rewarded-ad's revenue at a low India eCPM.
  { key: 'game.coins_per_round', value: { easy: 2, medium: 3, hard: 5 } },
  { key: 'game.min_play_seconds', value: { easy: 10, medium: 20, hard: 30 } },
  // Phase D — server-issued game round expiry window (round-start → round-complete)
  { key: 'game.round_expiry_seconds', value: { seconds: 120 } },
  { key: 'ads.daily_view_cap', value: { views: 10, bonus_slot: 1 } },
  { key: 'referral.bonus_percent', value: { percent: 10, window_days: 30 } },
  { key: 'streak.day_rewards', value: { days: [2, 3, 4, 5, 6, 8, 10] } },
  { key: 'fraud.device_account_limits', value: { flag_over: 2, block_over: 3 } },
  // Phase E — offer-completion velocity window (Redis sliding-window rule).
  { key: 'fraud.offer_velocity', value: { max_completions: 20, window_minutes: 10 } },
  // Phase E — fraud severity → auto-action map (none | flagged_for_review | auto_banned).
  {
    key: 'fraud.severity_actions',
    value: { low: 'none', medium: 'flagged_for_review', high: 'auto_banned' },
  },
  { key: 'redemption.min_account_age_hours', value: { hours: 72 } },
  // Phase C — gift-card inventory low-stock alert threshold (per brand+denom)
  { key: 'inventory.low_stock_threshold', value: { threshold: 5 } },
  // Gift-card pricing rate (owner decision): coins per ₹1. Coin cost is COMPUTED
  // everywhere as denomination × this rate — gift_cards.coin_cost is no longer
  // the source of truth. Editable via the admin Config screen. Default 100 →
  // ₹10 = 1000 coins, ₹50 = 5000.
  { key: 'giftcard.coins_per_rupee', value: { value: 100 } },
  // Phase B — postback pipeline + ad SSV rewards
  { key: 'offers.pending_expiry_days', value: { days: 30 } },
  // G7 — rewarded views credited per user per UTC day (client-gated + SSV share this cap)
  { key: 'ads.daily_reward_cap', value: { views: 10 } },
  { key: 'ads.coins_per_rewarded_view', value: { coins: 5 } },
  { key: 'ads.max_reward_per_view', value: { coins: 100 } },
  // G7 — cooldown between two consecutive client-gated rewarded-ad claims
  { key: 'ads.reward_cooldown_seconds', value: { seconds: 60 } },
];

// Dev/E2E offers on the mock network (B3.3): launched via the mock adapter,
// completed via `npm run simulate:postback -- --network=mock ...`.
const MOCK_OFFERS: Array<{
  externalOfferId: string;
  title: string;
  description: string;
  coinReward: number;
  requirements: object | undefined;
}> = [
  {
    externalOfferId: 'mock-survey-1',
    title: 'Quick Survey: Shopping Habits',
    description: 'Answer 10 questions about how you shop online.',
    coinReward: 100,
    requirements: undefined,
  },
  {
    externalOfferId: 'mock-install-1',
    title: 'Install & Open: Puzzle Game',
    description: 'Install the game and reach level 3.',
    coinReward: 500,
    requirements: { countries: ['IN'] },
  },
  {
    externalOfferId: 'mock-signup-1',
    title: 'Sign up: Fintech App',
    description: 'Create an account and complete KYC.',
    coinReward: 1500,
    requirements: { countries: ['IN'], min_android: 10 },
  },
];

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
  await prisma.admin.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {},
    create: {
      email: SUPER_ADMIN_EMAIL,
      passwordHash,
      role: 'super_admin',
      status: 'active',
    },
  });
  console.log(`Seeded super-admin: ${SUPER_ADMIN_EMAIL}`);

  for (const { key, value } of CONFIG_DEFAULTS) {
    await prisma.appConfig.upsert({
      where: { key_version: { key, version: 1 } },
      update: {},
      create: { key, value, version: 1 },
    });
  }
  console.log(`Seeded app_config defaults: ${CONFIG_DEFAULTS.length} keys`);

  // Conservative launch prize table (owner): capped at 5 coins — every scratch
  // is ad-gated, so the top prize must sit within ~one rewarded-ad's value.
  const scratchTable = [
    { coins: 1, weight: 50 },
    { coins: 2, weight: 30 },
    { coins: 3, weight: 15 },
    { coins: 5, weight: 5 },
  ];
  await prisma.bonusConfig.upsert({
    where: { kind_version: { kind: 'scratch', version: 1 } },
    update: { weightedTable: scratchTable, attemptsPerDay: 3 },
    create: { kind: 'scratch', version: 1, attemptsPerDay: 3, weightedTable: scratchTable },
  });
  // Spin prizes: capped at 8 coins (once/day, so a slightly higher top prize).
  const spinTable = [
    { coins: 1, weight: 40 },
    { coins: 2, weight: 30 },
    { coins: 3, weight: 18 },
    { coins: 5, weight: 9 },
    { coins: 8, weight: 3 },
  ];
  await prisma.bonusConfig.upsert({
    where: { kind_version: { kind: 'spin', version: 1 } },
    update: { weightedTable: spinTable, attemptsPerDay: 1 },
    create: { kind: 'spin', version: 1, attemptsPerDay: 1, weightedTable: spinTable },
  });
  console.log('Seeded bonus_config (scratch v1, spin v1)');

  for (const offer of MOCK_OFFERS) {
    await prisma.offer.upsert({
      where: {
        network_externalOfferId: {
          network: OfferNetwork.mock,
          externalOfferId: offer.externalOfferId,
        },
      },
      update: {},
      create: {
        network: OfferNetwork.mock,
        externalOfferId: offer.externalOfferId,
        title: offer.title,
        description: offer.description,
        coinReward: offer.coinReward,
        requirements: offer.requirements,
        isActive: true,
      },
    });
  }
  console.log(`Seeded mock-network offers: ${MOCK_OFFERS.length}`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
