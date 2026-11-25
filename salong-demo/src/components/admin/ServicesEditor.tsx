"use client";

import { useState } from "react";
import { salon } from "@config";
import { t } from "@/i18n";
import { getRepository } from "@/lib/repository/client";
import { useRepoQuery } from "@/lib/repository/query";
import type { Service } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { useNotice } from "./Notice";

const DURATIONS = Array.from({ length: 36 }, (_, i) => (i + 1) * 10);

export function ServicesEditor() {
  const services = useRepoQuery("admin-services", (repo) => repo.listServices({ includeInactive: true }));
  if (!services) return <p className="text-muted">{t.common.loading}</p>;
  return (
    <div>
      <p className="max-w-measure text-muted">{t.admin.changesLive} {t.admin.activeHint}</p>
      {salon.categories.map((c) => (
        <section key={c.id} className="mt-10" aria-labelledby={`cat-${c.id}`}>
          <h2 id={`cat-${c.id}`} className="text-d4">{c.name}</h2>
          <div className="mt-3 hidden grid-cols-[minmax(0,1fr)_8rem_8rem_6rem_7rem] gap-3 border-b border-ink pb-2 text-small text-muted lg:grid">
            <span>{t.admin.service}</span>
            <span>{t.services.price} (kr)</span>
            <span>{t.services.duration}</span>
            <span>{t.admin.active}</span>
            <span />
          </div>
          <ul>
            {services
              .filter((s) => s.categoryId === c.id)
              .map((s) => (
                // Re-mount the row when the stored values change (e.g. after a reset).
                <ServiceRow key={`${s.id}:${s.name}:${s.priceNok}:${s.durationMin}:${s.active}`} service={s} />
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ServiceRow({ service }: { service: Service }) {
  const notify = useNotice();
  const [name, setName] = useState(service.name);
  const [price, setPrice] = useState(String(service.priceNok));
  const [duration, setDuration] = useState(service.durationMin);
  const [active, setActive] = useState(service.active);
  const priceNumber = Number(price);
  const valid = name.trim().length > 1 && Number.isInteger(priceNumber) && priceNumber >= 0;
  const dirty =
    name !== service.name || priceNumber !== service.priceNok || duration !== service.durationMin || active !== service.active;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    await getRepository().updateService(service.id, { name: name.trim(), priceNok: priceNumber, durationMin: duration, active });
    notify(`${name.trim()}: ${t.common.saved.toLowerCase()}`);
  }

  const id = `svc-${service.id}`;
  return (
    <li className="border-b border-line py-4">
      <form onSubmit={save} className="grid grid-cols-2 items-end gap-3 lg:grid-cols-[minmax(0,1fr)_8rem_8rem_6rem_7rem]">
        <label className="col-span-2 grid gap-1 lg:col-span-1">
          <span className="text-small text-muted lg:sr-only">{t.admin.service}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={input} id={`${id}-name`} />
        </label>
        <label className="grid gap-1">
          <span className="text-small text-muted lg:sr-only">{t.services.price} (kr)</span>
          <input
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
            aria-invalid={!valid || undefined}
            className={cx(input, "tabular")}
            aria-label={`${t.services.price}, ${service.name}`}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-small text-muted lg:sr-only">{t.services.duration}</span>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={input} aria-label={`${t.services.duration}, ${service.name}`}>
            {DURATIONS.map((d) => (
              <option key={d} value={d}>{d} min</option>
            ))}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-small">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-5 w-5 accent-[var(--salon-ink)]" />
          {active ? t.admin.active : t.admin.inactive}
        </label>
        <Button type="submit" disabled={!dirty || !valid} className="w-full">
          {t.common.save}
        </Button>
      </form>
    </li>
  );
}

const input = "min-h-11 w-full rounded-ctl border border-line-strong bg-paper px-3 text-body hover:border-ink aria-[invalid=true]:border-accent";
