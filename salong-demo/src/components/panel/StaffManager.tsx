"use client";

import { useState } from "react";
import { salon } from "@config";
import { t } from "@/i18n";
import { weekdayShort } from "@/lib/format";
import { WEEKDAYS } from "@/lib/hours";
import { getRepository } from "@/lib/repository/client";
import { useRepoQuery } from "@/lib/repository/query";
import { InUseError, type StaffInput } from "@/lib/repository/types";
import type { Service, StaffMember, WeeklySchedule } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { useNotice } from "./Notice";
import { isValidRange } from "./RangeInputs";
import { WeekScheduleFields } from "./WeekScheduleFields";

const emptyWeek = (): WeeklySchedule => ({ 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] });

export function StaffManager() {
  const data = useRepoQuery("admin-team", async (repo) => {
    const [staff, services] = await Promise.all([repo.listStaff(), repo.listServices({ includeInactive: true })]);
    return { staff, services };
  });
  const [editing, setEditing] = useState<string | null>(null);
  if (!data) return <p className="text-muted">{t.common.loading}</p>;
  const { staff, services } = data;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-measure text-muted">{t.panel.changesLive}</p>
        {editing !== "new" && (
          <Button type="button" onClick={() => setEditing("new")}>
            + {t.panel.staffForm.add}
          </Button>
        )}
      </div>

      {editing === "new" && (
        <section aria-labelledby="new-staff" className="mt-8 border-t-2 border-ink pt-6">
          <h2 id="new-staff" className="text-d4">{t.panel.staffForm.newTitle}</h2>
          <StaffForm services={services} onDone={() => setEditing(null)} />
        </section>
      )}

      <ul className="mt-8 border-t border-ink">
        {staff.map((m) => {
          const days = WEEKDAYS.filter((d) => m.schedule[d].length > 0);
          const open = editing === m.id;
          return (
            <li key={m.id} className="border-b border-line">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {m.name} <span className="font-normal text-muted">· {m.role}</span>
                  </p>
                  <p className="truncate text-small capitalize text-muted">
                    {days.length ? days.map(weekdayShort).join(", ") : t.panel.staffForm.noDays} ·{" "}
                    <span className="normal-case">
                      {m.serviceIds.length} {t.panel.tabs.services.toLowerCase()}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(open ? null : m.id)}
                  aria-expanded={open}
                  aria-controls={`edit-staff-${m.id}`}
                  className="link min-h-11 px-1 text-small font-medium"
                >
                  {open ? t.nav.close : t.common.edit}
                  <span className="sr-only">: {m.name}</span>
                </button>
              </div>
              {open && (
                <div id={`edit-staff-${m.id}`} className="pb-8">
                  <StaffForm member={m} services={services} onDone={() => setEditing(null)} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StaffForm({ member, services, onDone }: { member?: StaffMember; services: Service[]; onDone: () => void }) {
  const notify = useNotice();
  const [form, setForm] = useState({
    name: member?.name ?? "",
    role: member?.role ?? "",
    bio: member?.bio ?? "",
    serviceIds: member?.serviceIds ?? [],
    schedule: member?.schedule ?? emptyWeek(),
  });
  const [submitted, setSubmitted] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = member?.id ?? "new-staff";

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const errors = {
    name: form.name.trim().length >= 2 ? undefined : t.panel.staffForm.nameRequired,
    role: form.role.trim() ? undefined : t.panel.staffForm.roleRequired,
  };
  const scheduleValid = WEEKDAYS.every((d) => form.schedule[d].every(isValidRange));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (errors.name || errors.role || !scheduleValid) return;
    const input: StaffInput = {
      name: form.name.trim(),
      role: form.role.trim(),
      bio: form.bio.trim(),
      serviceIds: form.serviceIds,
      schedule: form.schedule,
      ...(member?.image ? { image: member.image } : { image: { alt: `Portrett av ${form.name.trim()}`, label: form.name.trim().split(" ")[0]! } }),
    };
    const repo = getRepository();
    if (member) {
      await repo.updateStaff(member.id, input);
      notify(`${input.name}: ${t.common.saved.toLowerCase()}`);
    } else {
      await repo.createStaff(input);
      notify(t.panel.staffForm.created(input.name));
    }
    onDone();
  }

  async function remove() {
    if (!member) return;
    try {
      await getRepository().deleteStaff(member.id);
      notify(t.panel.staffForm.removed(member.name));
      onDone();
    } catch (err) {
      setConfirmRemove(false);
      if (err instanceof InUseError) setError(t.panel.staffForm.inUse(err.upcoming));
      else throw err;
    }
  }

  return (
    <form onSubmit={save} noValidate className="mt-4 grid max-w-3xl gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Field id={`${id}-name`} label={t.panel.staffForm.name} error={submitted ? errors.name : undefined}>
          {(aria) => <TextInput {...aria} autoComplete="off" value={form.name} onChange={(e) => set("name", e.target.value)} />}
        </Field>
        <Field id={`${id}-role`} label={t.panel.staffForm.role} error={submitted ? errors.role : undefined}>
          {(aria) => (
            <TextInput
              {...aria}
              placeholder={t.panel.staffForm.rolePlaceholder}
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
            />
          )}
        </Field>
      </div>
      <Field id={`${id}-bio`} label={t.panel.staffForm.bio} hint={t.panel.staffForm.bioHint} optionalLabel={t.booking.optional}>
        {(aria) => <TextArea {...aria} rows={3} maxLength={400} value={form.bio} onChange={(e) => set("bio", e.target.value)} />}
      </Field>

      <fieldset>
        <legend className="text-small font-medium">{t.panel.staffForm.services}</legend>
        <div className="mt-3 grid gap-4">
          {salon.categories.map((c) => {
            const list = services.filter((s) => s.categoryId === c.id);
            if (list.length === 0) return null;
            return (
              <div key={c.id}>
                <p className="label text-muted">{c.name}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {list.map((s) => {
                    const checked = form.serviceIds.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        className={cx(
                          "flex min-h-11 cursor-pointer items-center rounded-ctl border px-3 text-small transition-colors has-focus-visible:outline-2 has-focus-visible:outline-accent",
                          checked ? "border-ink bg-ink text-paper" : "border-line-strong hover:border-ink",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() =>
                            set("serviceIds", checked ? form.serviceIds.filter((x) => x !== s.id) : [...form.serviceIds, s.id])
                          }
                        />
                        {s.name}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {form.serviceIds.length === 0 && <p className="mt-2 text-small text-accent">{t.panel.staffForm.noServices}</p>}
      </fieldset>

      <fieldset>
        <legend className="text-small font-medium">{t.panel.staffForm.schedule}</legend>
        <WeekScheduleFields schedule={form.schedule} onChange={(s) => set("schedule", s)} className="mt-3" />
      </fieldset>

      {error && (
        <p role="alert" className="border-l-2 border-accent bg-tint px-4 py-3 text-small">
          {error}
        </p>
      )}

      {confirmRemove && member ? (
        <div role="group" aria-labelledby={`${id}-remove-q`} className="flex flex-wrap items-center gap-3 border-l-2 border-accent bg-tint px-4 py-3">
          <p id={`${id}-remove-q`} className="flex-1 text-small font-medium">
            {t.panel.staffForm.removeConfirm(member.name)}
          </p>
          <Button type="button" variant="outline" onClick={remove} autoFocus>
            {t.panel.staffForm.removeYes}
          </Button>
          <Button type="button" onClick={() => setConfirmRemove(false)}>
            {t.common.cancel}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" size="lg" disabled={!scheduleValid}>
            {t.common.save}
          </Button>
          <button type="button" onClick={onDone} className="link min-h-11">
            {t.common.cancel}
          </button>
          {member && (
            <button type="button" onClick={() => setConfirmRemove(true)} className="link ml-auto min-h-11 text-accent">
              {t.panel.staffForm.remove}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
