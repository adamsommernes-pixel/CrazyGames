"use client";

import { useState } from "react";
import { salon } from "@config";
import { t } from "@/i18n";
import type { DayStatus } from "@/lib/booking/slots";
import { formatLocalDateLong, formatMonthYear, weekdayShort } from "@/lib/format";
import { WEEKDAYS } from "@/lib/hours";
import { useRepoQuery, useToday } from "@/lib/repository/live";
import { addDays, addMonths, daysInMonth, startOfMonth, weekdayOf } from "@/lib/time/zoned";
import type { LocalDate } from "@/lib/types";
import { cx } from "@/components/ui/cx";
import { StepHeading } from "./StepHeading";

interface Props {
  serviceIds: string[];
  staffId: string | null;
  selected: LocalDate | null;
  onSelect: (date: LocalDate) => void;
}

function dayLabel(date: LocalDate, status: DayStatus | undefined): string {
  const base = formatLocalDateLong(date);
  if (!status) return base;
  switch (status.kind) {
    case "open":
      return `${base}: ${t.booking.timesAvailable(status.slots)}`;
    case "full":
      return `${base}: ${t.booking.full.toLowerCase()}`;
    case "closed":
      return `${base}: ${t.booking.closedDay.toLowerCase()}, ${status.reason.toLowerCase()}`;
    default:
      return base;
  }
}

export function DateStep({ serviceIds, staffId, selected, onSelect }: Props) {
  const today = useToday();
  const [month, setMonth] = useState<LocalDate | null>(selected ? startOfMonth(selected) : null);
  const visibleMonth = month ?? (today ? startOfMonth(today) : null);

  const dates = visibleMonth
    ? Array.from({ length: daysInMonth(visibleMonth) }, (_, i) => addDays(visibleMonth, i))
    : [];
  const statuses = useRepoQuery(`days:${serviceIds.join()}:${staffId}:${visibleMonth}`, (repo) =>
    visibleMonth ? repo.getDayStatuses({ serviceIds, staffId }, dates) : Promise.resolve({} as Record<string, DayStatus>),
  );

  const firstFree = useRepoQuery(`first:${serviceIds.join()}:${staffId}:${today}`, async (repo) => {
    if (!today) return null;
    const horizon = Array.from({ length: salon.booking.horizonDays + 1 }, (_, i) => addDays(today, i));
    const all = await repo.getDayStatuses({ serviceIds, staffId }, horizon);
    return horizon.find((d) => all[d]?.kind === "open") ?? null;
  });

  const firstMonth = today ? startOfMonth(today) : null;
  const lastMonth = today ? startOfMonth(addDays(today, salon.booking.horizonDays)) : null;
  const leading = visibleMonth ? weekdayOf(visibleMonth) - 1 : 0;

  return (
    <div>
      <StepHeading>{t.booking.chooseDate}</StepHeading>
      {firstFree && firstFree !== selected && (
        <button
          type="button"
          onClick={() => onSelect(firstFree)}
          className="group mb-8 flex min-h-14 w-full items-center justify-between gap-4 rounded-ctl border border-ink px-5 py-3 text-left transition-colors hover:bg-ink hover:text-paper"
        >
          <span>
            <span className="label block text-current opacity-75">{t.booking.firstAvailable}</span>
            <span className="font-display text-d4">{formatLocalDateLong(firstFree)}</span>
          </span>
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
        </button>
      )}
      {firstFree === null && <p className="mb-8 border-l-2 border-accent bg-tint px-4 py-3">{t.booking.noFreeInHorizon}</p>}
      <div className="flex items-center justify-between border-b border-line pb-4">
        <button
          type="button"
          onClick={() => visibleMonth && setMonth(addMonths(visibleMonth, -1))}
          disabled={!visibleMonth || visibleMonth === firstMonth}
          className="grid h-11 w-11 place-items-center rounded-ctl border border-line-strong transition-colors hover:border-ink disabled:opacity-30"
          aria-label={t.booking.prevMonth}
        >
          <span aria-hidden="true">←</span>
        </button>
        <p className="font-display text-d4" aria-live="polite">
          {visibleMonth ? formatMonthYear(visibleMonth) : " "}
        </p>
        <button
          type="button"
          onClick={() => visibleMonth && setMonth(addMonths(visibleMonth, 1))}
          disabled={!visibleMonth || visibleMonth === lastMonth}
          className="grid h-11 w-11 place-items-center rounded-ctl border border-line-strong transition-colors hover:border-ink disabled:opacity-30"
          aria-label={t.booking.nextMonth}
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className="mt-4">
        <div aria-hidden="true" className="grid grid-cols-7">
          {WEEKDAYS.map((d) => (
            <span key={d} className="label py-2 text-center text-muted">
              {weekdayShort(d)}
            </span>
          ))}
        </div>
        <ol className="grid grid-cols-7 gap-1" aria-label={visibleMonth ? formatMonthYear(visibleMonth) : undefined}>
          {Array.from({ length: leading }, (_, i) => (
            <li key={`pad-${i}`} aria-hidden="true" />
          ))}
          {dates.map((date) => {
            const status = statuses?.[date];
            const open = status?.kind === "open";
            const isSelected = date === selected;
            const isToday = date === today;
            return (
              <li key={date}>
                <button
                  type="button"
                  disabled={!open}
                  onClick={() => onSelect(date)}
                  aria-pressed={isSelected}
                  aria-label={dayLabel(date, status)}
                  className={cx(
                    "flex h-15 w-full flex-col items-center justify-center rounded-ctl border text-body transition-colors sm:h-17",
                    isSelected
                      ? "border-ink bg-ink text-paper"
                      : open
                        ? "border-line-strong bg-paper font-medium hover:border-ink hover:bg-tint"
                        : "border-transparent text-muted",
                    !status && "animate-pulse",
                  )}
                >
                  <span className={cx("tabular", status?.kind === "full" && "line-through decoration-1")}>
                    {Number(date.slice(8))}
                  </span>
                  <span aria-hidden="true" className="mt-0.5 h-3.5 text-[0.625rem] uppercase leading-none tracking-wide">
                    {status?.kind === "full" ? t.booking.full : status?.kind === "closed" ? t.booking.closedDay : isToday ? t.common.today : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-small text-muted">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-4 w-4 rounded-ctl border border-line-strong bg-paper" />
          Ledige tider
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="tabular line-through">12</span> {t.booking.full}
        </span>
        <span>
          {t.booking.cancellationPolicy(salon.booking.cancellationHours)}
        </span>
      </p>
    </div>
  );
}
