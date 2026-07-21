import { useState } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useAuth } from '../../lib/auth/auth-context';
import { getUser, getUserLedger, banUser, unbanUser } from '../../lib/api/users';
import { apiErrorMessage } from '../../lib/api/client';
import type { LedgerPageView } from '../../lib/api/types';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../../components/ui/Table';
import { EmptyState, ErrorState, LoadingState } from '../../components/QueryState';
import { ConfirmModal } from '../../components/ConfirmModal';
import { formatDateTime, formatNumber, formatSigned, humanize } from '../../lib/format';
import { userKeys } from './keys';
import { AdjustBalanceModal } from './AdjustBalanceModal';

export function UserDetailDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { admin } = useAuth();
  const isSuper = admin?.role === 'super_admin';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [banConfirm, setBanConfirm] = useState(false);

  const detail = useQuery({
    queryKey: userKeys.detail(userId),
    queryFn: () => getUser(userId),
  });

  const ledger = useInfiniteQuery({
    queryKey: userKeys.ledger(userId),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => getUserLedger(userId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: LedgerPageView) => last.next_cursor ?? undefined,
  });

  const user = detail.data;
  const isBanned = user?.status === 'banned';

  const banMutation = useMutation({
    mutationFn: () => (isBanned ? unbanUser(userId) : banUser(userId)),
    onSuccess: () => {
      toast({
        variant: 'success',
        title: isBanned ? 'User unbanned' : 'User banned',
      });
      queryClient.invalidateQueries({ queryKey: userKeys.detail(userId) });
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      setBanConfirm(false);
    },
    onError: (error) => {
      toast({
        variant: 'error',
        title: 'Action failed',
        description: apiErrorMessage(error, 'Could not update the user.'),
      });
    },
  });

  const entries = ledger.data?.pages.flatMap((p) => p.entries) ?? [];

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-primary-950/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-edge bg-surface-raised shadow-xl">
        <div className="flex items-start justify-between border-b border-edge px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-ink">
              {user ? user.display_name : 'User'}
            </h2>
            {user && <p className="truncate text-sm text-ink-muted">{user.email}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close user detail"
            className="rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        {detail.isLoading ? (
          <LoadingState label="Loading user…" />
        ) : detail.isError ? (
          <ErrorState error={detail.error} fallback="Could not load this user." />
        ) : user ? (
          <div className="space-y-6 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={user.status} />
              {user.country && <span className="text-sm text-ink-muted">{user.country}</span>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Balance
                </p>
                <p className="coin-num text-xl font-bold text-ink">
                  {formatNumber(user.coin_balance_cached)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Referral code
                </p>
                <p className="coin-num text-sm text-ink">{user.referral_code}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Joined
                </p>
                <p className="text-sm text-ink">{formatDateTime(user.created_at)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Last seen
                </p>
                <p className="text-sm text-ink">{formatDateTime(user.last_seen_at)}</p>
              </div>
            </div>

            {isSuper && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setAdjustOpen(true)}>
                  Adjust balance
                </Button>
                <Button
                  size="sm"
                  variant={isBanned ? 'outline' : 'danger'}
                  onClick={() => setBanConfirm(true)}
                >
                  {isBanned ? 'Unban user' : 'Ban user'}
                </Button>
              </div>
            )}

            {user.fraud_flags.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-ink">Fraud flags</h3>
                <div className="flex flex-wrap gap-2">
                  {user.fraud_flags.map((flag) => (
                    <div
                      key={flag.id}
                      className="rounded-lg border border-edge px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <StatusBadge status={flag.severity} />
                        <span className="font-medium text-ink">{humanize(flag.rule_triggered)}</span>
                      </div>
                      <p className="mt-1 text-ink-muted">
                        {humanize(flag.status)} · {formatDateTime(flag.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {user.devices.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-ink">Devices</h3>
                <ul className="space-y-1 text-xs text-ink-muted">
                  {user.devices.map((d) => (
                    <li key={d.id} className="coin-num truncate">
                      {d.device_fingerprint} · last {formatDateTime(d.last_seen)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-ink">Ledger history</h3>
              {ledger.isLoading ? (
                <LoadingState label="Loading ledger…" />
              ) : ledger.isError ? (
                <ErrorState error={ledger.error} fallback="Could not load the ledger." />
              ) : entries.length === 0 ? (
                <EmptyState title="No ledger entries yet" />
              ) : (
                <>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Source</TableHeaderCell>
                        <TableHeaderCell className="text-right">Amount</TableHeaderCell>
                        <TableHeaderCell className="text-right">Balance</TableHeaderCell>
                        <TableHeaderCell>When</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {entries.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell>{humanize(e.source_type)}</TableCell>
                          <TableCell
                            className={`coin-num text-right font-semibold ${
                              e.amount < 0 ? 'text-danger-600' : 'text-success-600'
                            }`}
                          >
                            {formatSigned(e.amount)}
                          </TableCell>
                          <TableCell className="coin-num text-right">
                            {formatNumber(e.balance_after)}
                          </TableCell>
                          <TableCell className="text-ink-muted">
                            {formatDateTime(e.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {ledger.hasNextPage && (
                    <div className="flex justify-center pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        loading={ledger.isFetchingNextPage}
                        onClick={() => ledger.fetchNextPage()}
                      >
                        Load more
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {isSuper && (
        <AdjustBalanceModal userId={userId} open={adjustOpen} onClose={() => setAdjustOpen(false)} />
      )}
      {isSuper && (
        <ConfirmModal
          open={banConfirm}
          onClose={() => setBanConfirm(false)}
          title={isBanned ? 'Unban user' : 'Ban user'}
          confirmLabel={isBanned ? 'Unban' : 'Ban'}
          variant={isBanned ? 'primary' : 'danger'}
          loading={banMutation.isPending}
          onConfirm={() => banMutation.mutate()}
          description={
            isBanned
              ? 'This restores the account to active. Pending redemptions can be reviewed again.'
              : 'Banning blocks earning and holds any pending redemptions. This is reversible.'
          }
        />
      )}
    </div>
  );
}
