import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export function Field({
  label,
  className,
  error,
  children,
}: {
  label: string;
  className?: string;
  error?: { message?: string };
  children: React.ReactNode;
}) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-destructive">{error.message}</span>}
    </label>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function Notice({
  message,
  error = false,
}: {
  message: string;
  error?: boolean;
}) {
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={
        error
          ? 'flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive'
          : 'flex items-start gap-2 rounded-lg border border-emerald-600/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300'
      }
    >
      {error ? (
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      )}
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">{label}</div>
  );
}
