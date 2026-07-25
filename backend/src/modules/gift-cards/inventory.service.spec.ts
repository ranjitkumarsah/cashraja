import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { GiftCardBrand, InventoryStatus, Prisma } from '@prisma/client';
import { AlertPayload, AlertService } from '../../common/alerts/alert.service';
import { AppConfigService } from '../../common/app-config/app-config.service';
import { GiftCardCryptoService } from '../../common/crypto/giftcard-crypto.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InventoryService, parseCodes } from './inventory.service';

interface Row {
  id: string;
  brand: string;
  denomination: number;
  codeEncrypted: string;
  codeFingerprint: string;
  status: InventoryStatus;
  uploadedByAdminId: string;
  redemptionId: string | null;
  createdAt: Date;
}

interface FakeCard {
  id: string;
  brand: string;
  denomination: number;
  coinCost: number;
  isActive: boolean;
}

/** Fake enforcing the (brand, denomination, codeFingerprint) unique constraint. */
class FakeInventoryPrisma {
  rows: Row[] = [];
  cards: FakeCard[] = [];
  audits: Array<{ action: string; targetId: string | null }> = [];

  async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    return fn(this.txClient());
  }

  private txClient(): unknown {
    return {
      giftCard: {
        findUnique: (args: { where: { brand_denomination: { brand: string; denomination: number } } }) => {
          const { brand, denomination } = args.where.brand_denomination;
          return Promise.resolve(
            this.cards.find((c) => c.brand === brand && c.denomination === denomination) ?? null,
          );
        },
        create: (args: { data: Omit<FakeCard, 'id'> }) => {
          const card: FakeCard = { id: randomUUID(), ...args.data };
          this.cards.push(card);
          return Promise.resolve(card);
        },
      },
      giftCardInventory: {
        create: (args: { data: Omit<Row, 'id' | 'createdAt'> }) => {
          const d = args.data;
          if (
            this.rows.some(
              (r) =>
                r.brand === d.brand &&
                r.denomination === d.denomination &&
                r.codeFingerprint === d.codeFingerprint,
            )
          ) {
            throw new Prisma.PrismaClientKnownRequestError('unique', {
              code: 'P2002',
              clientVersion: 'fake',
              meta: { target: ['brand', 'denomination', 'code_fingerprint'] },
            });
          }
          const row: Row = { id: randomUUID(), createdAt: new Date(), ...d };
          this.rows.push(row);
          return Promise.resolve(row);
        },
        findUnique: (args: { where: { id: string } }) =>
          Promise.resolve(this.rows.find((r) => r.id === args.where.id) ?? null),
      },
      adminAuditLog: {
        create: (args: { data: { action: string; targetId: string | null } }) => {
          this.audits.push({ action: args.data.action, targetId: args.data.targetId });
          return Promise.resolve({});
        },
      },
    };
  }
}

const KEY = 'c'.repeat(64);

function build(): {
  prisma: FakeInventoryPrisma;
  service: InventoryService;
  alerts: AlertPayload[];
} {
  const prisma = new FakeInventoryPrisma();
  const crypto = new GiftCardCryptoService({
    get: (k: string) => (k === 'AES_KEY' ? KEY : undefined),
  } as unknown as ConfigService);
  const appConfig = { getNumber: async () => 5 } as unknown as AppConfigService;
  const alerts: AlertPayload[] = [];
  const alertService: AlertService = {
    alert: async (p) => {
      alerts.push(p);
    },
  };
  const service = new InventoryService(
    prisma as unknown as PrismaService,
    crypto,
    appConfig,
    alertService,
  );
  return { prisma, service, alerts };
}

describe('parseCodes', () => {
  it('splits on newlines, commas and whitespace; trims; drops blanks', () => {
    expect(parseCodes('A-1\nB-2, C-3\n\n  D-4  \n')).toEqual(['A-1', 'B-2', 'C-3', 'D-4']);
  });
});

describe('InventoryService.upload', () => {
  it('encrypts each code and de-dupes within the paste', async () => {
    const { prisma, service } = build();
    const result = await service.upload('admin-1', GiftCardBrand.amazon, 100, 'X-1\nX-2\nX-1');
    expect(result.inserted).toBe(2); // X-1 duplicated in paste → counted once
    expect(result.skipped).toBe(1);
    expect(prisma.rows).toHaveLength(2);
    // stored ciphertext, never plaintext
    expect(prisma.rows.every((r) => !r.codeEncrypted.includes('X-'))).toBe(true);
    expect(prisma.audits.some((a) => a.action === 'inventory_uploaded')).toBe(true);
  });

  it('skips codes already present for the same brand+denom (dedupe constraint)', async () => {
    const { service, prisma } = build();
    await service.upload('admin-1', GiftCardBrand.amazon, 100, 'DUP-CODE');
    const second = await service.upload('admin-1', GiftCardBrand.amazon, 100, 'DUP-CODE\nNEW-CODE');
    expect(second.inserted).toBe(1); // only NEW-CODE
    expect(prisma.rows).toHaveLength(2);
  });

  it('auto-creates the catalog row for a new brand+denomination (offerable)', async () => {
    const { service, prisma } = build();
    await service.upload('admin-1', GiftCardBrand.amazon, 10, 'AMZ-10-A\nAMZ-10-B');
    expect(prisma.cards).toHaveLength(1);
    const card = prisma.cards[0];
    expect(card.brand).toBe(GiftCardBrand.amazon);
    expect(card.denomination).toBe(10);
    expect(card.isActive).toBe(true);
    // coin_cost column is reference-only (denomination × default rate 100).
    expect(card.coinCost).toBe(1000);
    expect(prisma.audits.some((a) => a.action === 'gift_card_created')).toBe(true);
  });

  it('does not duplicate the catalog row on a second upload for the same denomination', async () => {
    const { service, prisma } = build();
    await service.upload('admin-1', GiftCardBrand.amazon, 10, 'AMZ-10-A');
    await service.upload('admin-1', GiftCardBrand.amazon, 10, 'AMZ-10-B');
    expect(prisma.cards).toHaveLength(1);
  });
});

describe('InventoryService.reveal', () => {
  it('decrypts the code and writes an audit row', async () => {
    const { service, prisma } = build();
    await service.upload('admin-1', GiftCardBrand.flipkart, 50, 'REVEAL-ME-1234');
    const id = prisma.rows[0].id;

    const revealed = await service.reveal('admin-9', id);
    expect(revealed.code).toBe('REVEAL-ME-1234');
    expect(prisma.audits.some((a) => a.action === 'inventory_code_revealed' && a.targetId === id)).toBe(
      true,
    );
  });
});
