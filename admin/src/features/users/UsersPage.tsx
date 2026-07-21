import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { listUsers } from '../../lib/api/users';
import type { AdminUserListPage } from '../../lib/api/types';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { StatusBadge } from '../../components/ui/StatusBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../../components/ui/Table';
import { EmptyState, ErrorState, LoadingState } from '../../components/QueryState';
import { formatDateTime, formatNumber } from '../../lib/format';
import { userKeys } from './keys';
import { UserDetailDrawer } from './UserDetailDrawer';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'banned', label: 'Banned' },
];

export function UsersPage() {
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = useInfiniteQuery({
    queryKey: userKeys.list({ status, search }),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      listUsers({
        status: status || undefined,
        search: search || undefined,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: AdminUserListPage) => last.next_cursor ?? undefined,
  });

  const users = query.data?.pages.flatMap((p) => p.users) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Search users, inspect ledgers, flag or ban, adjust balances."
      />

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(searchInput.trim());
        }}
      >
        <div className="min-w-64 flex-1">
          <Input
            label="Search"
            placeholder="Email or display name"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="w-48">
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline">
          <Search className="size-4" />
          Search
        </Button>
      </form>

      {query.isLoading ? (
        <LoadingState label="Loading users…" />
      ) : query.isError ? (
        <ErrorState error={query.error} fallback="Could not load users." />
      ) : users.length === 0 ? (
        <EmptyState title="No users match" description="Try a different search or status filter." />
      ) : (
        <div className="space-y-3">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>User</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell className="text-right">Balance</TableHeaderCell>
                <TableHeaderCell>Country</TableHeaderCell>
                <TableHeaderCell>Last seen</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow
                  key={user.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(user.id)}
                >
                  <TableCell>
                    <button
                      type="button"
                      className="text-left"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(user.id);
                      }}
                    >
                      <span className="font-medium text-ink">{user.display_name}</span>
                      <span className="block text-xs text-ink-muted">{user.email}</span>
                    </button>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={user.status} />
                  </TableCell>
                  <TableCell className="coin-num text-right font-semibold text-ink">
                    {formatNumber(user.coin_balance_cached)}
                  </TableCell>
                  <TableCell className="text-ink-muted">{user.country ?? '—'}</TableCell>
                  <TableCell className="text-ink-muted">
                    {formatDateTime(user.last_seen_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {query.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                loading={query.isFetchingNextPage}
                onClick={() => query.fetchNextPage()}
              >
                Load more
              </Button>
            </div>
          )}
        </div>
      )}

      {selectedId && (
        <UserDetailDrawer userId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
