import { GiftCardBrand, InventoryStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GiftCardsService } from './gift-cards.service';

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
    service = new GiftCardsService(prisma as unknown as PrismaService);
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

  it('reports unused-code counts as `available` per brand+denomination', async () => {
    prisma.inventory = [
      { brand: GiftCardBrand.amazon, denomination: 50, status: InventoryStatus.unused },
      { brand: GiftCardBrand.amazon, denomination: 50, status: InventoryStatus.unused },
      { brand: GiftCardBrand.amazon, denomination: 50, status: InventoryStatus.issued },
      // no unused ₹100 stock
      { brand: GiftCardBrand.amazon, denomination: 100, status: InventoryStatus.reserved },
    ];
    const list = await service.listActive();
    expect(list.find((c) => c.id === 'c50')!.available).toBe(2);
    expect(list.find((c) => c.id === 'c100')!.available).toBe(0);
  });

  it('defaults `available` to 0 when there is no inventory', async () => {
    const list = await service.listActive();
    expect(list.every((c) => c.available === 0)).toBe(true);
  });
});
