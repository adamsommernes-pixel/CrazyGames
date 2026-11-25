"use client";

import { useState } from "react";
import { salon } from "@config";
import { t } from "@/i18n";
import { isWholeDay, overlaps } from "@/lib/booking/slots";
import { formatLocalDateLong, formatTime } from "@/lib/format";
import { getRepository } from "@/lib/repository/client";
import { useToday } from "@/lib/repository/live";
import { useRepoQuery } from "@/lib/repository/query";
import { addDays, parseClock, zonedToUtc } from "@/lib/time/zoned";
import type { Booking, Closure, StaffMember, TimeRange } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { useNotice } from "./Notice";
import { isValidRange, RangeInputs } from "./RangeInputs";

function closureInterval(c: Omit<Closure, "id">) {
  const tz = salon.timeZone;
  return isWholeDay(c)
    ? { start: zonedToUtc(c.date, 0, tz), end: zonedToUtc(addDays(c.date, 1), 0, tz) }
    : { start: zonedToUtc(c.date, parseClock(c.start!), tz), end: zonedToUtc(c.date, parseClock(c.end!), tz) };
}

/** Confirmed bookings that fall inside a closure. */
function affectedBookings(c: Omit<Closure, "id">, bookings: Booking[]): Booking[] {
  const span = closureInterval(c);
  return bookings.filter(
    (b) =>
      b.status === "confirmed" &&
      (!c.staffId || b.staffId === c.staffId) &&
      overlaps({ start: Date.parse(b.start), end: Date.parse(b.end) }, span),
  );
}

export function ClosuresEditor({ onOpenDate }: { onOpenDate: (date: string) => void }) {
  const today = useToday();
  const data = useRepoQuery("admin-closures", async (repo) => {
    const [closures, staff, bookings] = await Promise.all([repo.listClosures(), repo.listStaff(), repo.listBookings()]);
    return { closures, staff, bookings };
  });
  if (!data || !today) return <p className="text-muted">{t.common.loading}</p>;
  const upcoming = data.closures.filter((c) => c.date >= today);

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-16">
      <div>
        <p className="max-w-measure text-muted">{t.panel.closures.lead}</p>
        <ClosureForm today={today} staff={data.staff} bookings={data.bookings} onOpenDate={onOpenDate} />
      </div>
      <section aria-labelledby="closures-upcoming">
        <h2 id="closures-upcoming" className="text-d4">{t.panel.closures.upcoming}</h2>
        {upcoming.length === 0 ? (
          <p className="mt-4 text-muted">{t.panel.closures.none}</p>
        ) : (
          <ul className="mt-4 border-t border-line">
            {upcoming.map((c) => (
              <ClosureRow key={c.id} closure={c} staff={data.staff} affected={affectedBookings(c, data.bookings).length} onOpenDate={onOpenDate} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ClosureRow({
  closure,
  staff,
  affected,
  onOpenDate,
}: {
  closure: Closure;
  staff: StaffMember[];
  affected: number;
  onOpenDate: (date: string) => void;
}) {
  const notify = useNotice();
  const who = closure.staffId ? (staff.find((m) => m.id === closure.staffId)?.name ?? closure.staffId) : t.panel.closures.wholeSalon;
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b border-line py-4">
      <div>
        <p className="font-medium">{formatLocalDateLong(closure.date)}</p>
        <p className="text-small text-muted">
          {isWholeDay(closure) ? t.panel.closures.allDay : `${closure.start}–${closure.end}`} · {who} · {closure.reason}
        </p>
        {affected > 0 && (
          <p className="mt-1 text-small text-accent">
            {t.panel.closures.affected(affected)}{" "}
            <button type="button" className="link font-medium" onClick={() => onOpenDate(closure.date)}>
              {t.panel.closures.openCalendar}
            </button>
          </p>
        )}
      </div>
      <button
        type="button"
        className="link min-h-11 text-small"
        onClick={async () => {
          await getRepository().removeClosure(closure.id);
          notify(t.panel.closures.removed);
        }}
        aria-label={`${t.panel.closures.remove}: ${formatLocalDateLong(closure.date)}, ${closure.reason}`}
      >
        {t.panel.closures.remove}
      </button>
    </li>
  );
}

function ClosureForm({
  today,
  staff,
  bookings,
  onOpenDate,
}: {
  today: string;
  staff: StaffMember[];
  bookings: Booking[];
  onOpenDate: (date: string) => void;
}) {
  const notify = useNotice();
  const [date, setDate] = useState(today);
  const [wholeDay, setWholeDay] = useState(true);
  const [range, setRange] = useState<TimeRange>({ start: "12:00", end: "14:00" });
  const [staffId, setStaffId] = useState("");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ date: string; affected: Booking[] } | null>(null);

  const errors = {
    date: date ? undefined : t.panel.closures.dateRequired,
    reason: reason.trim() ? undefined : t.panel.closures.reasonRequired,
    range: wholeDay || isValidRange(range) ? undefined : t.panel.endAfterStart,
  };
  const valid = !errors.date && !errors.reason && !errors.range;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) return;
    const input: Omit<Closure, "id"> = {
      date,
      reason: reason.trim(),
      ...(wholeDay ? {} : { start: range.start, end: range.end }),
      ...(staffId ? { staffId } : {}),
    };
    await getRepository().addClosure(input);
    setResult({ date, affected: affectedBookings(input, bookings) });
    setReason("");
    setSubmitted(false);
    notify(t.panel.closures.added);
  }

  return (
    <form onSubmit={save} noValidate className="mt-8 grid gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="closure-date" label={t.panel.closures.date} error={submitted ? errors.date : undefined}>
          {(aria) => <TextInput {...aria} type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field id="closure-who" label={t.panel.closures.who}>
          {(aria) => (
            <Select {...aria} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">{t.panel.closures.wholeSalon}</option>
              {staff.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <fieldset className="grid gap-3">
        <legend className="sr-only">{t.panel.time}</legend>
        <label className="flex min-h-11 items-center gap-3">
          <input
            id="closure-whole-day"
            type="checkbox"
            checked={wholeDay}
            onChange={(e) => setWholeDay(e.target.checked)}
            className="h-5 w-5 accent-[var(--salon-ink)]"
          />
          {t.panel.closures.wholeDay}
        </label>
        {!wholeDay && <RangeInputs label={t.panel.time} range={range} onChange={setRange} />}
        {submitted && errors.range && <p className="text-small font-medium text-accent">{errors.range}</p>}
      </fieldset>
      <Field
        id="closure-reason"
        label={t.panel.closures.reason}
        hint={t.panel.closures.reasonHint}
        error={submitted ? errors.reason : undefined}
      >
        {(aria) => <TextInput {...aria} value={reason} maxLength={80} onChange={(e) => setReason(e.target.value)} />}
      </Field>
      <div>
        <Button type="submit" size="lg">
          {t.panel.closures.add}
        </Button>
      </div>
      {result && result.affected.length > 0 && (
        <div role="status" className="border-l-2 border-accent bg-tint px-4 py-3 text-small">
          <p className="font-medium">{t.panel.closures.affected(result.affected.length)}</p>
          <ul className="mt-2 grid gap-1">
            {result.affected.map((b) => (
              <li key={b.id}>
                {formatTime(b.start)}–{formatTime(b.end)} · {b.customer.name} · {b.customer.phone}
              </li>
            ))}
          </ul>
          <button type="button" className="link mt-2 font-medium" onClick={() => onOpenDate(result.date)}>
            {t.panel.closures.openCalendar}
          </button>
        </div>
      )}
    </form>
  );
}
