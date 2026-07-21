import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { useToast } from '../../components/ui/Toast';
import { adjustBalance } from '../../lib/api/users';
import { apiErrorMessage } from '../../lib/api/client';
import { formatSigned } from '../../lib/format';
import { userKeys } from './keys';

const schema = z.object({
  amount: z
    .number({ invalid_type_error: 'Enter a coin amount' })
    .int('Whole coins only')
    .refine((n) => n !== 0, 'Amount cannot be zero'),
  reason: z.string().trim().min(3, 'A reason is required (min 3 characters)'),
});
type FormValues = z.infer<typeof schema>;

export function AdjustBalanceModal({
  userId,
  open,
  onClose,
}: {
  userId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: 0, reason: '' },
  });

  const amount = useWatch({ control, name: 'amount' });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => adjustBalance(userId, values),
    onSuccess: (result) => {
      toast({
        variant: 'success',
        title: 'Balance adjusted',
        description: `New balance: ${result.balance_after} coins.`,
      });
      queryClient.invalidateQueries({ queryKey: userKeys.detail(userId) });
      queryClient.invalidateQueries({ queryKey: userKeys.ledger(userId) });
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      reset();
      onClose();
    },
    onError: (error) => {
      toast({
        variant: 'error',
        title: 'Adjustment failed',
        description: apiErrorMessage(error, 'Could not adjust the balance.'),
      });
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adjust balance"
      footer={
        <>
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            type="submit"
            form="adjust-balance-form"
            loading={mutation.isPending}
            variant={Number(amount) < 0 ? 'danger' : 'primary'}
          >
            {Number(amount) < 0 ? 'Deduct coins' : 'Credit coins'}
          </Button>
        </>
      }
    >
      <form
        id="adjust-balance-form"
        className="space-y-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        <Input
          type="number"
          label="Amount (coins)"
          hint="Use a negative number to deduct. This writes an audited ledger entry."
          error={errors.amount?.message}
          {...register('amount', { valueAsNumber: true })}
        />
        {Number.isFinite(amount) && amount !== 0 && (
          <p className="coin-num text-sm text-ink-muted">
            Ledger entry: <span className="font-semibold text-ink">{formatSigned(amount)}</span> coins
          </p>
        )}
        <Textarea
          label="Reason"
          rows={3}
          placeholder="Why is this adjustment being made?"
          error={errors.reason?.message}
          {...register('reason')}
        />
      </form>
    </Modal>
  );
}
