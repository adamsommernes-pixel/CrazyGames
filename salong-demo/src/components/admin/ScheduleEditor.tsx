"use client";

import { useState } from "react";
import { t } from "@/i18n";
import { weekdayName } from "@/lib/format";
import { WEEKDAYS } from "@/lib/hours";
import { getRepository } from "@/lib/repository/client";
import { useRepoQuery } from "@/lib/repository/query";
import type { StaffMember, WeeklySchedule } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { useNotice } from "./Notice";
import { isValidRange, RangeInputs } from "./RangeInputs";

export function ScheduleEditor() {
  const staff = useRepoQuery("admin-staff", (repo) => repo.listStaff());
  const [selected, setSelected] = useState<string | null>(null);
  if (!staff) return <p className="text-muted">{t.common.loading}</p>;
  const member = staff.find((m) => m.id === selected) ?? staff[0];
  if (!member) return null;

  return (
    <div className="grid gap-8 md:grid-cols-[14rem_1fr]">
      <ul className="flex gap-2 overflow-x-auto md:flex-col md:gap-0 md:border-t md:border-line" aria-label={t.admin.staff}>
        {staff.map((m) => (
          <li key={m.id} className="shrink-0 md:border-b md:border-line">
            <button
              type="button"
              onClick={() => setSelected(m.id)}
              aria-pressed={m.id === member.id}
              className={cx(
                "min-h-11 w-full rounded-ctl border px-4 py-2 text-left md:rounded-none md:border-0 md:px-0 md:py-3",
                m.id === member.id ? "border-ink bg-ink text-paper md:bg-transparent md:text-ink md:font-medium md:underline md:underline-offset-4" : "border-line-strong",
              )}
            >
              {m.name}
            </button>
          </li>
        ))}
      </ul>
      <ScheduleForm key={`${member.id}:${JSON.stringify(member.schedule)}`} member={member} />
    </div>
  );
}

function ScheduleForm({ member }: { member: StaffMember }) {
  const notify = useNotice();
  const [schedule, setSchedule] = useState<WeeklySchedule>(member.schedule);
  const valid = WEEKDAYS.every((d) => schedule[d].every(isValidRange));
  const dirty = JSON.stringify(schedule) !== JSON.stringify(member.schedule);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await getRepository().updateStaffSchedule(member.id, schedule);
    notify(`${member.name}: ${t.common.saved.toLowerCase()}`);
  }

  return (
    <form onSubmit={save}>
      <h2 className="text-d3">{member.name}</h2>
      <p className="mt-2 max-w-measure text-muted">{t.admin.changesLive} {t.admin.scheduleHint}</p>
      <ul className="mt-6 border-t border-line">
        {WEEKDAYS.map((day) => {
          const ranges = schedule[day];
          const setRanges = (next: typeof ranges) => setSchedule({ ...schedule, [day]: next });
          return (
            <li key={day} className="grid gap-3 border-b border-line py-4 sm:grid-cols-[7rem_1fr]">
              <span className="pt-2.5 font-medium capitalize">{weekdayName(day)}</span>
              <div className="grid gap-3">
                {ranges.length === 0 && <span className="pt-2.5 text-muted">{t.admin.dayOff}</span>}
                {ranges.map((r, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-3">
                    <RangeInputs
                      label={`${weekdayName(day)} ${i + 1}`}
                      range={r}
                      onChange={(next) => setRanges(ranges.map((x, j) => (j === i ? next : x)))}
                    />
                    <button
                      type="button"
                      onClick={() => setRanges(ranges.filter((_, j) => j !== i))}
                      className="link min-h-11 text-small"
                    >
                      {t.admin.removeRange}
                    </button>
                    {!isValidRange(r) && <span className="text-small text-accent">{t.admin.endAfterStart}</span>}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setRanges([...ranges, ranges.length ? { start: "13:00", end: "17:00" } : { start: "09:00", end: "17:00" }])}
                  className="link min-h-11 w-fit text-small font-medium"
                >
                  + {t.admin.addRange}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <Button type="submit" size="lg" className="mt-8" disabled={!dirty || !valid}>
        {t.common.save}
      </Button>
    </form>
  );
}
