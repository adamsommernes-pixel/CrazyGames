"use client";

import { salon } from "@config";
import { t } from "@/i18n";
import { qualifiedStaff } from "@/lib/booking/slots";
import { formatDuration, formatPrice } from "@/lib/format";
import type { Service, StaffMember } from "@/lib/types";
import { cx } from "@/components/ui/cx";
import { StepHeading } from "./StepHeading";

interface Props {
  services: Service[];
  staff: StaffMember[];
  selected: string[];
  /** When the customer came from "Bestill hos …", only that person's services can be combined. */
  presetStaff: StaffMember | null;
  onToggle: (id: string) => void;
  onClearPreset: () => void;
}

export function ServiceStep({ services, staff, selected, presetStaff, onToggle, onClearPreset }: Props) {
  const pool = presetStaff ? [presetStaff] : staff;
  const canAdd = (id: string) => qualifiedStaff(pool, [...selected, id]).length > 0;

  return (
    <div>
      <StepHeading hint={t.booking.chooseServicesHint}>{t.booking.chooseServices}</StepHeading>
      {presetStaff && (
        <p className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-l-2 border-accent bg-tint px-4 py-3 text-small">
          {t.booking.presetStaff(presetStaff.name, presetStaff.name.split(" ")[0]!)}
          <button type="button" onClick={onClearPreset} className="link font-medium">
            {t.booking.showAllStaff}
          </button>
        </p>
      )}
      <div className="grid gap-12">
        {salon.categories.map((category) => {
          const list = services.filter(
            (s) => s.categoryId === category.id && (!presetStaff || presetStaff.serviceIds.includes(s.id)),
          );
          if (list.length === 0) return null;
          return (
            <fieldset key={category.id}>
              <legend className="label mb-3 text-muted">{category.name}</legend>
              <ul className="border-t border-line">
                {list.map((s) => {
                  const checked = selected.includes(s.id);
                  const disabled = !checked && !canAdd(s.id);
                  return (
                    <li key={s.id} className="border-b border-line">
                      <label
                        className={cx(
                          "group flex min-h-16 cursor-pointer items-start gap-4 py-4 transition-colors",
                          disabled && "cursor-not-allowed",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => onToggle(s.id)}
                          aria-describedby={disabled ? `${s.id}-why` : undefined}
                          className="peer sr-only"
                        />
                        <span
                          aria-hidden="true"
                          className={cx(
                            "mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-ctl border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
                            checked ? "border-ink bg-ink text-paper" : "border-line-strong bg-paper group-hover:border-ink",
                            disabled && "opacity-40",
                          )}
                        >
                          {checked && (
                            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 8.5l3.2 3L13 4.5" />
                            </svg>
                          )}
                        </span>
                        <span className={cx("min-w-0 flex-1", disabled && "text-muted")}>
                          <span className="flex items-baseline justify-between gap-4">
                            <span className="font-display text-d4 leading-tight">{s.name}</span>
                            <span className="tabular shrink-0 font-medium">{formatPrice(s.priceNok, s.priceFrom)}</span>
                          </span>
                          <span className="mt-1 block text-small text-muted">
                            {formatDuration(s.durationMin)} · {s.description}
                          </span>
                          {disabled && (
                            <span id={`${s.id}-why`} className="mt-1 block text-small italic">
                              {t.booking.notCombinable}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}
