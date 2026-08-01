/**
 * One-off: push the conservative launch reward economics to the LIVE database
 * without re-running the full seed (so the admin password + offers are untouched).
 * Both app_config and bonus_config are versioned and read at max(version), so we
 * INSERT a new version per key/kind — the same thing the admin Config screen does.
 * Run:  DATABASE_URL=<neon> npx ts-node scripts/apply-launch-config.ts
 */
import { BonusKind, Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setConfig(key: string, value: Prisma.InputJsonValue): Promise<void> {
  const latest = await prisma.appConfig.findFirst({
    where: { key },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const version = (latest?.version ?? 0) + 1;
  await prisma.appConfig.create({ data: { key, value, version } });
  console.log(`  app_config[${key}] v${version} =`, JSON.stringify(value));
}

async function setBonus(
  kind: BonusKind,
  attemptsPerDay: number,
  weightedTable: Array<{ coins: number; weight: number }>,
): Promise<void> {
  const latest = await prisma.bonusConfig.findFirst({
    where: { kind },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const version = (latest?.version ?? 0) + 1;
  await prisma.bonusConfig.create({
    data: {
      kind,
      version,
      attemptsPerDay,
      weightedTable: weightedTable as unknown as Prisma.InputJsonValue,
    },
  });
  const max = Math.max(...weightedTable.map((r) => r.coins));
  console.log(`  bonus_config[${kind}] v${version} attemptsPerDay=${attemptsPerDay} maxCoins=${max}`);
}

async function main(): Promise<void> {
  console.log('Applying conservative launch reward config (new versions)…');
  await setConfig('game.coins_per_round', { easy: 2, medium: 3, hard: 5 });
  await setConfig('streak.day_rewards', { days: [2, 3, 4, 5, 6, 8, 10] });
  await setBonus(BonusKind.scratch, 3, [
    { coins: 1, weight: 50 },
    { coins: 2, weight: 30 },
    { coins: 3, weight: 15 },
    { coins: 5, weight: 5 },
  ]);
  await setBonus(BonusKind.spin, 1, [
    { coins: 1, weight: 40 },
    { coins: 2, weight: 30 },
    { coins: 3, weight: 18 },
    { coins: 5, weight: 9 },
    { coins: 8, weight: 3 },
  ]);
  console.log('Done. New values take effect within ~60s (config cache TTL).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
