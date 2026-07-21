import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Eye } from 'lucide-react';
import {
  getStockLevels,
  listInventory,
  revealCode,
  uploadInventory,
} from '../../lib/api/inventory';
import type { InventoryItemView } from '../../lib/api/types';
import { apiErrorMessage } from '../../lib/api/client';
import { PageHeader } from '../../components/PageHeader';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Modal } from '../../components/ui/Modal';
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
import { formatNumber } from '../../lib/format';

const LOW_STOCK_THRESHOLD = 10;

const inventoryKeys = {
  stock: ['inventory', 'stock-levels'] as const,
  list: (params: object) => ['inventory', 'list', params] as const,
};

const BRAND_OPTIONS = [
  { value: '', label: 'Select a brand…' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'flipkart', label: 'Flipkart' },
  { value: 'google_play', label: 'Google Play' },
];

const uploadSchema = z.object({
  brand: z
    .string()
    .refine((b) => ['amazon', 'flipkart', 'google_play'].includes(b), 'Select a brand'),
  denomination: z.coerce
    .number({ invalid_type_error: 'Enter a denomination' })
    .int('Whole rupees only')
    .positive('Must be greater than zero'),
  codes: z.string().trim().min(1, 'Paste at least one code'),
});
type UploadValues = z.infer<typeof uploadSchema>;

function parseCodes(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((c) => c.trim())
    .filter(Boolean);
}

function UploadForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<UploadValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: { brand: '', denomination: 0, codes: '' },
  });

  const codesValue = useWatch({ control, name: 'codes' });
  const codeCount = parseCodes(codesValue ?? '').length;

  const mutation = useMutation({
    mutationFn: (values: UploadValues) =>
      uploadInventory({
        brand: values.brand,
        denomination: values.denomination,
        // Send the raw pasted text; the backend splits/trims/dedupes server-side.
        codes: values.codes,
      }),
    onSuccess: (result) => {
      toast({
        variant: 'success',
        title: 'Codes uploaded',
        description: `${result.inserted} inserted, ${result.skipped} skipped of ${result.total_submitted}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      reset();
    },
    onError: (error) => {
      toast({
        variant: 'error',
        title: 'Upload failed',
        description: apiErrorMessage(error, 'Could not upload codes.'),
      });
    },
  });

  return (
    <Card>
      <CardHeader title="Upload codes" description="Paste one code per line (or comma-separated)." />
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Brand" options={BRAND_OPTIONS} error={errors.brand?.message} {...register('brand')} />
            <Input
              type="number"
              label="Denomination (₹)"
              placeholder="100"
              error={errors.denomination?.message}
              {...register('denomination')}
            />
          </div>
          <Textarea
            label="Codes"
            rows={5}
            placeholder={'CODE-AAAA-1111\nCODE-BBBB-2222'}
            hint={codeCount > 0 ? `${codeCount} code${codeCount === 1 ? '' : 's'} detected` : undefined}
            error={errors.codes?.message}
            {...register('codes')}
          />
          <div className="flex justify-end">
            <Button type="submit" loading={mutation.isPending}>
              Upload {codeCount > 0 ? `${codeCount} codes` : 'codes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function StockLevels() {
  const stock = useQuery({
    queryKey: inventoryKeys.stock,
    queryFn: getStockLevels,
    refetchOnMount: 'always',
  });

  return (
    <Card>
      <CardHeader title="Stock levels" description="Low stock is highlighted." />
      <CardContent>
        {stock.isLoading ? (
          <LoadingState label="Loading stock…" />
        ) : stock.isError ? (
          <ErrorState error={stock.error} fallback="Could not load stock levels." />
        ) : (stock.data?.length ?? 0) === 0 ? (
          <EmptyState title="No stock yet" description="Upload codes to populate inventory." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {stock.data!.map((level) => {
              const low = level.unused < LOW_STOCK_THRESHOLD;
              return (
                <div
                  key={`${level.brand}-${level.denomination}`}
                  className={`rounded-xl border p-4 ${
                    low ? 'border-danger-500/60 bg-danger-50 dark:bg-danger-900/20' : 'border-edge'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-ink">
                      {level.brand} · ₹{formatNumber(level.denomination)}
                    </p>
                    {low && <AlertTriangle className="size-4 text-danger-500" aria-label="Low stock" />}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className={`coin-num text-lg font-bold ${low ? 'text-danger-600' : 'text-success-600'}`}>
                        {formatNumber(level.unused)}
                      </p>
                      <p className="text-xs text-ink-muted">Unused</p>
                    </div>
                    <div>
                      <p className="coin-num text-lg font-bold text-ink">{formatNumber(level.reserved)}</p>
                      <p className="text-xs text-ink-muted">Reserved</p>
                    </div>
                    <div>
                      <p className="coin-num text-lg font-bold text-ink">{formatNumber(level.issued)}</p>
                      <p className="text-xs text-ink-muted">Issued</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'unused', label: 'Unused' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'issued', label: 'Issued' },
];

function InventoryList() {
  const { toast } = useToast();
  const [brand, setBrand] = useState('');
  const [status, setStatus] = useState('');
  const [confirmItem, setConfirmItem] = useState<InventoryItemView | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);

  const params = { brand: brand || undefined, status: status || undefined };
  const list = useQuery({
    queryKey: inventoryKeys.list(params),
    queryFn: () => listInventory(params),
    // Inventory changes via redemption approvals on other screens — always
    // refetch on mount so the list can't show a stale status.
    refetchOnMount: 'always',
  });

  const revealMutation = useMutation({
    mutationFn: (id: string) => revealCode(id),
    onSuccess: (result) => {
      setRevealed(result.code);
      setConfirmItem(null);
    },
    onError: (error) => {
      toast({
        variant: 'error',
        title: 'Reveal failed',
        description: apiErrorMessage(error, 'Could not reveal this code.'),
      });
    },
  });

  return (
    <Card>
      <CardHeader title="Inventory" description="Revealing a code is audited." />
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <Input
              label="Filter by brand"
              placeholder="e.g. Amazon"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
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
        </div>

        {list.isLoading ? (
          <LoadingState label="Loading inventory…" />
        ) : list.isError ? (
          <ErrorState error={list.error} fallback="Could not load inventory." />
        ) : (list.data?.length ?? 0) === 0 ? (
          <EmptyState title="No inventory items" description="Adjust the filters or upload codes." />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Brand</TableHeaderCell>
                <TableHeaderCell className="text-right">Denomination</TableHeaderCell>
                <TableHeaderCell>Code</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell className="text-right">Action</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.data!.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-ink">{item.brand}</TableCell>
                  <TableCell className="coin-num text-right">
                    ₹{formatNumber(item.denomination)}
                  </TableCell>
                  <TableCell className="coin-num text-ink-muted">{item.code_masked}</TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setConfirmItem(item)}>
                      <Eye className="size-4" />
                      Reveal
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Modal
        open={confirmItem !== null}
        onClose={() => setConfirmItem(null)}
        title="Reveal gift-card code"
        footer={
          <>
            <Button variant="outline" type="button" onClick={() => setConfirmItem(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={revealMutation.isPending}
              onClick={() => confirmItem && revealMutation.mutate(confirmItem.id)}
            >
              Reveal code
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          Revealing writes an audit-log entry attributed to you. Only reveal a code when you need it
          to resolve a redemption.
        </p>
      </Modal>

      <Modal
        open={revealed !== null}
        onClose={() => setRevealed(null)}
        title="Gift-card code"
        footer={
          <Button variant="primary" onClick={() => setRevealed(null)}>
            Done
          </Button>
        }
      >
        <p className="mb-2 text-sm text-ink-muted">This reveal has been logged.</p>
        <p className="coin-num select-all rounded-lg border border-edge bg-surface-muted p-3 text-center text-lg font-bold text-ink">
          {revealed}
        </p>
      </Modal>
    </Card>
  );
}

export function InventoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Upload gift-card codes, watch stock levels, audit reveals."
      />
      <StockLevels />
      <UploadForm />
      <InventoryList />
    </div>
  );
}
