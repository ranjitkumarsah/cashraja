/**
 * Dev/staging seed (A2.4): super-admin, gift-card catalog (₹50/₹100/₹250),
 * app_config defaults. Idempotent — safe to re-run.
 * Usage: npx prisma db seed   (requires a reachable DATABASE_URL)
 */
import { GiftCardBrand, PrismaClient } from '@prisma/client';
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
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
