/** Query keys for the Users resource — one namespace, invalidated on mutation. */
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (params: { status: string; search: string }) => [...userKeys.lists(), params] as const,
  detail: (id: string) => [...userKeys.all, 'detail', id] as const,
  ledger: (id: string) => [...userKeys.all, 'ledger', id] as const,
};
