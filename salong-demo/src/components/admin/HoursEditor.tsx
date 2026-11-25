"use client";

import { useState } from "react";
import { t } from "@/i18n";
import { weekdayName } from "@/lib/format";
import { WEEKDAYS } from "@/lib/hours";
import { getRepository } from "@/lib/repository/client";
import { useRepoQuery } from "@/lib/repository/query";
import type { OpeningHours } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { useNotice } from "./Notice";
import { isValidRange, RangeInputs } from "./RangeInputs";

export function HoursEditor() {
  const hours = useRepoQuery("admin-hours", (repo) => repo.getOpeningHours());
  if (!hours) return <p className="text-muted">{t.common.loading}</p>;
  return <HoursForm key={JSON.stringify(hours)} initial={hours} />;
}

function HoursForm({ initial }: { initial: OpeningHours }) {
  const notify = useNotice();
  const [hours, setHours] = useState(initial);
  const valid = WEEKDAYS.every((d) => !hours[d] || isValidRange(hours[d]!));
  const dirty = JSON.stringify(hours) !== JSON.stringify(initial);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await getRepository().updateOpeningHours(hours);
    notify(`${t.common.openingHours}: ${t.common.saved.toLowerCase()}`);
  }

  return (
    <form onSubmit={save} className="max-w-2xl">
      <p className="max-w-measure text-muted">
        {t.admin.changesLive} {t.admin.hoursHint}
      </p>
      <ul className="mt-8 border-t border-line">
        {WEEKDAYS.map((day) => {
          const range = hours[day];
          return (
            <li key={day} className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line py-4">
              <span className="w-24 font-medium capitalize">{weekdayName(day)}</span>
              <label className="flex min-h-11 items-center gap-2 text-small">
                <input
                  type="checkbox"
                  checked={!range}
                  onChange={(e) =>
                    setHours({ ...hours, [day]: e.target.checked ? null : { start: "09:00", end: "17:00" } })
                  }
                  className="h-5 w-5 accent-[var(--salon-ink)]"
                />
                {t.admin.closedAllDay}
              </label>
              {range && (
                <RangeInputs label={weekdayName(day)} range={range} onChange={(r) => setHours({ ...hours, [day]: r })} />
              )}
              {range && !isValidRange(range) && <span className="text-small text-accent">{t.admin.endAfterStart}</span>}
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
