import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { listFraudFlags, resolveFraudFlag } from '../../lib/api/fraud';
import type { FraudFlagView, FraudResolveAction } from '../../lib/api/types';
import { apiErrorMessage } from '../../lib/api/client';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
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
import { Tabs } from '../redemptions/Tabs';
import { formatDateTime, humanize } from '../../lib/format';

const TABS = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
];

const fraudKeys = {
  all: ['fraud-flags'] as const,
  list: (status: string) => ['fraud-flags', 'list', status] as const,
};

const ACTION_OPTIONS = [
  { value: 'dismiss', label: 'Dismiss (false positive)' },
  { value: 'confirm', label: 'Confirm (keep flagged)' },
  { value: 'ban_user', label: 'Ban user' },
];

const resolveSchema = z.object({
  action: z.enum(['dismiss', 'ban_user', 'confirm']),
  note: z.string().trim().max(500).optional(),
});
type ResolveValues = z.infer<typeof resolveSchema>;

function ResolveModal({ flag, onClose }: { flag: FraudFlagView; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResolveValues>({
    resolver: zodResolver(resolveSchema),
    defaultValues: { action: 'dismiss', note: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: ResolveValues) =>
      resolveFraudFlag(flag.id, { action: values.action as FraudResolveAction, note: values.note }),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Flag resolved' });
      queryClient.invalidateQueries({ queryKey: fraudKeys.all });
      onClose();
    },
    onError: (error) => {
      toast({
        variant: 'error',
        title: 'Resolve failed',
        description: apiErrorMessage(error, 'Could not resolve this flag.'),
      });
    },
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Resolve fraud flag"
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="resolve-flag-form" loading={mutation.isPending}>
            Resolve
          </Button>
        </>
      }
    >
      <form
        id="resolve-flag-form"
        className="space-y-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        <div className="rounded-lg border border-edge p-3 text-sm">
          <p className="font-medium text-ink">{humanize(flag.rule_triggered)}</p>
          <p className="text-ink-muted">{flag.user.email}</p>
        </div>
        <Select label="Action" options={ACTION_OPTIONS} error={errors.action?.message} {...register('action')} />
        <Textarea
          label="Note (optional)"
          rows={3}
          placeholder="Context for this decision."
          error={errors.note?.message}
          {...register('note')}
        />
      </form>
    </Modal>
  );
}

export function FraudPage() {
  const [status, setStatus] = useState('open');
  const [resolving, setResolving] = useState<FraudFlagView | null>(null);

  const query = useQuery({
    queryKey: fraudKeys.list(status),
    queryFn: () => listFraudFlags(status),
  });

  const flags = query.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fraud"
        description="Flag review queue, velocity signals and rule outcomes."
      />

      <Tabs tabs={TABS} value={status} onChange={setStatus} ariaLabel="Fraud flag status" />

      {query.isLoading ? (
        <LoadingState label="Loading flags…" />
      ) : query.isError ? (
        <ErrorState error={query.error} fallback="Could not load fraud flags." />
      ) : flags.length === 0 ? (
        <EmptyState
          title={status === 'open' ? 'No open flags' : 'No resolved flags'}
          description={status === 'open' ? 'The queue is clear.' : undefined}
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>User</TableHeaderCell>
              <TableHeaderCell>Rule</TableHeaderCell>
              <TableHeaderCell>Severity</TableHeaderCell>
              <TableHeaderCell>Auto action</TableHeaderCell>
              <TableHeaderCell>Raised</TableHeaderCell>
              <TableHeaderCell className="text-right">Action</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {flags.map((flag) => (
              <TableRow key={flag.id}>
                <TableCell>
                  <span className="text-sm text-ink">{flag.user.email}</span>
                  <span className="block">
                    <StatusBadge status={flag.user.status} />
                  </span>
                </TableCell>
                <TableCell className="text-ink">{humanize(flag.rule_triggered)}</TableCell>
                <TableCell>
                  <StatusBadge status={flag.severity} />
                </TableCell>
                <TableCell className="text-ink-muted">{humanize(flag.auto_action)}</TableCell>
                <TableCell className="text-ink-muted">{formatDateTime(flag.created_at)}</TableCell>
                <TableCell className="text-right">
                  {flag.status === 'open' ? (
                    <Button size="sm" onClick={() => setResolving(flag)}>
                      Resolve
                    </Button>
                  ) : (
                    <span className="text-xs text-ink-faint">
                      {flag.resolution_action ? humanize(flag.resolution_action) : 'Resolved'}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {resolving && <ResolveModal flag={resolving} onClose={() => setResolving(null)} />}
    </div>
  );
}
