import { forwardRef, useId, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const areaId = id ?? autoId;
  const errorId = `${areaId}-error`;

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={areaId} className="block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={areaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'w-full rounded-lg border bg-surface-raised px-3 py-2 text-sm text-ink',
          'placeholder:text-ink-faint transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-primary-500/60 focus:border-primary-500',
          error ? 'border-danger-500' : 'border-edge hover:border-ink-faint/50',
          className,
        )}
        {...rest}
      />
      {error ? (
        <p id={errorId} className="text-sm text-danger-600" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-sm text-ink-faint">{hint}</p>
      )}
    </div>
  );
});
