import { useState } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { listOffers, listPostbackLogs, updateOffer } from '../../lib/api/offers';
import type { AdminOfferView, PostbackLogPage, PostbackLogView } from '../../lib/api/types';
import { apiErrorMessage } from '../../lib/api/client';
import { PageHeader } from '../../components/PageHeader';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
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
import { formatDateTime, formatNumber, humanize } from '../../lib/format';

const offerKeys = {
  all: ['offers'] as const,
  postbacks: ['offers', 'postback-logs'] as const,
};

function CoinRewardEditor({ offer }: { offer: AdminOfferView }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(offer.coin_reward));

  const mutation = useMutation({
    mutationFn: (coin_reward: number) => updateOffer(offer.id, { coin_reward }),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Reward updated' });
      queryClient.invalidateQueries({ queryKey: offerKeys.all });
      setEditing(false);
    },
    onError: (error) => {
      toast({
        variant: 'error',
        title: 'Update failed',
        description: apiErrorMessage(error, 'Could not update the reward.'),
      });
    },
  });

  if (!editing) {
    return (
      <button
        type="button"
        className="coin-num font-semibold text-ink underline decoration-dotted underline-offset-4 hover:text-primary-700"
        onClick={() => {
          setValue(String(offer.coin_reward));
          setEditing(true);
        }}
      >
        {formatNumber(offer.coin_reward)}
      </button>
    );
  }

  const parsed = Number(value);
  const invalid = !Number.isInteger(parsed) || parsed < 0;

  return (
    <div className="flex items-center justify-end gap-2">
      <input
        aria-label={`Coin reward for ${offer.title}`}
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="coin-num h-8 w-24 rounded-md border border-edge bg-surface-raised px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/60"
      />
      <Button
        size="sm"
        loading={mutation.isPending}
        disabled={invalid}
        onClick={() => mutation.mutate(parsed)}
      >
        Save
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
        Cancel
      </Button>
    </div>
  );
}

function OfferActiveToggle({ offer }: { offer: AdminOfferView }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (is_active: boolean) => updateOffer(offer.id, { is_active }),
    onSuccess: (updated) => {
      toast({
        variant: 'success',
        title: updated.is_active ? 'Offer enabled' : 'Offer disabled',
      });
      queryClient.invalidateQueries({ queryKey: offerKeys.all });
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

function PostbackRow({ log }: { log: PostbackLogView }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setOpen((v) => !v)}>
        <TableCell>
          <span className="inline-flex items-center gap-1 text-ink">
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            {humanize(log.network)}
          </span>
        </TableCell>
        <TableCell className="coin-num text-ink-muted">{log.external_txn_id}</TableCell>
        <TableCell>
          <StatusBadge status={log.status} />
        </TableCell>
        <TableCell className="coin-num text-right font-semibold text-ink">
          {formatNumber(log.coin_reward)}
        </TableCell>
        <TableCell className="text-ink-muted">{formatDateTime(log.created_at)}</TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={5} className="bg-surface-muted/40">
            {log.status_reason && (
              <p className="mb-2 text-xs text-ink-muted">Reason: {log.status_reason}</p>
            )}
            <pre className="coin-num max-h-64 overflow-auto rounded-lg border border-edge bg-surface p-3 text-xs text-ink">
              {JSON.stringify(log.network_payload, null, 2)}
            </pre>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function OffersPage() {
  const offers = useQuery({ queryKey: offerKeys.all, queryFn: listOffers });

  const postbacks = useInfiniteQuery({
    queryKey: offerKeys.postbacks,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => listPostbackLogs(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: PostbackLogPage) => last.next_cursor ?? undefined,
  });

  const logs = postbacks.data?.pages.flatMap((p) => p.logs) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offers"
        description="Enable, disable and tune offers; inspect postback logs."
      />

      <Card>
        <CardHeader title="Offers" description="Toggle availability and tune coin rewards." />
        <CardContent className="p-0">
          {offers.isLoading ? (
            <LoadingState label="Loading offers…" />
          ) : offers.isError ? (
            <ErrorState error={offers.error} fallback="Could not load offers." />
          ) : (offers.data?.length ?? 0) === 0 ? (
            <EmptyState title="No offers yet" />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Offer</TableHeaderCell>
                  <TableHeaderCell>Network</TableHeaderCell>
                  <TableHeaderCell className="text-right">Coin reward</TableHeaderCell>
                  <TableHeaderCell>Active</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {offers.data!.map((offer) => (
                  <TableRow key={offer.id}>
                    <TableCell>
                      <span className="font-medium text-ink">{offer.title}</span>
                      <span className="block text-xs text-ink-muted">
                        {offer.external_offer_id}
                      </span>
                    </TableCell>
                    <TableCell className="text-ink-muted">{humanize(offer.network)}</TableCell>
                    <TableCell className="text-right">
                      <CoinRewardEditor offer={offer} />
                    </TableCell>
                    <TableCell>
                      <OfferActiveToggle offer={offer} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Postback logs"
          description="Raw offer-network callbacks. Expand a row for the full payload."
        />
        <CardContent className="p-0">
          {postbacks.isLoading ? (
            <LoadingState label="Loading postback logs…" />
          ) : postbacks.isError ? (
            <ErrorState error={postbacks.error} fallback="Could not load postback logs." />
          ) : logs.length === 0 ? (
            <EmptyState title="No postbacks recorded" />
          ) : (
            <div className="space-y-3">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Network</TableHeaderCell>
                    <TableHeaderCell>Txn</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell className="text-right">Reward</TableHeaderCell>
                    <TableHeaderCell>When</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((log) => (
                    <PostbackRow key={log.id} log={log} />
                  ))}
                </TableBody>
              </Table>
              {postbacks.hasNextPage && (
                <div className="flex justify-center pb-4">
                  <Button
                    variant="outline"
                    loading={postbacks.isFetchingNextPage}
                    onClick={() => postbacks.fetchNextPage()}
                  >
                    Load more
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
