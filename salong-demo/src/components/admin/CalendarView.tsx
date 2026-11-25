"use client";

import { useState } from "react";
import { salon } from "@config";
import { t } from "@/i18n";
import { formatLocalDateLong, formatTime } from "@/lib/format";
import { useRepoQuery, useToday } from "@/lib/repository/live";
import { addDays, parseClock, toZoned, weekdayOf, zonedToUtc } from "@/lib/time/zoned";
import type { Booking, Service, StaffMember } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { BookingDialog, type DialogState } from "./BookingDialog";

const PX_PER_MIN = 1.3;

export function CalendarView() {
  const today = useToday();
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked ?? today;
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const data = useRepoQuery(`admin-day:${date}`, async (repo) => {
    if (!date) return null;
    const from = new Date(zonedToUtc(date, 0, salon.timeZone)).toISOString();
    const to = new Date(zonedToUtc(addDays(date, 1), 0, salon.timeZone)).toISOString();
    const [bookings, staff, services, hours] = await Promise.all([
      repo.listBookings({ from, to }),
      repo.listStaff(),
      repo.listServices({ includeInactive: true }),
      repo.getOpeningHours(),
    ]);
    return { bookings, staff, services, hours };
  });

  if (!date || !data) return <p className="text-muted">{t.common.loading}</p>;

  const { bookings, staff, services, hours } = data;
  const weekday = weekdayOf(date);
  const open = hours[weekday];
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const columns = staff.filter((m) => m.schedule[weekday].length > 0 || confirmed.some((b) => b.staffId === m.id));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-d3">{formatLocalDateLong(date)}</h2>
          <p className="mt-1 text-small text-muted">
            {open ? `${open.start}–${open.end}` : t.common.closed} · {t.admin.bookingsCount(confirmed.length)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setPicked(addDays(date, -1))} className={navBtn} aria-label={t.admin.prevDay}>
            ←
          </button>
          <button type="button" onClick={() => setPicked(null)} className={cx(navBtn, "px-4")} disabled={date === today}>
            {t.admin.today}
          </button>
          <button type="button" onClick={() => setPicked(addDays(date, 1))} className={navBtn} aria-label={t.admin.nextDay}>
            →
          </button>
          <label className="sr-only" htmlFor="admin-date">{t.admin.date}</label>
          <input
            id="admin-date"
            type="date"
            value={date}
            onChange={(e) => e.target.value && setPicked(e.target.value)}
            className="min-h-11 rounded-ctl border border-line-strong bg-paper px-3"
          />
          <Button type="button" onClick={() => setDialog({ mode: "create", date })}>
            + {t.admin.newBooking}
          </Button>
        </div>
      </div>

      {columns.length === 0 ? (
        <p className="mt-10 border-l-2 border-line-strong px-4 py-3 text-muted">{t.admin.noBookings}</p>
      ) : (
        <>
          <AgendaList className="mt-8 md:hidden" bookings={confirmed} staff={staff} services={services} onOpen={(b) => setDialog({ mode: "edit", booking: b })} />
          <DayGrid
            className="mt-8 hidden md:block"
            date={date}
            columns={columns}
            bookings={confirmed}
            services={services}
            open={open}
            onOpen={(b) => setDialog({ mode: "edit", booking: b })}
          />
        </>
      )}

      {dialog && <BookingDialog state={dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

const navBtn =
  "grid min-h-11 min-w-11 place-items-center rounded-ctl border border-line-strong bg-paper transition-colors hover:border-ink disabled:opacity-40";

const serviceNames = (services: Service[], b: Booking) =>
  b.serviceIds.map((id) => services.find((s) => s.id === id)?.name ?? id).join(", ");

function AgendaList({
  bookings,
  staff,
  services,
  onOpen,
  className,
}: {
  bookings: Booking[];
  staff: StaffMember[];
  services: Service[];
  onOpen: (b: Booking) => void;
  className?: string;
}) {
  if (bookings.length === 0) return <p className={cx("text-muted", className)}>{t.admin.noBookings}</p>;
  return (
    <ul className={cx("border-t border-line", className)}>
      {bookings.map((b) => (
        <li key={b.id} className="border-b border-line">
          <button type="button" onClick={() => onOpen(b)} className="grid w-full grid-cols-[4.5rem_1fr] gap-3 py-4 text-left">
            <span className="tabular font-medium">
              {formatTime(b.start)}
              <span className="block text-small font-normal text-muted">{formatTime(b.end)}</span>
            </span>
            <span>
              <span className="block font-medium">{b.customer.name}</span>
              <span className="block text-small text-muted">
                {serviceNames(services, b)} · {staff.find((m) => m.id === b.staffId)?.name.split(" ")[0]}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function DayGrid({
  date,
  columns,
  bookings,
  services,
  open,
  onOpen,
  className,
}: {
  date: string;
  columns: StaffMember[];
  bookings: Booking[];
  services: Service[];
  open: { start: string; end: string } | null;
  onOpen: (b: Booking) => void;
  className?: string;
}) {
  const weekday = weekdayOf(date);
  const startMin = Math.min(open ? parseClock(open.start) : 9 * 60, ...bookings.map((b) => toZoned(Date.parse(b.start), salon.timeZone).minutes));
  const endMin = Math.max(open ? parseClock(open.end) : 17 * 60, ...bookings.map((b) => toZoned(Date.parse(b.end), salon.timeZone).minutes));
  const first = Math.floor(startMin / 60) * 60;
  const last = Math.ceil(endMin / 60) * 60;
  const height = (last - first) * PX_PER_MIN;
  const hoursList = Array.from({ length: (last - first) / 60 }, (_, i) => first + i * 60);
  const top = (min: number) => (min - first) * PX_PER_MIN;

  return (
    <div className={cx("overflow-x-auto", className)}>
      <div className="grid min-w-[44rem]" style={{ gridTemplateColumns: `3.5rem repeat(${columns.length}, minmax(9rem, 1fr))` }}>
        <div />
        {columns.map((m) => (
          <div key={m.id} className="border-b border-ink px-3 pb-3">
            <p className="font-medium">{m.name}</p>
            <p className="text-small text-muted">
              {m.schedule[weekday].map((r) => `${r.start}–${r.end}`).join(", ") || t.admin.dayOff}
            </p>
          </div>
        ))}

        <div className="relative" style={{ height }}>
          {hoursList.map((h) => (
            <span key={h} className="tabular absolute right-3 -translate-y-1/2 text-small text-muted" style={{ top: top(h) }}>
              {String(h / 60).padStart(2, "0")}:00
            </span>
          ))}
        </div>

        {columns.map((m) => (
          <div key={m.id} className="relative border-l border-line" style={{ height }}>
            {hoursList.map((h) => (
              <span key={h} aria-hidden="true" className="absolute inset-x-0 border-t border-line" style={{ top: top(h) }} />
            ))}
            {/* Shade time the person is not working. */}
            <OffHours schedule={m.schedule[weekday]} first={first} last={last} top={top} />
            {bookings
              .filter((b) => b.staffId === m.id)
              .map((b) => {
                const s = toZoned(Date.parse(b.start), salon.timeZone).minutes;
                const e = toZoned(Date.parse(b.end), salon.timeZone).minutes;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onOpen(b)}
                    className="absolute inset-x-1 overflow-hidden rounded-ctl border-l-2 border-ink bg-stone px-2 py-1 text-left text-small leading-tight transition-colors hover:bg-ink hover:text-paper"
                    style={{ top: top(s) + 1, height: Math.max((e - s) * PX_PER_MIN - 2, 22) }}
                  >
                    <span className="tabular font-medium">{formatTime(b.start)}</span> {b.customer.name}
                    <span className="block truncate opacity-75">{serviceNames(services, b)}</span>
                  </button>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}

function OffHours({
  schedule,
  first,
  last,
  top,
}: {
  schedule: { start: string; end: string }[];
  first: number;
  last: number;
  top: (min: number) => number;
}) {
  const gaps: [number, number][] = [];
  let cursor = first;
  for (const r of [...schedule].sort((a, b) => a.start.localeCompare(b.start))) {
    const s = parseClock(r.start);
    if (s > cursor) gaps.push([cursor, s]);
    cursor = Math.max(cursor, parseClock(r.end));
  }
  if (cursor < last) gaps.push([cursor, last]);
  return (
    <>
      {gaps.map(([s, e]) => (
        <span
          key={s}
          aria-hidden="true"
          className="absolute inset-x-0 bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--color-line)_6px_7px)]"
          style={{ top: top(s), height: top(e) - top(s) }}
        />
      ))}
    </>
  );
}
