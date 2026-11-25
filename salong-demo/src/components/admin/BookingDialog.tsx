"use client";

import { useEffect, useRef, useState } from "react";
import { salon } from "@config";
import { t } from "@/i18n";
import { qualifiedStaff } from "@/lib/booking/slots";
import { validateCustomer, type CustomerErrors } from "@/lib/booking/validation";
import { formatDateLongYear, formatDuration, formatTime } from "@/lib/format";
import { getRepository } from "@/lib/repository/client";
import { useRepoQuery } from "@/lib/repository/query";
import { SlotUnavailableError } from "@/lib/repository/types";
import { toZoned } from "@/lib/time/zoned";
import type { Booking } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { useNotice } from "./Notice";

export type DialogState = { mode: "create"; date: string } | { mode: "edit"; booking: Booking };

export function BookingDialog({ state, onClose }: { state: DialogState; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="booking-dialog-title"
      className="m-auto max-h-[92dvh] w-[min(36rem,calc(100%-1.5rem))] overflow-y-auto rounded-ctl border border-ink bg-paper p-0 text-ink backdrop:bg-ink/50"
    >
      <div className="p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <h2 id="booking-dialog-title" className="text-d3">
            {state.mode === "create" ? t.admin.newBooking : t.admin.editBooking}
          </h2>
          <button type="button" onClick={() => ref.current?.close()} className="label -mr-2 min-h-11 px-2">
            {t.nav.close}
          </button>
        </div>
        {state.mode === "create" ? (
          <CreateForm date={state.date} onDone={() => ref.current?.close()} />
        ) : (
          <EditForm booking={state.booking} onDone={() => ref.current?.close()} />
        )}
      </div>
    </dialog>
  );
}

function useCatalog() {
  return useRepoQuery("admin-catalog", async (repo) => {
    const [services, staff] = await Promise.all([repo.listServices({ includeInactive: true }), repo.listStaff()]);
    return { services, staff };
  });
}

function TimeSelect({
  serviceIds,
  staffId,
  date,
  value,
  onChange,
  excludeBookingId,
}: {
  serviceIds: string[];
  staffId: string;
  date: string;
  value: string;
  onChange: (v: string) => void;
  excludeBookingId?: string;
}) {
  const ready = serviceIds.length > 0 && staffId && date;
  const slots = useRepoQuery(`admin-slots:${serviceIds.join()}:${staffId}:${date}:${excludeBookingId}`, (repo) =>
    ready ? repo.getAvailability({ serviceIds, staffId, date }, { admin: true, excludeBookingId }) : Promise.resolve([]),
  );
  return (
    <Field id="admin-time" label={t.admin.time} hint={slots && ready && slots.length === 0 ? t.admin.noFreeTimes : undefined}>
      {(aria) => (
        <Select {...aria} value={value} onChange={(e) => onChange(e.target.value)} disabled={!slots || slots.length === 0}>
          <option value="">–</option>
          {slots?.map((s) => (
            <option key={s.start} value={s.start}>
              {s.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

function CreateForm({ date: initialDate, onDone }: { date: string; onDone: () => void }) {
  const catalog = useCatalog();
  const notify = useNotice();
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(initialDate);
  const [start, setStart] = useState("");
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "" });
  const [errors, setErrors] = useState<CustomerErrors>({});
  const [error, setError] = useState<string | null>(null);

  if (!catalog) return <p className="mt-6 text-muted">{t.common.loading}</p>;
  const qualified = qualifiedStaff(catalog.staff, serviceIds);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const check = validateCustomer(customer, { requireEmail: false });
    setErrors(check.ok ? {} : check.errors);
    if (!check.ok || !start || !staffId) {
      if (!start || !staffId) setError(t.admin.chooseStaffAndTime);
      return;
    }
    try {
      await getRepository().createBooking({ serviceIds, staffId, start, customer: check.value, source: "admin" });
      notify(t.admin.created);
      onDone();
    } catch (err) {
      setError(err instanceof SlotUnavailableError ? t.booking.slotTaken : t.admin.saveFailed);
    }
  }

  return (
    <form onSubmit={save} noValidate className="mt-6 grid gap-6">
      <fieldset>
        <legend className="text-small font-medium">{t.admin.service}</legend>
        <ul className="mt-2 max-h-52 overflow-y-auto rounded-ctl border border-line-strong">
          {catalog.services.map((s) => {
            const checked = serviceIds.includes(s.id);
            return (
              <li key={s.id} className="border-b border-line last:border-b-0">
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-small">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = checked ? serviceIds.filter((id) => id !== s.id) : [...serviceIds, s.id];
                      setServiceIds(next);
                      setStart("");
                      if (!qualifiedStaff(catalog.staff, next).some((m) => m.id === staffId)) setStaffId("");
                    }}
                    className="h-4 w-4 accent-[var(--salon-ink)]"
                  />
                  <span className="flex-1">{s.name}</span>
                  <span className="text-muted">{formatDuration(s.durationMin)}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="admin-staff" label={t.admin.staff}>
          {(aria) => (
            <Select {...aria} value={staffId} onChange={(e) => { setStaffId(e.target.value); setStart(""); }} disabled={qualified.length === 0}>
              <option value="">–</option>
              {qualified.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field id="admin-date-create" label={t.admin.date}>
          {(aria) => <TextInput {...aria} type="date" value={date} onChange={(e) => { setDate(e.target.value); setStart(""); }} />}
        </Field>
      </div>
      <TimeSelect serviceIds={serviceIds} staffId={staffId} date={date} value={start} onChange={setStart} />
      <fieldset className="grid gap-4 border-t border-line pt-6">
        <legend className="sr-only">{t.admin.customer}</legend>
        <Field id="admin-name" label={t.booking.name} error={errors.name}>
          {(aria) => <TextInput {...aria} autoComplete="off" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="admin-phone" label={t.booking.phone} error={errors.phone}>
            {(aria) => <TextInput {...aria} type="tel" autoComplete="off" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />}
          </Field>
          <Field id="admin-email" label={t.booking.email} optionalLabel={t.booking.optional} error={errors.email}>
            {(aria) => <TextInput {...aria} type="email" autoComplete="off" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />}
          </Field>
        </div>
      </fieldset>
      {error && <p role="alert" className="border-l-2 border-accent bg-tint px-4 py-3 text-small">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" size="lg">{t.common.save}</Button>
      </div>
    </form>
  );
}

function EditForm({ booking, onDone }: { booking: Booking; onDone: () => void }) {
  const catalog = useCatalog();
  const notify = useNotice();
  const [staffId, setStaffId] = useState(booking.staffId);
  const [date, setDate] = useState(toZoned(Date.parse(booking.start), salon.timeZone).date);
  const [start, setStart] = useState(booking.start);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (!catalog) return <p className="mt-6 text-muted">{t.common.loading}</p>;
  const qualified = qualifiedStaff(catalog.staff, booking.serviceIds);
  const names = booking.serviceIds.map((id) => catalog.services.find((s) => s.id === id)?.name ?? id).join(", ");

  async function move(e: React.FormEvent) {
    e.preventDefault();
    if (!start) return setError(t.admin.chooseTime);
    try {
      await getRepository().moveBooking(booking.id, { start, staffId });
      notify(t.admin.moved);
      onDone();
    } catch (err) {
      setError(err instanceof SlotUnavailableError ? t.booking.slotTaken : t.admin.moveFailed);
    }
  }

  async function cancel() {
    await getRepository().cancelBooking(booking.reference, { admin: true });
    notify(t.admin.cancelled);
    onDone();
  }

  return (
    <form onSubmit={move} className="mt-6 grid gap-6">
      <dl className="grid grid-cols-[7rem_1fr] gap-y-2 border-y border-line py-4 text-small">
        <dt className="text-muted">{t.admin.customer}</dt>
        <dd>
          {booking.customer.name}
          <br />
          <a className="link" href={`tel:${booking.customer.phone.replace(/\s/g, "")}`}>{booking.customer.phone}</a>
          {booking.customer.email && (
            <>
              <br />
              <a className="link break-all" href={`mailto:${booking.customer.email}`}>{booking.customer.email}</a>
            </>
          )}
        </dd>
        <dt className="text-muted">{t.admin.service}</dt>
        <dd>{names}</dd>
        <dt className="text-muted">{t.admin.time}</dt>
        <dd>{formatDateLongYear(booking.start)}, {formatTime(booking.start)}–{formatTime(booking.end)}</dd>
        {booking.customer.note && (
          <>
            <dt className="text-muted">{t.booking.note}</dt>
            <dd className="italic">{booking.customer.note}</dd>
          </>
        )}
        <dt className="text-muted">{t.confirmation.reference}</dt>
        <dd className="tabular">
          {booking.reference} · {booking.source === "online" ? t.admin.sourceOnline : t.admin.sourceAdmin}
        </dd>
      </dl>
      <h3 className="label text-muted">{t.admin.move}</h3>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="admin-staff-edit" label={t.admin.staff}>
          {(aria) => (
            <Select {...aria} value={staffId} onChange={(e) => { setStaffId(e.target.value); setStart(""); }}>
              {qualified.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field id="admin-date-edit" label={t.admin.date}>
          {(aria) => <TextInput {...aria} type="date" value={date} onChange={(e) => { setDate(e.target.value); setStart(""); }} />}
        </Field>
      </div>
      <TimeSelect serviceIds={booking.serviceIds} staffId={staffId} date={date} value={start} onChange={setStart} excludeBookingId={booking.id} />
      {error && <p role="alert" className="border-l-2 border-accent bg-tint px-4 py-3 text-small">{error}</p>}
      {confirmCancel ? (
        <div role="group" aria-labelledby="cancel-booking-q" className="flex flex-wrap items-center gap-3 border-l-2 border-accent bg-tint px-4 py-3">
          <p id="cancel-booking-q" className="flex-1 font-medium">{t.admin.cancelConfirm}</p>
          <Button type="button" variant="outline" onClick={cancel} autoFocus>
            {t.confirmation.confirmCancel}
          </Button>
          <Button type="button" onClick={() => setConfirmCancel(false)}>
            {t.confirmation.keep}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button type="button" onClick={() => setConfirmCancel(true)} className="link min-h-11 font-medium text-accent">
            {t.admin.cancelBooking}
          </button>
          <Button type="submit" size="lg">{t.admin.move}</Button>
        </div>
      )}
    </form>
  );
}
