"use client";

import { useState } from "react";
import { salon } from "@config";
import { t } from "@/i18n";
import { formatDuration, formatPrice } from "@/lib/format";
import { getRepository } from "@/lib/repository/client";
import { useRepoQuery } from "@/lib/repository/query";
import { ServiceInUseError, type ServiceInput } from "@/lib/repository/types";
import type { Service, StaffMember } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Field, Select, TextArea, TextInput } from "@/components/ui/Field";
import { useNotice } from "./Notice";

/** 5-minute steps, so every existing duration (20, 45 …) is selectable. */
const DURATIONS = Array.from({ length: 72 }, (_, i) => (i + 1) * 5);

export function ServicesEditor() {
  const data = useRepoQuery("admin-services", async (repo) => {
    const [services, staff] = await Promise.all([repo.listServices({ includeInactive: true }), repo.listStaff()]);
    return { services, staff };
  });
  const [editing, setEditing] = useState<string | null>(null);
  if (!data) return <p className="text-muted">{t.common.loading}</p>;
  const { services, staff } = data;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-measure text-muted">
          {t.admin.changesLive} {t.admin.activeHint}
        </p>
        {editing !== "new" && (
          <Button type="button" onClick={() => setEditing("new")}>
            + {t.admin.serviceForm.add}
          </Button>
        )}
      </div>

      {editing === "new" && (
        <section aria-labelledby="new-service" className="mt-8 border-t-2 border-ink pt-6">
          <h2 id="new-service" className="text-d4">{t.admin.serviceForm.newTitle}</h2>
          <ServiceForm staff={staff} onDone={() => setEditing(null)} />
        </section>
      )}

      {salon.categories.map((c) => {
        const list = services.filter((s) => s.categoryId === c.id);
        return (
          <section key={c.id} className="mt-10" aria-labelledby={`cat-${c.id}`}>
            <h2 id={`cat-${c.id}`} className="text-d4">{c.name}</h2>
            <ul className="mt-3 border-t border-ink">
              {list.map((s) => (
                <li key={s.id} className="border-b border-line">
                  <ServiceSummary
                    service={s}
                    staff={staff}
                    open={editing === s.id}
                    onToggle={() => setEditing(editing === s.id ? null : s.id)}
                  />
                  {editing === s.id && (
                    <div id={`edit-${s.id}`} className="pb-8">
                      <ServiceForm service={s} staff={staff} onDone={() => setEditing(null)} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ServiceSummary({
  service,
  staff,
  open,
  onToggle,
}: {
  service: Service;
  staff: StaffMember[];
  open: boolean;
  onToggle: () => void;
}) {
  const who = staff.filter((m) => m.serviceIds.includes(service.id)).map((m) => m.name.split(" ")[0]);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[minmax(0,1fr)_7rem_6rem_auto]">
      <div className="min-w-0">
        <p className={cx("font-medium", !service.active && "text-muted")}>
          {service.name}
          {!service.active && <span className="label ml-3 border border-line-strong px-1.5 py-0.5">{t.admin.serviceForm.hidden}</span>}
        </p>
        <p className="truncate text-small text-muted">{who.length ? who.join(", ") : t.admin.serviceForm.noStaffWarning}</p>
      </div>
      <p className="tabular hidden text-right sm:block">{formatPrice(service.priceNok, service.priceFrom)}</p>
      <p className="tabular hidden text-right text-muted sm:block">{formatDuration(service.durationMin)}</p>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`edit-${service.id}`}
        className="link min-h-11 justify-self-end px-1 text-small font-medium"
      >
        {open ? t.nav.close : t.common.edit}
        <span className="sr-only">: {service.name}</span>
      </button>
    </div>
  );
}

function ServiceForm({ service, staff, onDone }: { service?: Service; staff: StaffMember[]; onDone: () => void }) {
  const notify = useNotice();
  const [form, setForm] = useState({
    name: service?.name ?? "",
    description: service?.description ?? "",
    categoryId: service?.categoryId ?? salon.categories[0]!.id,
    price: service ? String(service.priceNok) : "",
    priceFrom: service?.priceFrom ?? false,
    durationMin: service?.durationMin ?? 30,
    popular: service?.popular ?? false,
    active: service?.active ?? true,
    staffIds: service ? staff.filter((m) => m.serviceIds.includes(service.id)).map((m) => m.id) : [],
  });
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const errors = {
    name: form.name.trim().length >= 2 ? undefined : t.admin.serviceForm.nameRequired,
    price: /^\d+$/.test(form.price) ? undefined : t.admin.serviceForm.priceRequired,
  };
  const id = service?.id ?? "new";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (errors.name || errors.price) return;
    const input: ServiceInput = {
      name: form.name.trim(),
      description: form.description.trim(),
      categoryId: form.categoryId,
      priceNok: Number(form.price),
      priceFrom: form.priceFrom,
      durationMin: form.durationMin,
      popular: form.popular,
      active: form.active,
      staffIds: form.staffIds,
    };
    const repo = getRepository();
    if (service) {
      await repo.updateService(service.id, input);
      notify(`${input.name}: ${t.common.saved.toLowerCase()}`);
    } else {
      await repo.createService(input);
      notify(t.admin.serviceForm.created(input.name));
    }
    onDone();
  }

  async function remove() {
    if (!service) return;
    try {
      await getRepository().deleteService(service.id);
      notify(t.admin.serviceForm.deleted(service.name));
      onDone();
    } catch (err) {
      setConfirmDelete(false);
      if (err instanceof ServiceInUseError) setError(t.admin.serviceForm.inUse(err.upcoming));
      else throw err;
    }
  }

  return (
    <form onSubmit={save} noValidate className="mt-4 grid max-w-2xl gap-6">
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <Field id={`${id}-name`} label={t.admin.serviceForm.name} error={submitted ? errors.name : undefined}>
          {(aria) => <TextInput {...aria} value={form.name} onChange={(e) => set("name", e.target.value)} />}
        </Field>
        <Field id={`${id}-category`} label={t.admin.serviceForm.category}>
          {(aria) => (
            <Select {...aria} value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              {salon.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field id={`${id}-description`} label={t.admin.serviceForm.description} optionalLabel={t.booking.optional}>
        {(aria) => (
          <TextArea {...aria} rows={2} maxLength={160} value={form.description} onChange={(e) => set("description", e.target.value)} />
        )}
      </Field>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field id={`${id}-price`} label={`${t.services.price} (kr)`} error={submitted ? errors.price : undefined}>
          {(aria) => (
            <TextInput
              {...aria}
              inputMode="numeric"
              value={form.price}
              onChange={(e) => set("price", e.target.value.replace(/[^\d]/g, ""))}
              className="tabular"
            />
          )}
        </Field>
        <Field id={`${id}-duration`} label={t.services.duration}>
          {(aria) => (
            <Select {...aria} value={form.durationMin} onChange={(e) => set("durationMin", Number(e.target.value))}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>{formatDuration(d)}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="grid gap-1">
        {(
          [
            ["priceFrom", t.admin.serviceForm.priceFrom],
            ["popular", t.admin.serviceForm.popular],
            ["active", t.admin.serviceForm.activeLabel],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={form[key]}
              onChange={(e) => set(key, e.target.checked)}
              className="h-5 w-5 accent-[var(--salon-ink)]"
            />
            {label}
          </label>
        ))}
      </div>
      <fieldset>
        <legend className="text-small font-medium">{t.admin.serviceForm.staff}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {staff.map((m) => {
            const checked = form.staffIds.includes(m.id);
            return (
              <label
                key={m.id}
                className={cx(
                  "flex min-h-11 cursor-pointer items-center gap-2 rounded-ctl border px-3 text-small transition-colors has-focus-visible:outline-2 has-focus-visible:outline-accent",
                  checked ? "border-ink bg-ink text-paper" : "border-line-strong hover:border-ink",
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() =>
                    set("staffIds", checked ? form.staffIds.filter((s) => s !== m.id) : [...form.staffIds, m.id])
                  }
                />
                {m.name}
              </label>
            );
          })}
        </div>
        {form.staffIds.length === 0 && form.active && (
          <p className="mt-2 text-small text-accent">{t.admin.serviceForm.noStaffWarning}</p>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="border-l-2 border-accent bg-tint px-4 py-3 text-small">
          {error}
        </p>
      )}

      {confirmDelete && service ? (
        <div role="group" aria-labelledby={`${id}-delete-q`} className="flex flex-wrap items-center gap-3 border-l-2 border-accent bg-tint px-4 py-3">
          <p id={`${id}-delete-q`} className="flex-1 text-small font-medium">
            {t.admin.serviceForm.deleteConfirm(service.name)}
          </p>
          <Button type="button" variant="outline" onClick={remove} autoFocus>
            {t.admin.serviceForm.deleteYes}
          </Button>
          <Button type="button" onClick={() => setConfirmDelete(false)}>
            {t.common.cancel}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" size="lg">{t.common.save}</Button>
          <button type="button" onClick={onDone} className="link min-h-11">
            {t.common.cancel}
          </button>
          {service && (
            <button type="button" onClick={() => setConfirmDelete(true)} className="link ml-auto min-h-11 text-accent">
              {t.admin.serviceForm.delete}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
