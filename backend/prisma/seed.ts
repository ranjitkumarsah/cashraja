/**
 * Dev/staging seed (A2.4): super-admin, gift-card catalog (₹50/₹100/₹250),
 * app_config defaults. Idempotent — safe to re-run.
 * Usage: npx prisma db seed   (requires a reachable DATABASE_URL)
 */
import { GiftCardBrand, OfferNetwork, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SUPER_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@cashraja.local';
const SUPER_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!Dev123';

// coin economy default: 1000 coins ≈ ₹10 → coin_cost = denomination * 100
const CATALOG: Array<{ brand: GiftCardBrand; denomination: number }> = [
  { brand: GiftCardBrand.amazon, denomination: 50 },
  { brand: GiftCardBrand.amazon, denomination: 100 },
  { brand: GiftCardBrand.amazon, denomination: 250 },
  { brand: GiftCardBrand.flipkart, denomination: 50 },
  { brand: GiftCardBrand.flipkart, denomination: 100 },
  { brand: GiftCardBrand.flipkart, denomination: 250 },
  { brand: GiftCardBrand.google_play, denomination: 50 },
  { brand: GiftCardBrand.google_play, denomination: 100 },
  { brand: GiftCardBrand.google_play, denomination: 250 },
];

const CONFIG_DEFAULTS: Array<{ key: string; value: object }> = [
  { key: 'game.daily_round_cap', value: { rounds: 20 } },
  { key: 'game.coins_per_round', value: { easy: 5, medium: 10, hard: 20 } },
  { key: 'game.min_play_seconds', value: { easy: 10, medium: 20, hard: 30 } },
  { key: 'ads.daily_view_cap', value: { views: 10, bonus_slot: 1 } },
  { key: 'referral.bonus_percent', value: { percent: 10, window_days: 30 } },
  { key: 'streak.day_rewards', value: { days: [5, 10, 15, 20, 30, 40, 50] } },
  { key: 'fraud.device_account_limits', value: { flag_over: 2, block_over: 3 } },
  { key: 'redemption.min_account_age_hours', value: { hours: 72 } },
  // Phase C — gift-card inventory low-stock alert threshold (per brand+denom)
  { key: 'inventory.low_stock_threshold', value: { threshold: 5 } },
  // Phase B — postback pipeline + ad SSV rewards
  { key: 'offers.pending_expiry_days', value: { days: 30 } },
  { key: 'ads.daily_reward_cap', value: { views: 20 } },
  { key: 'ads.coins_per_rewarded_view', value: { coins: 5 } },
  { key: 'ads.max_reward_per_view', value: { coins: 100 } },
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

  for (const { brand, denomination } of CATALOG) {
    await prisma.giftCard.upsert({
      where: { brand_denomination: { brand, denomination } },
      update: {},
      create: { brand, denomination, coinCost: denomination * 100, isActive: true },
    });
  }
  console.log(`Seeded gift-card catalog: ${CATALOG.length} entries`);

  for (const { key, value } of CONFIG_DEFAULTS) {
    await prisma.appConfig.upsert({
      where: { key_version: { key, version: 1 } },
      update: {},
      create: { key, value, version: 1 },
    });
  }
  console.log(`Seeded app_config defaults: ${CONFIG_DEFAULTS.length} keys`);

  await prisma.bonusConfig.upsert({
    where: { kind_version: { kind: 'scratch', version: 1 } },
    update: {},
    create: {
      kind: 'scratch',
      version: 1,
      attemptsPerDay: 3,
      weightedTable: [
        { coins: 1, weight: 50 },
        { coins: 5, weight: 30 },
        { coins: 10, weight: 15 },
        { coins: 50, weight: 5 },
      ],
    },
  });
  await prisma.bonusConfig.upsert({
    where: { kind_version: { kind: 'spin', version: 1 } },
    update: {},
    create: {
      kind: 'spin',
      version: 1,
      attemptsPerDay: 1,
      weightedTable: [
        { coins: 0, weight: 30 },
        { coins: 2, weight: 35 },
        { coins: 5, weight: 20 },
        { coins: 20, weight: 10 },
        { coins: 100, weight: 5 },
      ],
    },
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
