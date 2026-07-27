import { GiftCardBrand, InventoryStatus } from '@prisma/client';
import { AppConfigService } from '../../common/app-config/app-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GiftCardsService } from './gift-cards.service';

/** Fixed conversion rate: coins per ₹1 (config default). */
const RATE = 100;
const fakeAppConfig = {
  giftCardCoinsPerRupee: () => Promise.resolve(RATE),
} as unknown as AppConfigService;

interface FakeCard {
  id: string;
  brand: GiftCardBrand;
  denomination: number;
  coinCost: number;
  isActive: boolean;
  createdAt: Date;
}

interface FakeInv {
  brand: GiftCardBrand;
  denomination: number;
  status: InventoryStatus;
}

/** Minimal in-memory prisma surface for the catalog + inventory join (G0.2). */
class FakeGiftCardPrisma {
  cards: FakeCard[] = [];
  inventory: FakeInv[] = [];

  readonly giftCard = {
    findMany: (args: { where?: { isActive?: boolean } }): Promise<FakeCard[]> => {
      let rows = [...this.cards];
      if (args.where?.isActive !== undefined) {
        rows = rows.filter((c) => c.isActive === args.where!.isActive);
      }
      return Promise.resolve(rows.sort((a, b) => a.coinCost - b.coinCost));
    },
  };

  readonly giftCardInventory = {
    groupBy: (args: {
      where: { status: InventoryStatus };
    }): Promise<Array<{ brand: GiftCardBrand; denomination: number; _count: { _all: number } }>> => {
      const map = new Map<string, { brand: GiftCardBrand; denomination: number; count: number }>();
      for (const i of this.inventory) {
        if (i.status !== args.where.status) continue;
        const key = `${i.brand}:${i.denomination}`;
        const cur = map.get(key) ?? { brand: i.brand, denomination: i.denomination, count: 0 };
        cur.count += 1;
        map.set(key, cur);
      }
      return Promise.resolve(
        [...map.values()].map((v) => ({
          brand: v.brand,
          denomination: v.denomination,
          _count: { _all: v.count },
        })),
      );
    },
  };
}

describe('GiftCardsService availability (G0.2)', () => {
  let prisma: FakeGiftCardPrisma;
  let service: GiftCardsService;

  beforeEach(() => {
    prisma = new FakeGiftCardPrisma();
    service = new GiftCardsService(prisma as unknown as PrismaService, fakeAppConfig);
    prisma.cards = [
      {
        id: 'c50',
        brand: GiftCardBrand.amazon,
        denomination: 50,
        coinCost: 5000,
        isActive: true,
        createdAt: new Date(),
      },
      {
        id: 'c100',
        brand: GiftCardBrand.amazon,
        denomination: 100,
        coinCost: 10000,
        isActive: true,
        createdAt: new Date(),
      },
    ];
  });

  it('returns only IN-STOCK cards and reports unused-code counts as `available` (H10)', async () => {
    prisma.inventory = [
      { brand: GiftCardBrand.amazon, denomination: 50, status: InventoryStatus.unused },
      { brand: GiftCardBrand.amazon, denomination: 50, status: InventoryStatus.unused },
      { brand: GiftCardBrand.amazon, denomination: 50, status: InventoryStatus.issued },
      // no unused ₹100 stock — must be dropped from the public catalog (H10)
      { brand: GiftCardBrand.amazon, denomination: 100, status: InventoryStatus.reserved },
    ];
    const list = await service.listActive();
    expect(list.find((c) => c.id === 'c50')!.available).toBe(2);
    // The sold-out ₹100 card is omitted entirely (not returned with available: 0).
    expect(list.find((c) => c.id === 'c100')).toBeUndefined();
    expect(list.every((c) => c.available > 0)).toBe(true);
  });

  it('returns an empty catalog when there is no unused inventory (H10)', async () => {
    const list = await service.listActive();
    expect(list).toEqual([]);
  });

  it('COMPUTES coin_cost as denomination × config rate (ignores the stored column)', async () => {
    // Stored coinCost columns are deliberately wrong (999) — pricing must not use them.
    prisma.cards = prisma.cards.map((c) => ({ ...c, coinCost: 999 }));
    // Give both denominations unused stock so they appear in the in-stock catalog.
    prisma.inventory = [
      { brand: GiftCardBrand.amazon, denomination: 50, status: InventoryStatus.unused },
      { brand: GiftCardBrand.amazon, denomination: 100, status: InventoryStatus.unused },
    ];
    const list = await service.listActive();
    expect(list.find((c) => c.id === 'c50')!.coin_cost).toBe(50 * RATE); // 5000
    expect(list.find((c) => c.id === 'c100')!.coin_cost).toBe(100 * RATE); // 10000
  });
});
