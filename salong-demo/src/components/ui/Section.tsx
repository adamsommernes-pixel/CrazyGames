import { salon } from "@config";
import type { ComponentProps } from "react";
import { cx } from "./cx";

type Tone = "plain" | "stone" | "ink" | "accent";

const tones: Record<Tone, string> = {
  plain: "bg-paper text-ink",
  stone: "bg-stone text-ink",
  ink: "bg-ink text-paper",
  accent: "bg-accent text-paper",
};

interface Props extends ComponentProps<"section"> {
  tone?: Tone;
  /** Hairline above the section (used between two plain sections). */
  rule?: boolean;
}

/**
 * Page section. With `theme.sectionStyle: "rules"` in the config, stone bands
 * become plain sections separated by hairlines, for a quieter look.
 */
export function Section({ tone = "plain", rule, className, children, ...rest }: Props) {
  const quiet = salon.theme.sectionStyle === "rules" && tone === "stone";
  return (
    <section
      className={cx(tones[quiet ? "plain" : tone], (rule || quiet) && "border-t border-line", className)}
      {...rest}
    >
      {children}
    </section>
  );
}
