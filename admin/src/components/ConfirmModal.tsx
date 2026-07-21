import type { ReactNode } from 'react';
import { Modal } from './ui/Modal';
import { Button, type ButtonProps } from './ui/Button';

/** Reusable confirm dialog for destructive / audited actions. */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ButtonProps['variant'];
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={variant} type="button" loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && <p className="text-sm text-ink-muted">{description}</p>}
    </Modal>
  );
}
