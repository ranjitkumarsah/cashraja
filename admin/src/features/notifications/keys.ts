/** Query keys for the admin notifications feature. */
export const notificationKeys = {
  all: ['admin-notifications'] as const,
  broadcasts: () => [...notificationKeys.all, 'broadcasts'] as const,
  userSearch: (q: string) => [...notificationKeys.all, 'user-search', q] as const,
};
