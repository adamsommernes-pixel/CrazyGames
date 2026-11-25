"use client";

import { useState } from "react";
import { t } from "@/i18n";
import { getRepository } from "@/lib/repository/client";
import { useRepoQuery } from "@/lib/repository/query";
import type { BookingRules } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
import { useNotice } from "./Notice";

const f = t.panel.rulesForm;

/** Each rule is a short list of sensible choices, so nothing can be set to nonsense. */
const OPTIONS = {
  slotStepMin: { values: [5, 10, 15, 20, 30, 60], label: f.minutes },
  bufferMin: { values: [0, 5, 10, 15, 20, 30], label: f.minutes },
  minNoticeMin: { values: [0, 30, 60, 120, 240, 720, 1440], label: (n: number) => (n < 60 ? f.minutes(n) : f.hours(n / 60)) },
  horizonDays: { values: [14, 30, 60, 90, 120, 180], label: f.days },
  cancellationHours: { values: [0, 2, 6, 12, 24, 48], label: f.hoursBefore },
} satisfies Record<string, { values: number[]; label: (n: number) => string }>;

type NumericRule = keyof typeof OPTIONS;

const LABELS: Record<NumericRule, { label: string; hint?: string }> = {
  slotStepMin: { label: f.slotStep, hint: f.slotStepHint },
  bufferMin: { label: f.buffer, hint: f.bufferHint },
  minNoticeMin: { label: f.notice, hint: f.noticeHint },
  horizonDays: { label: f.horizon },
  cancellationHours: { label: f.cancellation },
};

export function RulesEditor() {
  const rules = useRepoQuery("admin-rules", (repo) => repo.getRules());
  if (!rules) return <p className="text-muted">{t.common.loading}</p>;
  return <RulesForm key={JSON.stringify(rules)} initial={rules} />;
}

function RulesForm({ initial }: { initial: BookingRules }) {
  const notify = useNotice();
  const [rules, setRules] = useState(initial);
  const dirty = JSON.stringify(rules) !== JSON.stringify(initial);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await getRepository().updateRules(rules);
    notify(f.saved);
  }

  return (
    <form onSubmit={save} className="grid max-w-2xl gap-8">
      <p className="max-w-measure text-muted">{f.lead}</p>
      <div className="grid gap-6 sm:grid-cols-2">
        {(Object.keys(OPTIONS) as NumericRule[]).map((key) => {
          const { values, label } = OPTIONS[key];
          // Keep a stored value that is not in the list selectable.
          const list = values.includes(rules[key]) ? values : [...values, rules[key]].sort((x, y) => x - y);
          return (
            <Field key={key} id={`rule-${key}`} label={LABELS[key].label} hint={LABELS[key].hint}>
              {(aria) => (
                <Select {...aria} value={rules[key]} onChange={(e) => setRules({ ...rules, [key]: Number(e.target.value) })}>
                  {list.map((v) => (
                    <option key={v} value={v}>{label(v)}</option>
                  ))}
                </Select>
              )}
            </Field>
          );
        })}
      </div>
      <label className="flex min-h-11 items-center gap-3">
        <input
          id="rule-holidays"
          type="checkbox"
          checked={rules.closeOnPublicHolidays}
          onChange={(e) => setRules({ ...rules, closeOnPublicHolidays: e.target.checked })}
          className="h-5 w-5 accent-[var(--salon-ink)]"
        />
        {f.holidays}
      </label>
      <div>
        <Button type="submit" size="lg" disabled={!dirty}>
          {t.common.save}
        </Button>
      </div>
    </form>
  );
}
