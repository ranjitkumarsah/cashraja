import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Send } from 'lucide-react';
import { listBroadcasts, sendBroadcast } from '../../lib/api/notifications';
import type { BroadcastAudience, BroadcastView } from '../../lib/api/types';
import { apiErrorMessage } from '../../lib/api/client';
import { PageHeader } from '../../components/PageHeader';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../../components/ui/Table';
import { EmptyState, ErrorState, LoadingState } from '../../components/QueryState';
import { useToast } from '../../components/ui/Toast';
import { formatDateTime, formatNumber } from '../../lib/format';
import { UserPicker, type SelectedUser } from './UserPicker';
import { notificationKeys } from './keys';

const schema = z.object({
  title: z.string().trim().min(3, 'A title is required (min 3 characters)').max(120, 'Max 120 characters'),
  body: z.string().trim().min(3, 'A message is required (min 3 characters)').max(500, 'Max 500 characters'),
});
type FormValues = z.infer<typeof schema>;

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'All users' },
  { value: 'users', label: 'Specific users' },
];

export function NotificationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [audienceType, setAudienceType] = useState<'all' | 'users'>('all');
  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);
  const [recipientsError, setRecipientsError] = useState<string | undefined>();
  const [pending, setPending] = useState<{ values: FormValues; audience: BroadcastAudience } | null>(
    null,
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', body: '' },
  });

  const history = useQuery({
    queryKey: notificationKeys.broadcasts(),
    queryFn: listBroadcasts,
  });

  const mutation = useMutation({
    mutationFn: (payload: { values: FormValues; audience: BroadcastAudience }) =>
      sendBroadcast({
        title: payload.values.title,
        body: payload.values.body,
        audience: payload.audience,
      }),
    onSuccess: (result) => {
      toast({
        variant: 'success',
        title: 'Broadcast sent',
        description: `Delivered to ${formatNumber(result.broadcast.target_count)} user(s).`,
      });
      queryClient.invalidateQueries({ queryKey: notificationKeys.broadcasts() });
      reset();
      setSelectedUsers([]);
      setAudienceType('all');
      setPending(null);
    },
    onError: (error) => {
      toast({
        variant: 'error',
        title: 'Send failed',
        description: apiErrorMessage(error, 'Could not send the broadcast.'),
      });
      setPending(null);
    },
  });

  function onSubmit(values: FormValues) {
    setRecipientsError(undefined);
    if (audienceType === 'users' && selectedUsers.length === 0) {
      setRecipientsError('Add at least one recipient, or choose "All users".');
      return;
    }
    const audience: BroadcastAudience =
      audienceType === 'all'
        ? { type: 'all' }
        : { type: 'users', user_ids: selectedUsers.map((u) => u.id) };
    setPending({ values, audience });
  }

  const confirmDescription =
    pending?.audience.type === 'all'
      ? 'This will send a push notification and inbox message to ALL active users. This cannot be undone.'
      : `This will notify ${selectedUsers.length} selected user(s).`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Send notification"
        description="Broadcast a push + inbox message to all users or a specific list."
      />

      <Card>
        <CardHeader title="Compose" description="Keep it short and friendly." />
        <CardContent>
          <form id="broadcast-form" className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <Input
              label="Title"
              placeholder="e.g. New game just dropped!"
              error={errors.title?.message}
              {...register('title')}
            />
            <Textarea
              label="Message"
              rows={3}
              placeholder="Tell users what's new and why they should open the app."
              error={errors.body?.message}
              {...register('body')}
            />
            <Select
              label="Audience"
              options={AUDIENCE_OPTIONS}
              value={audienceType}
              onChange={(e) => {
                setAudienceType(e.target.value as 'all' | 'users');
                setRecipientsError(undefined);
              }}
            />
            {audienceType === 'users' && (
              <UserPicker
                selected={selectedUsers}
                onChange={setSelectedUsers}
                error={recipientsError}
              />
            )}
            <div className="flex justify-end">
              <Button type="submit" loading={mutation.isPending}>
                <Send className="size-4" />
                Send broadcast
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Sent history" description="Recent broadcasts, newest first." />
        <CardContent className="p-0">
          {history.isLoading ? (
            <div className="p-5">
              <LoadingState label="Loading history…" />
            </div>
          ) : history.isError ? (
            <div className="p-5">
              <ErrorState error={history.error} fallback="Could not load broadcast history." />
            </div>
          ) : (history.data?.broadcasts.length ?? 0) === 0 ? (
            <div className="p-5">
              <EmptyState title="No broadcasts yet" description="Sent broadcasts will appear here." />
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Title</TableHeaderCell>
                  <TableHeaderCell>Audience</TableHeaderCell>
                  <TableHeaderCell className="text-right">Recipients</TableHeaderCell>
                  <TableHeaderCell>Sent by</TableHeaderCell>
                  <TableHeaderCell>Sent</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.data?.broadcasts.map((b: BroadcastView) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <span className="font-medium text-ink">{b.title}</span>
                      <span className="block max-w-md truncate text-xs text-ink-muted">{b.body}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={b.audience_type === 'all' ? 'gold' : 'indigo'}>
                        {b.audience_type === 'all' ? 'All users' : 'Specific'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-ink">
                      {formatNumber(b.target_count)}
                    </TableCell>
                    <TableCell className="text-ink-muted">{b.sent_by_admin_email ?? '—'}</TableCell>
                    <TableCell className="text-ink-muted">{formatDateTime(b.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => pending && mutation.mutate(pending)}
        title="Send this broadcast?"
        description={confirmDescription}
        confirmLabel="Send now"
        variant={pending?.audience.type === 'all' ? 'danger' : 'primary'}
        loading={mutation.isPending}
      />
    </div>
  );
}
