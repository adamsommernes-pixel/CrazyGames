"use client";

import { t } from "@/i18n";
import type { Slot } from "@/lib/booking/slots";
import { formatLocalDateLong } from "@/lib/format";
import { useRepoQuery } from "@/lib/repository/query";
import type { LocalDate } from "@/lib/types";
import { cx } from "@/components/ui/cx";
import { StepHeading } from "./StepHeading";

interface Props {
  serviceIds: string[];
  staffId: string | null;
  date: LocalDate;
  selected: Slot | null;
  notice: string | null;
  onSelect: (slot: Slot) => void;
  onChangeDate: () => void;
}

const groups = [
  { label: t.booking.morning, test: (h: number) => h < 12 },
  { label: t.booking.afternoon, test: (h: number) => h >= 12 && h < 17 },
  { label: t.booking.evening, test: (h: number) => h >= 17 },
];

export function TimeStep({ serviceIds, staffId, date, selected, notice, onSelect, onChangeDate }: Props) {
  const slots = useRepoQuery(`slots:${serviceIds.join()}:${staffId}:${date}`, (repo) =>
    repo.getAvailability({ serviceIds, staffId, date }),
  );

  return (
    <div>
      <StepHeading
        hint={
          <>
            {formatLocalDateLong(date)} ·{" "}
            <button type="button" onClick={onChangeDate} className="link font-medium text-ink">
              {t.booking.change}
            </button>
          </>
        }
      >
        {t.booking.chooseTime}
      </StepHeading>
      {notice && (
        <p role="alert" className="mb-8 border-l-2 border-accent bg-tint px-4 py-3">
          {notice}
        </p>
      )}
      {!slots ? (
        <div className="grid grid-cols-3 gap-2 xs:grid-cols-4" aria-busy="true" aria-label={t.common.loading}>
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="h-13 animate-pulse rounded-ctl bg-tint" />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <p className="border-l-2 border-line-strong px-4 py-3">{t.booking.noTimes}</p>
      ) : (
        <div className="grid gap-10">
          {groups.map((g) => {
            const list = slots.filter((s) => g.test(Number(s.label.slice(0, 2))));
            if (list.length === 0) return null;
            return (
              <section key={g.label} aria-label={g.label}>
                <h3 className="label mb-3 text-muted">{g.label}</h3>
                <ul className="grid grid-cols-3 gap-2 xs:grid-cols-4 sm:grid-cols-5 lg:grid-cols-6">
                  {list.map((slot) => {
                    const active = selected?.start === slot.start;
                    return (
                      <li key={slot.start}>
                        <button
                          type="button"
                          onClick={() => onSelect(slot)}
                          aria-pressed={active}
                          className={cx(
                            "tabular h-13 w-full rounded-ctl border text-body font-medium transition-colors",
                            active ? "border-ink bg-ink text-paper" : "border-line-strong hover:border-ink hover:bg-tint",
                          )}
                        >
                          {slot.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
