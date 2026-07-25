import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { listFeedback, replyFeedback, resolveFeedback } from '../../lib/api/feedback';
import type { AdminFeedbackView } from '../../lib/api/types';
import { apiErrorMessage } from '../../lib/api/client';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Textarea';
import { Badge } from '../../components/ui/Badge';
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
  { value: 'in_review', label: 'In review' },
  { value: 'resolved', label: 'Resolved' },
];

const feedbackKeys = {
  all: ['feedback'] as const,
  list: (status: string) => ['feedback', 'list', status] as const,
};

const replySchema = z.object({
  reply: z.string().trim().min(1).max(2000),
});
type ReplyValues = z.infer<typeof replySchema>;

function FeedbackDetailModal({
  item,
  onClose,
}: {
  item: AdminFeedbackView;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ReplyValues>({
    resolver: zodResolver(replySchema),
    defaultValues: { reply: '' },
  });

  const replyMutation = useMutation({
    mutationFn: (values: ReplyValues) => replyFeedback(item.id, { reply: values.reply }),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Reply sent' });
      queryClient.invalidateQueries({ queryKey: feedbackKeys.all });
      onClose();
    },
    onError: (error) => {
      toast({
        variant: 'error',
        title: 'Reply failed',
        description: apiErrorMessage(error, 'Could not send this reply.'),
      });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: () => resolveFeedback(item.id),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Marked resolved' });
      queryClient.invalidateQueries({ queryKey: feedbackKeys.all });
      onClose();
    },
    onError: (error) => {
      toast({
        variant: 'error',
        title: 'Resolve failed',
        description: apiErrorMessage(error, 'Could not resolve this item.'),
      });
    },
  });

  const isResolved = item.status === 'resolved';

  return (
    <Modal
      open
      onClose={onClose}
      title={item.subject}
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          {!isResolved && (
            <Button
              variant="gold"
              type="button"
              loading={resolveMutation.isPending}
              onClick={() => resolveMutation.mutate()}
            >
              Resolve
            </Button>
          )}
          <Button type="submit" form="feedback-reply-form" loading={replyMutation.isPending}>
            Send reply
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-edge p-3 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant={item.type === 'complaint' ? 'danger' : 'neutral'}>
              {humanize(item.type)}
            </Badge>
            <StatusBadge status={item.status} />
          </div>
          <p className="mt-2 text-ink-muted">{item.user.email}</p>
          <p className="text-xs text-ink-faint">{formatDateTime(item.created_at)}</p>
          <p className="mt-2 whitespace-pre-wrap text-ink">{item.message}</p>
        </div>

        {item.admin_reply && (
          <div className="rounded-lg border border-edge bg-surface-muted/40 p-3 text-sm">
            <p className="font-medium text-ink">Previous reply</p>
            <p className="mt-1 whitespace-pre-wrap text-ink-muted">{item.admin_reply}</p>
          </div>
        )}

        <form
          id="feedback-reply-form"
          onSubmit={handleSubmit((values) => replyMutation.mutate(values))}
        >
          <Textarea
            label="Reply"
            rows={4}
            placeholder="Write a response to this user."
            error={errors.reply?.message}
            {...register('reply')}
          />
        </form>
      </div>
    </Modal>
  );
}

export function FeedbackPage() {
  const [status, setStatus] = useState('open');
  const [viewing, setViewing] = useState<AdminFeedbackView | null>(null);

  const query = useQuery({
    queryKey: feedbackKeys.list(status),
    queryFn: () => listFeedback(status),
  });

  const items = query.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feedback"
        description="User feedback and complaints — reply and resolve."
      />

      <Tabs tabs={TABS} value={status} onChange={setStatus} ariaLabel="Feedback status" />

      {query.isLoading ? (
        <LoadingState label="Loading feedback…" />
      ) : query.isError ? (
        <ErrorState error={query.error} fallback="Could not load feedback." />
      ) : items.length === 0 ? (
        <EmptyState
          title={status === 'resolved' ? 'No resolved items' : 'No items here'}
          description={status === 'open' ? 'The queue is clear.' : undefined}
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Subject</TableHeaderCell>
              <TableHeaderCell>User</TableHeaderCell>
              <TableHeaderCell>Submitted</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell className="text-right">Action</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Badge variant={item.type === 'complaint' ? 'danger' : 'neutral'}>
                    {humanize(item.type)}
                  </Badge>
                </TableCell>
                <TableCell className="text-ink">{item.subject}</TableCell>
                <TableCell className="text-ink-muted">{item.user.email}</TableCell>
                <TableCell className="text-ink-muted">{formatDateTime(item.created_at)}</TableCell>
                <TableCell>
                  <StatusBadge status={item.status} />
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" onClick={() => setViewing(item)}>
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {viewing && <FeedbackDetailModal item={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
