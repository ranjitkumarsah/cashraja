import { useState } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Download } from 'lucide-react';
import {
  approveRedemption,
  exportRedemptions,
  listRedemptions,
  rejectRedemption,
} from '../../lib/api/redemptions';
import type { AdminRedemptionPage, AdminRedemptionView, ApproveResult } from '../../lib/api/types';
import { apiErrorMessage } from '../../lib/api/client';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Textarea';
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
import { formatDateTime, formatNumber } from '../../lib/format';
import { Tabs } from './Tabs';

const TABS = [
  { value: '', label: 'All' },
  { value: 'requested', label: 'Requested' },
  { value: 'under_review', label: 'Under review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'issued', label: 'Issued' },
];

const redemptionKeys = {
  all: ['redemptions'] as const,
  list: (status: string) => ['redemptions', 'list', status] as const,
};

const rejectSchema = z.object({
  reason: z.string().trim().min(3, 'A rejection reason is required (min 3 characters)'),
});
type RejectValues = z.infer<typeof rejectSchema>;

function approveToast(result: ApproveResult): Parameters<ReturnType<typeof useToast>['toast']>[0] {
  switch (result.outcome) {
    case 'issued':
      return { variant: 'success', title: 'Redemption issued', description: 'A gift-card code was assigned.' };
    case 'approved_pending':
      return {
        variant: 'info',
        title: 'Approved — awaiting stock',
        description:
          result.reason ??
          'No code was available. It will be issued automatically once inventory is restocked.',
      };
    case 'held_banned_user':
      return {
        variant: 'error',
        title: 'Held — user is banned',
        description: 'This redemption was held because the user is banned. Review the account first.',
      };
    default:
      return { variant: 'info', title: 'Redemption updated' };
  }
}

export function RedemptionsPage() {
  const [status, setStatus] = useState('');
  const [rejecting, setRejecting] = useState<AdminRedemptionView | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: redemptionKeys.list(status),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      listRedemptions({ status: status || undefined, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: AdminRedemptionPage) => last.next_cursor ?? undefined,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: redemptionKeys.all });
    // Approving/rejecting issues or returns a code, changing inventory + liability metrics.
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveRedemption(id),
    onSuccess: (result) => {
      toast(approveToast(result));
      invalidate();
    },
    onError: (error) => {
      toast({
        variant: 'error',
        title: 'Approval failed',
        description: apiErrorMessage(error, 'Could not approve this redemption.'),
      });
    },
  });

  const rejectForm = useForm<RejectValues>({
    resolver: zodResolver(rejectSchema),
    defaultValues: { reason: '' },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectRedemption(id, reason),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Redemption rejected' });
      invalidate();
      setRejecting(null);
      rejectForm.reset();
    },
    onError: (error) => {
      toast({
        variant: 'error',
        title: 'Rejection failed',
        description: apiErrorMessage(error, 'Could not reject this redemption.'),
      });
    },
  });

  const exportMutation = useMutation({
    mutationFn: () => exportRedemptions(status || undefined),
    onSuccess: (csv) => {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `redemptions${status ? `-${status}` : ''}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast({ variant: 'success', title: 'Export ready', description: 'CSV download started.' });
    },
    onError: (error) => {
      toast({
        variant: 'error',
        title: 'Export failed',
        description: apiErrorMessage(error, 'Could not export redemptions.'),
      });
    },
  });

  const redemptions = query.data?.pages.flatMap((p) => p.redemptions) ?? [];
  const canAct = (r: AdminRedemptionView) =>
    r.status === 'requested' || r.status === 'under_review' || r.status === 'approved';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Redemptions"
        description="Review queue, approve or reject with reasons, export payouts."
        actions={
          <Button
            variant="outline"
            loading={exportMutation.isPending}
            onClick={() => exportMutation.mutate()}
          >
            <Download className="size-4" />
            Export CSV
          </Button>
        }
      />

      <Tabs tabs={TABS} value={status} onChange={setStatus} ariaLabel="Redemption status" />

      {query.isLoading ? (
        <LoadingState label="Loading redemptions…" />
      ) : query.isError ? (
        <ErrorState error={query.error} fallback="Could not load redemptions." />
      ) : redemptions.length === 0 ? (
        <EmptyState title="Queue is clear" description="No redemptions in this status." />
      ) : (
        <div className="space-y-3">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>User</TableHeaderCell>
                <TableHeaderCell>Gift card</TableHeaderCell>
                <TableHeaderCell className="text-right">Coins</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Requested</TableHeaderCell>
                <TableHeaderCell className="text-right">Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {redemptions.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <span className="text-sm text-ink">{r.user.email}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-ink">{r.gift_card.brand}</span>
                    <span className="coin-num block text-xs text-ink-muted">
                      ₹{formatNumber(r.gift_card.denomination)}
                    </span>
                  </TableCell>
                  <TableCell className="coin-num text-right font-semibold text-ink">
                    {formatNumber(r.coin_amount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <StatusBadge status={r.status} />
                      {r.rejection_reason && (
                        <span className="text-xs text-danger-600">{r.rejection_reason}</span>
                      )}
                      {r.resolved_at && (
                        <span className="text-xs text-ink-faint">
                          resolved {formatDateTime(r.resolved_at)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-ink-muted">{formatDateTime(r.created_at)}</TableCell>
                  <TableCell className="text-right">
                    {canAct(r) ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          loading={approveMutation.isPending && approveMutation.variables === r.id}
                          onClick={() => approveMutation.mutate(r.id)}
                        >
                          Approve
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setRejecting(r)}>
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-ink-faint">—</span>
                    )}
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

      <Modal
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title="Reject redemption"
        footer={
          <>
            <Button variant="outline" type="button" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="reject-redemption-form"
              variant="danger"
              loading={rejectMutation.isPending}
            >
              Reject
            </Button>
          </>
        }
      >
        <form
          id="reject-redemption-form"
          onSubmit={rejectForm.handleSubmit((values) => {
            if (rejecting) rejectMutation.mutate({ id: rejecting.id, reason: values.reason });
          })}
        >
          <Textarea
            label="Reason"
            rows={3}
            placeholder="Explain why this redemption is rejected (shown to the user)."
            error={rejectForm.formState.errors.reason?.message}
            {...rejectForm.register('reason')}
          />
        </form>
      </Modal>
    </div>
  );
}
