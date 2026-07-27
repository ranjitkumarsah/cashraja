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
    findMany: (args: {
      where?: {
        isActive?: boolean;
        OR?: Array<{ brand: GiftCardBrand; denomination: number }>;
      };
    }): Promise<FakeCard[]> => {
      let rows = [...this.cards];
      if (args.where?.isActive !== undefined) {
        rows = rows.filter((c) => c.isActive === args.where!.isActive);
      }
      if (args.where?.OR !== undefined) {
        const or = args.where.OR;
        rows = rows.filter((c) =>
          or.some((o) => o.brand === c.brand && o.denomination === c.denomination),
        );
      }
      return Promise.resolve(rows.sort((a, b) => a.coinCost - b.coinCost));
    },
    create: (args: { data: Omit<FakeCard, 'id' | 'createdAt'> }): Promise<FakeCard> => {
      const card: FakeCard = {
        id: `gen-${this.cards.length + 1}`,
        createdAt: new Date(),
        ...args.data,
      };
      this.cards.push(card);
      return Promise.resolve(card);
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

  it('is INVENTORY-DRIVEN: backfills a catalog row for in-stock denominations with none', async () => {
    // amazon ₹5 & ₹10 have unused stock but NO catalog row (uploaded before the
    // auto-create path existed). They must still be offered — with a catalog row
    // created so redemptions.gift_card_id stays valid.
    prisma.cards = []; // no catalog rows at all
    prisma.inventory = [
      { brand: GiftCardBrand.amazon, denomination: 5, status: InventoryStatus.unused },
      { brand: GiftCardBrand.amazon, denomination: 5, status: InventoryStatus.unused },
      { brand: GiftCardBrand.amazon, denomination: 5, status: InventoryStatus.unused },
      { brand: GiftCardBrand.amazon, denomination: 5, status: InventoryStatus.unused },
      { brand: GiftCardBrand.amazon, denomination: 10, status: InventoryStatus.unused },
    ];
    const list = await service.listActive();

    // Both denominations are offered, cheapest first, with correct availability.
    expect(list.map((c) => c.denomination)).toEqual([5, 10]);
    expect(list.find((c) => c.denomination === 5)!.available).toBe(4);
    expect(list.find((c) => c.denomination === 10)!.available).toBe(1);
    // coin_cost = denomination × config rate.
    expect(list.find((c) => c.denomination === 5)!.coin_cost).toBe(5 * RATE);
    expect(list.find((c) => c.denomination === 10)!.coin_cost).toBe(10 * RATE);
    // A catalog row was backfilled for each (valid FK for future redemptions).
    expect(prisma.cards).toHaveLength(2);
    expect(prisma.cards.every((c) => c.isActive)).toBe(true);
    // Every offered card carries a real catalog id.
    expect(list.every((c) => c.id.length > 0)).toBe(true);
  });

  it('does not create duplicate catalog rows when they already exist (idempotent)', async () => {
    prisma.inventory = [
      { brand: GiftCardBrand.amazon, denomination: 50, status: InventoryStatus.unused },
    ];
    await service.listActive();
    await service.listActive();
    // Still only the two seeded rows — no backfill duplicates.
    expect(prisma.cards).toHaveLength(2);
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
