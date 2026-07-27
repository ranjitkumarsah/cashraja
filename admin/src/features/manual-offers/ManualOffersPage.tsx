import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  approveManualOfferSubmission,
  createManualOffer,
  listManualOfferSubmissions,
  listManualOffers,
  rejectManualOfferSubmission,
  updateManualOffer,
} from '../../lib/api/manual-offers';
import type {
  AdminManualOfferSubmissionView,
  AdminManualOfferView,
} from '../../lib/api/types';
import { apiErrorMessage } from '../../lib/api/client';
import { useAuth } from '../../lib/auth/auth-context';
import { PageHeader } from '../../components/PageHeader';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Modal } from '../../components/ui/Modal';
import { Toggle } from '../../components/ui/Toggle';
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
import { InstructionsField } from './InstructionsField';
import { Tabs } from '../redemptions/Tabs';
import { formatDateTime, formatNumber } from '../../lib/format';

const manualOfferKeys = {
  offers: ['manual-offers'] as const,
  submissions: (status: string) => ['manual-offer-submissions', status] as const,
  submissionsAll: ['manual-offer-submissions'] as const,
};

const SUBMISSION_TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

// ── Offer create / edit form ──

const offerSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(3).max(2000),
  instructions: z.string().trim().min(3).max(2000),
  coin_reward: z.coerce.number().int().min(1),
});
type OfferValues = z.infer<typeof offerSchema>;

function OfferFormModal({
  offer,
  onClose,
}: {
  offer: AdminManualOfferView | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const editing = offer !== null;
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<OfferValues>({
    resolver: zodResolver(offerSchema),
    defaultValues: {
      title: offer?.title ?? '',
      description: offer?.description ?? '',
      instructions: offer?.instructions ?? '',
      coin_reward: offer?.coin_reward ?? 50,
    },
  });
  // useWatch (not watch()) so the live preview re-renders without tripping the
  // react-hooks incompatible-library rule.
  const instructionsValue =
    useWatch({ control, name: 'instructions', defaultValue: offer?.instructions ?? '' }) ?? '';

  const mutation = useMutation({
    mutationFn: (values: OfferValues) =>
      editing ? updateManualOffer(offer.id, values) : createManualOffer(values),
    onSuccess: () => {
      toast({ variant: 'success', title: editing ? 'Offer updated' : 'Offer created' });
      queryClient.invalidateQueries({ queryKey: manualOfferKeys.offers });
      onClose();
    },
    onError: (error) => {
      toast({
        variant: 'error',
        title: editing ? 'Update failed' : 'Create failed',
        description: apiErrorMessage(error, 'Could not save this offer.'),
      });
    },
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Edit manual offer' : 'New manual offer'}
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="manual-offer-form" loading={mutation.isPending}>
            {editing ? 'Save changes' : 'Create offer'}
          </Button>
        </>
      }
    >
      <form
        id="manual-offer-form"
        className="space-y-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        <Input label="Title" placeholder="Follow us on Instagram" error={errors.title?.message} {...register('title')} />
        <Textarea
          label="Description"
          rows={2}
          placeholder="A short summary users see first."
          error={errors.description?.message}
          {...register('description')}
        />
        <InstructionsField
          registration={register('instructions')}
          value={instructionsValue}
          error={errors.instructions?.message}
          onValueChange={(next) =>
            setValue('instructions', next, { shouldValidate: true, shouldDirty: true })
          }
        />
        <Input
          label="Coin reward"
          type="number"
          min={1}
          error={errors.coin_reward?.message}
          {...register('coin_reward')}
        />
      </form>
    </Modal>
  );
}

function OfferActiveToggle({ offer }: { offer: AdminManualOfferView }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (is_active: boolean) => updateManualOffer(offer.id, { is_active }),
    onSuccess: (updated) => {
      toast({
        variant: 'success',
        title: updated.is_active ? 'Offer enabled' : 'Offer disabled',
      });
      queryClient.invalidateQueries({ queryKey: manualOfferKeys.offers });
    },
    onError: (error) => {
      toast({
        variant: 'error',
        title: 'Update failed',
        description: apiErrorMessage(error, 'Could not update the offer.'),
      });
    },
  });

  return (
    <Toggle
      checked={offer.is_active}
      disabled={mutation.isPending}
      onChange={(next) => mutation.mutate(next)}
      label={`Toggle ${offer.title}`}
    />
  );
}

function ManageOffersSection() {
  const [formOffer, setFormOffer] = useState<AdminManualOfferView | null>(null);
  const [creating, setCreating] = useState(false);
  const offers = useQuery({ queryKey: manualOfferKeys.offers, queryFn: listManualOffers });

  return (
    <Card>
      <CardHeader
        title="Manage offers"
        description="Create, edit and enable/disable manual offers."
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            New offer
          </Button>
        }
      />
      <CardContent className="p-0">
        {offers.isLoading ? (
          <LoadingState label="Loading offers…" />
        ) : offers.isError ? (
          <ErrorState error={offers.error} fallback="Could not load offers." />
        ) : (offers.data?.length ?? 0) === 0 ? (
          <EmptyState title="No manual offers yet" description="Create one to get started." />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Offer</TableHeaderCell>
                <TableHeaderCell className="text-right">Coin reward</TableHeaderCell>
                <TableHeaderCell>Active</TableHeaderCell>
                <TableHeaderCell className="text-right">Action</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {offers.data!.map((offer) => (
                <TableRow key={offer.id}>
                  <TableCell>
                    <span className="font-medium text-ink">{offer.title}</span>
                    <span className="block text-xs text-ink-muted">{offer.description}</span>
                  </TableCell>
                  <TableCell className="coin-num text-right font-semibold text-ink">
                    {formatNumber(offer.coin_reward)}
                  </TableCell>
                  <TableCell>
                    <OfferActiveToggle offer={offer} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setFormOffer(offer)}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {creating && <OfferFormModal offer={null} onClose={() => setCreating(false)} />}
      {formOffer && <OfferFormModal offer={formOffer} onClose={() => setFormOffer(null)} />}
    </Card>
  );
}

// ── Submission review ──

const rejectSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
type RejectValues = z.infer<typeof rejectSchema>;

function SubmissionReviewModal({
  item,
  onClose,
}: {
  item: AdminManualOfferSubmissionView;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RejectValues>({
    resolver: zodResolver(rejectSchema),
    defaultValues: { reason: '' },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: manualOfferKeys.submissionsAll });

  const approveMutation = useMutation({
    mutationFn: () => approveManualOfferSubmission(item.id),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Approved & credited' });
      invalidate();
      onClose();
    },
    onError: (error) => {
      toast({
        variant: 'error',
        title: 'Approve failed',
        description: apiErrorMessage(error, 'Could not approve this submission.'),
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (values: RejectValues) =>
      rejectManualOfferSubmission(item.id, { reason: values.reason }),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Submission rejected' });
      invalidate();
      onClose();
    },
    onError: (error) => {
      toast({
        variant: 'error',
        title: 'Reject failed',
        description: apiErrorMessage(error, 'Could not reject this submission.'),
      });
    },
  });

  const pending = item.status === 'pending';

  return (
    <Modal
      open
      onClose={onClose}
      title={item.offer.title}
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose}>
            Close
          </Button>
          {pending && !rejecting && (
            <>
              <Button
                variant="danger"
                type="button"
                onClick={() => setRejecting(true)}
              >
                Reject
              </Button>
              <Button
                variant="gold"
                type="button"
                loading={approveMutation.isPending}
                onClick={() => approveMutation.mutate()}
              >
                Approve &amp; credit
              </Button>
            </>
          )}
          {pending && rejecting && (
            <Button type="submit" form="reject-form" loading={rejectMutation.isPending}>
              Confirm reject
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-edge p-3 text-sm">
          <div className="flex items-center gap-2">
            <StatusBadge status={item.status} />
            <span className="coin-num font-semibold text-ink">
              +{formatNumber(item.offer.coin_reward)}
            </span>
          </div>
          <p className="mt-2 text-ink-muted">{item.user.email}</p>
          <p className="text-xs text-ink-faint">{formatDateTime(item.created_at)}</p>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-ink">Proof</p>
          <p className="whitespace-pre-wrap rounded-lg border border-edge bg-surface-muted/40 p-3 text-sm text-ink">
            {item.proof_text}
          </p>
        </div>

        {item.review_reason && (
          <p className="text-sm text-danger-600">Reason: {item.review_reason}</p>
        )}

        {pending && rejecting && (
          <form
            id="reject-form"
            onSubmit={handleSubmit((values) => rejectMutation.mutate(values))}
          >
            <Textarea
              label="Rejection reason"
              rows={3}
              placeholder="Tell the user why this proof was rejected."
              error={errors.reason?.message}
              {...register('reason')}
            />
          </form>
        )}
      </div>
    </Modal>
  );
}

function SubmissionsSection() {
  const [status, setStatus] = useState('pending');
  const [viewing, setViewing] = useState<AdminManualOfferSubmissionView | null>(null);

  const query = useQuery({
    queryKey: manualOfferKeys.submissions(status),
    queryFn: () => listManualOfferSubmissions(status),
  });

  const items = query.data ?? [];

  return (
    <Card>
      <CardHeader
        title="Submission review"
        description="Review text proof, then approve (credits coins) or reject with a reason."
      />
      <CardContent className="space-y-4">
        <Tabs
          tabs={SUBMISSION_TABS}
          value={status}
          onChange={setStatus}
          ariaLabel="Submission status"
        />
        {query.isLoading ? (
          <LoadingState label="Loading submissions…" />
        ) : query.isError ? (
          <ErrorState error={query.error} fallback="Could not load submissions." />
        ) : items.length === 0 ? (
          <EmptyState
            title={status === 'pending' ? 'Nothing to review' : 'No submissions here'}
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Offer</TableHeaderCell>
                <TableHeaderCell>User</TableHeaderCell>
                <TableHeaderCell>Submitted</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell className="text-right">Action</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-ink">{item.offer.title}</TableCell>
                  <TableCell className="text-ink-muted">{item.user.email}</TableCell>
                  <TableCell className="text-ink-muted">
                    {formatDateTime(item.created_at)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => setViewing(item)}>
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {viewing && (
        <SubmissionReviewModal item={viewing} onClose={() => setViewing(null)} />
      )}
    </Card>
  );
}

export function ManualOffersPage() {
  const { admin } = useAuth();
  const canManage = admin?.role === 'super_admin';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manual offers"
        description="Author manual offers and review users' text-proof submissions."
      />
      {canManage && <ManageOffersSection />}
      <SubmissionsSection />
    </div>
  );
}
