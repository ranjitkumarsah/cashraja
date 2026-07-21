import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Copy, KeyRound, Plus } from 'lucide-react';
import { createAdmin, disableAdmin, listAdmins } from '../../lib/api/admins';
import type { AdminRole, AdminView, CreateAdminResult } from '../../lib/api/types';
import { apiErrorMessage } from '../../lib/api/client';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/Toast';
import { ConfirmModal } from '../../components/ConfirmModal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../../components/ui/Table';
import { EmptyState, ErrorState, LoadingState } from '../../components/QueryState';
import { formatDateTime, humanize } from '../../lib/format';

const adminKeys = { all: ['admins'] as const };

const ROLE_OPTIONS = [
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'super_admin', label: 'Super admin' },
];

const createSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  role: z.enum(['reviewer', 'super_admin']),
});
type CreateValues = z.infer<typeof createSchema>;

function CreateAdminModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (result: CreateAdminResult) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { email: '', role: 'reviewer' },
  });

  const mutation = useMutation({
    mutationFn: (values: CreateValues) => createAdmin({ email: values.email, role: values.role as AdminRole }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.all });
      onCreated(result);
    },
    onError: (error) => {
      toast({
        variant: 'error',
        title: 'Create failed',
        description: apiErrorMessage(error, 'Could not create the admin.'),
      });
    },
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Create admin"
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-admin-form" loading={mutation.isPending}>
            Create admin
          </Button>
        </>
      }
    >
      <form
        id="create-admin-form"
        noValidate
        className="space-y-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        <Input label="Email" type="email" placeholder="name@cashraja.app" error={errors.email?.message} {...register('email')} />
        <Select label="Role" options={ROLE_OPTIONS} error={errors.role?.message} {...register('role')} />
      </form>
    </Modal>
  );
}

function TempPasswordModal({ result, onClose }: { result: CreateAdminResult; onClose: () => void }) {
  const { toast } = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.temp_password);
      toast({ variant: 'success', title: 'Copied to clipboard' });
    } catch {
      toast({ variant: 'error', title: 'Copy failed', description: 'Copy it manually.' });
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Admin created"
      footer={
        <Button variant="primary" onClick={onClose}>
          I have saved it
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-gold-400/60 bg-gold-100 p-3 text-gold-600 dark:bg-gold-900/40 dark:text-gold-300">
          <KeyRound className="mt-0.5 size-5 shrink-0" />
          <p className="text-sm font-medium">
            This temporary password is shown once. It will never be displayed again — copy it now and
            share it securely with {result.email}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <code className="coin-num flex-1 select-all rounded-lg border border-edge bg-surface-muted px-3 py-2 text-center text-lg font-bold text-ink">
            {result.temp_password}
          </code>
          <Button variant="outline" onClick={copy} aria-label="Copy temporary password">
            <Copy className="size-4" />
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function AdminsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [tempResult, setTempResult] = useState<CreateAdminResult | null>(null);
  const [disabling, setDisabling] = useState<AdminView | null>(null);

  const query = useQuery({ queryKey: adminKeys.all, queryFn: listAdmins });

  const disableMutation = useMutation({
    mutationFn: (id: string) => disableAdmin(id),
    onSuccess: () => {
      toast({ variant: 'success', title: 'Admin disabled' });
      queryClient.invalidateQueries({ queryKey: adminKeys.all });
      setDisabling(null);
    },
    onError: (error) => {
      toast({
        variant: 'error',
        title: 'Disable failed',
        description: apiErrorMessage(error, 'Could not disable this admin.'),
      });
    },
  });

  const admins = query.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admins"
        description="Create and disable admin accounts, assign roles."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            New admin
          </Button>
        }
      />

      {query.isLoading ? (
        <LoadingState label="Loading admins…" />
      ) : query.isError ? (
        <ErrorState error={query.error} fallback="Could not load admins." />
      ) : admins.length === 0 ? (
        <EmptyState title="No admins" />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Email</TableHeaderCell>
              <TableHeaderCell>Role</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>TOTP</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
              <TableHeaderCell className="text-right">Action</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {admins.map((admin) => (
              <TableRow key={admin.id}>
                <TableCell className="font-medium text-ink">{admin.email}</TableCell>
                <TableCell>
                  <Badge variant={admin.role === 'super_admin' ? 'indigo' : 'neutral'}>
                    {humanize(admin.role)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <StatusBadge status={admin.status} />
                </TableCell>
                <TableCell>
                  {admin.totp_configured ? (
                    <Badge variant="success">Configured</Badge>
                  ) : (
                    <Badge variant="gold">Pending</Badge>
                  )}
                </TableCell>
                <TableCell className="text-ink-muted">{formatDateTime(admin.created_at)}</TableCell>
                <TableCell className="text-right">
                  {admin.status === 'active' ? (
                    <Button size="sm" variant="danger" onClick={() => setDisabling(admin)}>
                      Disable
                    </Button>
                  ) : (
                    <span className="text-xs text-ink-faint">Disabled</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {creating && (
        <CreateAdminModal
          onClose={() => setCreating(false)}
          onCreated={(result) => {
            setCreating(false);
            setTempResult(result);
          }}
        />
      )}
      {tempResult && (
        <TempPasswordModal result={tempResult} onClose={() => setTempResult(null)} />
      )}
      {disabling && (
        <ConfirmModal
          open
          onClose={() => setDisabling(null)}
          title="Disable admin"
          confirmLabel="Disable"
          variant="danger"
          loading={disableMutation.isPending}
          onConfirm={() => disableMutation.mutate(disabling.id)}
          description={`${disabling.email} will lose access immediately. This can be reversed by re-enabling in the database.`}
        />
      )}
    </div>
  );
}
