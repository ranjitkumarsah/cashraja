import { randomUUID } from 'node:crypto';
import { Admin, AdminRole, AdminStatus } from '@prisma/client';

/**
 * In-memory stand-in for the Prisma surface AdminAuthService touches
 * (admins only). updateMany honors the conditional totpSecret:null write the
 * setup flow uses to guard against double-setup races.
 */
export class FakeAdminPrisma {
  adminsStore: Admin[] = [];

  seedAdmin(
    partial: Partial<Admin> & { email: string; passwordHash: string },
  ): Admin {
    const admin: Admin = {
      id: partial.id ?? randomUUID(),
      email: partial.email,
      passwordHash: partial.passwordHash,
      totpSecret: partial.totpSecret ?? null,
      role: partial.role ?? AdminRole.reviewer,
      status: partial.status ?? AdminStatus.active,
      createdAt: partial.createdAt ?? new Date(),
    };
    this.adminsStore.push(admin);
    return admin;
  }

  readonly admin = {
    findUnique: (args: { where: { id?: string; email?: string } }): Promise<Admin | null> => {
      const { id, email } = args.where;
      const found =
        this.adminsStore.find(
          (a) => (id !== undefined && a.id === id) || (email !== undefined && a.email === email),
        ) ?? null;
      return Promise.resolve(found);
    },
    updateMany: (args: {
      where: { id: string; totpSecret: null };
      data: { totpSecret: string };
    }): Promise<{ count: number }> => {
      let count = 0;
      for (const admin of this.adminsStore) {
        if (admin.id === args.where.id && admin.totpSecret === null) {
          admin.totpSecret = args.data.totpSecret;
          count++;
        }
      }
      return Promise.resolve({ count });
    },
  };
}
