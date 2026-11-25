import Link from "next/link";
import type { ComponentProps } from "react";
import { cx } from "./cx";

type Variant = "solid" | "outline" | "inverse";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-3 rounded-ctl font-sans font-medium tracking-tightish transition-[background-color,color,border-color,transform] duration-200 ease-out-soft select-none disabled:cursor-not-allowed disabled:opacity-45 active:translate-y-px";

const variants: Record<Variant, string> = {
  solid: "bg-ink text-paper border border-ink hover:bg-accent hover:border-accent",
  outline: "border border-ink text-ink hover:bg-ink hover:text-paper",
  inverse: "bg-paper text-ink border border-paper hover:bg-stone hover:border-stone",
};

const sizes: Record<Size, string> = {
  md: "min-h-11 px-5 text-small",
  lg: "min-h-14 px-7 text-body",
};

export function buttonClass(variant: Variant = "solid", size: Size = "md", className?: string) {
  return cx(base, variants[variant], sizes[size], className);
}

interface Common {
  variant?: Variant;
  size?: Size;
  arrow?: boolean;
}

function Arrow() {
  return (
    <span aria-hidden="true" className="inline-block transition-transform duration-200 ease-out-soft group-hover:translate-x-1">
      →
    </span>
  );
}

export function Button({ variant, size, arrow, className, children, ...rest }: Common & ComponentProps<"button">) {
  return (
    <button className={buttonClass(variant, size, cx("group", className))} {...rest}>
      {children}
      {arrow && <Arrow />}
    </button>
  );
}

export function ButtonLink({ variant, size, arrow, className, children, ...rest }: Common & ComponentProps<typeof Link>) {
  return (
    <Link className={buttonClass(variant, size, cx("group", className))} {...rest}>
      {children}
      {arrow && <Arrow />}
    </Link>
  );
}

/** Understated text link with an arrow, used for secondary actions. */
export function ArrowLink({ className, children, ...rest }: ComponentProps<typeof Link>) {
  return (
    <Link className={cx("group inline-flex items-baseline gap-2 font-medium link", className)} {...rest}>
      {children}
      <Arrow />
    </Link>
  );
}
