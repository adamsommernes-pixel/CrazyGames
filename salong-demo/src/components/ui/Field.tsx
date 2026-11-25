import type { ComponentProps } from "react";
import { cx } from "./cx";

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optionalLabel?: string;
  className?: string;
  children: (aria: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => React.ReactNode;
}

/** Label, hint and inline error wired to the control with aria attributes. */
export function Field({ id, label, hint, error, optionalLabel, className, children }: FieldProps) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="flex items-baseline justify-between gap-4 text-small font-medium">
        {label}
        {optionalLabel && <span className="label font-normal text-muted">{optionalLabel}</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-small text-muted">
          {hint}
        </p>
      )}
      <div className="mt-2">{children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}</div>
      {error && (
        <p id={`${id}-error`} className="mt-2 flex gap-2 text-small font-medium text-accent">
          <span aria-hidden="true">!</span>
          {error}
        </p>
      )}
    </div>
  );
}

const control =
  "block w-full rounded-ctl border border-line-strong bg-paper px-4 text-body text-ink placeholder:text-muted/70 transition-colors hover:border-ink focus:border-ink focus-visible:outline-2 aria-[invalid=true]:border-accent aria-[invalid=true]:border-2";

export function TextInput({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cx(control, "min-h-13", className)} {...rest} />;
}

export function TextArea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={cx(control, "min-h-28 py-3", className)} {...rest} />;
}

export function Select({ className, ...rest }: ComponentProps<"select">) {
  return <select className={cx(control, "min-h-12 pr-8", className)} {...rest} />;
}
