"use client";

import { useRef, useState } from "react";
import { t } from "@/i18n";
import { useProfile } from "@/lib/repository/live";
import { cx } from "@/components/ui/cx";

export interface PanelTab {
  id: string;
  label: string;
  render: () => React.ReactNode;
}

interface Props {
  /** "Staff" or "Admin", shown beside the salon name. */
  area: string;
  tabs: PanelTab[];
  /** Links and actions in the header, right-hand side. */
  actions: React.ReactNode;
  /** Shown under the header row, e.g. a confirmation strip. */
  banner?: React.ReactNode;
  /** Controlled tab, for jumping between tabs. */
  tab?: string;
  onTabChange?: (id: string) => void;
}

/** Shared chrome for the Staff and Admin panels: header and keyboard-friendly tabs. */
export function PanelShell({ area, tabs, actions, banner, tab: controlled, onTabChange }: Props) {
  const profile = useProfile();
  const [own, setOwn] = useState(tabs[0]!.id);
  const active = controlled ?? own;
  const setTab = (id: string) => (onTabChange ? onTabChange(id) : setOwn(id));
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = tabs.find((x) => x.id === active) ?? tabs[0]!;

  function onKey(e: React.KeyboardEvent, index: number) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + tabs.length) % tabs.length;
    setTab(tabs[next]!.id);
    refs.current[next]?.focus();
  }

  return (
    <>
      <header className="page-x border-b border-line">
        <div className="mx-auto flex min-h-18 max-w-page flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3">
          <div className="flex items-center gap-3">
            <span className="font-display text-d4">{profile.name}</span>
            <span className="label border border-ink px-2 py-1">{area}</span>
            <span className="label border border-accent px-2 py-1 text-accent">{t.panel.demoBadge}</span>
          </div>
          <div className="-mx-1 flex w-full items-center gap-x-5 overflow-x-auto px-1 text-small whitespace-nowrap sm:w-auto">
            {actions}
          </div>
        </div>
        {banner}
      </header>
      <main className="page-x pb-24 pt-8">
        <div className="mx-auto max-w-page">
          <h1 className="sr-only">
            {profile.name}: {area}
          </h1>
          <div role="tablist" aria-label={area} className="flex gap-1 overflow-x-auto border-b border-line">
            {tabs.map((x, i) => (
              <button
                key={x.id}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`tab-${x.id}`}
                aria-selected={current.id === x.id}
                aria-controls={`panel-${x.id}`}
                tabIndex={current.id === x.id ? 0 : -1}
                onClick={() => setTab(x.id)}
                onKeyDown={(e) => onKey(e, i)}
                className={cx(
                  "-mb-px min-h-12 shrink-0 border-b-2 px-4 text-body transition-colors",
                  current.id === x.id ? "border-ink font-medium" : "border-transparent text-muted hover:text-ink",
                )}
              >
                {x.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${current.id}`} aria-labelledby={`tab-${current.id}`} className="pt-8">
            {current.render()}
          </div>
        </div>
      </main>
    </>
  );
}
