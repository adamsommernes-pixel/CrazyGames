import { cx } from "./cx";

interface Props {
  number?: string;
  label: string;
  className?: string;
  /** Light text for dark sections. */
  inverse?: boolean;
}

/** "01 — Salongen" eyebrow with a hairline, used to open each section. */
export function SectionHead({ number, label, className, inverse }: Props) {
  return (
    <p className={cx("label flex items-center gap-4", inverse ? "text-stone" : "text-muted", className)}>
      {number && <span className="tabular">{number}</span>}
      <span aria-hidden="true" className={cx("h-px w-10", inverse ? "bg-stone/60" : "bg-line-strong")} />
      <span>{label}</span>
    </p>
  );
}
