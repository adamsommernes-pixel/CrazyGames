import { salon } from "@config";
import { cx } from "@/components/ui/cx";

/** Text logo from config: the mark in a thin square, then the name. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-3", className)}>
      <span
        aria-hidden="true"
        className="grid h-9 w-9 place-items-center border border-current font-display text-[1.35rem] italic leading-none"
      >
        {salon.logo.mark}
      </span>
      <span className="font-display text-[1.6rem] leading-none tracking-display">
        {salon.logo.text}
        {salon.logo.suffix && (
          <span className="label ml-2 align-middle text-[0.625rem] opacity-80">{salon.logo.suffix}</span>
        )}
      </span>
    </span>
  );
}
