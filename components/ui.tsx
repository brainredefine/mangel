// components/ui.tsx
// Shared design primitives for the Mangel-App redesign.
// Neutral SaaS palette: zinc surfaces, near-black primary, indigo accent.

import React from 'react';

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* -------------------------------------------------------------------------- */
/*  Spinner                                                                   */
/* -------------------------------------------------------------------------- */

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Button                                                                    */
/* -------------------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-900',
  secondary: 'bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300',
  ghost: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
  danger: 'bg-red-600 text-white hover:bg-red-500',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, className, children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className
      )}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
});

/* -------------------------------------------------------------------------- */
/*  Inputs                                                                    */
/* -------------------------------------------------------------------------- */

const FIELD_BASE =
  'w-full rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 ' +
  'transition-colors focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(FIELD_BASE, 'h-11 px-3.5 text-sm', className)} {...rest} />;
  }
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(FIELD_BASE, 'px-3.5 py-2.5 text-sm min-h-[120px] resize-y', className)}
      {...rest}
    />
  );
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(FIELD_BASE, 'h-11 px-3 text-sm', className)} {...rest}>
      {children}
    </select>
  );
});

export function Label({ className, children, ...rest }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('block text-sm font-medium text-zinc-700 mb-1.5', className)} {...rest}>
      {children}
    </label>
  );
}

/** Labeled field wrapper. */
export function Field({
  label,
  hint,
  required,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <Label>
          {label}
          {required && <span className="text-indigo-600"> *</span>}
        </Label>
      )}
      {children}
      {hint && <p className="mt-1.5 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Card                                                                      */
/* -------------------------------------------------------------------------- */

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-2xl border border-zinc-200 bg-white shadow-sm', className)}
      {...rest}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Badge                                                                     */
/* -------------------------------------------------------------------------- */

export function Badge({ className, children, ...rest }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Ticket status / priority metadata (shared by tracking + admin lists)      */
/* -------------------------------------------------------------------------- */

export type TicketStatus = 'new' | 'open' | 'in_progress' | 'closed' | 'archived';

export const STATUS_META: Record<TicketStatus, { label: string; badge: string; dot: string }> = {
  new: { label: 'Neu', badge: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200', dot: 'bg-indigo-500' },
  open: { label: 'Offen', badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200', dot: 'bg-amber-500' },
  in_progress: { label: 'In Bearbeitung', badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200', dot: 'bg-blue-500' },
  closed: { label: 'Geschlossen', badge: 'bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200', dot: 'bg-zinc-400' },
  archived: { label: 'Archiviert', badge: 'bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200', dot: 'bg-zinc-300' },
};

export function statusMeta(status: string) {
  return STATUS_META[status as TicketStatus] ?? STATUS_META.new;
}

export function StatusBadge({ status }: { status: string }) {
  const m = statusMeta(status);
  return (
    <Badge className={m.badge}>
      <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
      {m.label}
    </Badge>
  );
}

export const PRIORITY_META: Record<string, { label: string; dot: string }> = {
  high: { label: 'Hoch', dot: 'bg-red-500' },
  medium: { label: 'Normal', dot: 'bg-amber-500' },
  low: { label: 'Niedrig', dot: 'bg-zinc-300' },
};

export function priorityMeta(priority: string) {
  return PRIORITY_META[priority] ?? PRIORITY_META.medium;
}
