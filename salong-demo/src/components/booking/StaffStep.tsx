"use client";

import { t } from "@/i18n";
import type { StaffMember } from "@/lib/types";
import { cx } from "@/components/ui/cx";
import { StepHeading } from "./StepHeading";

interface Props {
  qualified: StaffMember[];
  selected: string | null | undefined;
  onSelect: (id: string | null) => void;
}

export function StaffStep({ qualified, selected, onSelect }: Props) {
  if (qualified.length === 0) {
    return (
      <div>
        <StepHeading>{t.booking.chooseStaff}</StepHeading>
        <p role="alert" className="border-l-2 border-accent bg-tint px-4 py-3">
          {t.booking.nobodyDoesAll}
        </p>
      </div>
    );
  }
  const options: { id: string | null; name: string; detail: string }[] = [
    { id: null, name: t.booking.noPreference, detail: t.booking.noPreferenceHint },
    ...qualified.map((m) => ({ id: m.id, name: m.name, detail: m.role })),
  ];
  return (
    <div>
      <StepHeading>{t.booking.chooseStaff}</StepHeading>
      <ul className="grid gap-3 sm:grid-cols-2">
        {options.map((o, i) => {
          const active = selected === o.id;
          return (
            <li key={o.id ?? "any"} className={cx(i === 0 && "sm:col-span-2")}>
              <button
                type="button"
                onClick={() => onSelect(o.id)}
                aria-pressed={active}
                className={cx(
                  "group flex min-h-20 w-full items-center justify-between gap-4 rounded-ctl border px-5 py-4 text-left transition-colors",
                  active ? "border-ink bg-ink text-paper" : "border-line-strong hover:border-ink hover:bg-tint",
                )}
              >
                <span className="flex items-center gap-4">
                  <span
                    aria-hidden="true"
                    className={cx(
                      "grid h-11 w-11 shrink-0 place-items-center border font-display text-d4 italic",
                      active ? "border-paper/50" : "border-line-strong",
                    )}
                  >
                    {o.id ? o.name.charAt(0) : "–"}
                  </span>
                  <span>
                    <span className="block font-display text-d4 leading-tight">{o.name}</span>
                    <span className={cx("mt-0.5 block text-small", active ? "text-stone" : "text-muted")}>{o.detail}</span>
                  </span>
                </span>
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
