"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { salon } from "@config";
import { t } from "@/i18n";
import { getRepository } from "@/lib/repository/client";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { CalendarView } from "./CalendarView";
import { HoursEditor } from "./HoursEditor";
import { NoticeProvider, useNotice } from "./Notice";
import { ScheduleEditor } from "./ScheduleEditor";
import { ServicesEditor } from "./ServicesEditor";

const GATE_KEY = "salong-demo:admin";
const gateListeners = new Set<() => void>();
let gateOverride = false;

function readGate() {
  try {
    return window.sessionStorage.getItem(GATE_KEY) === "1";
  } catch {
    return false;
  }
}

function openGate() {
  try {
    window.sessionStorage.setItem(GATE_KEY, "1");
  } catch {
    // Storage unavailable: the gate simply opens for this page view.
  }
  gateOverride = true;
  for (const l of gateListeners) l();
}

function useGate(): boolean | null {
  return useSyncExternalStore(
    (l) => {
      gateListeners.add(l);
      return () => gateListeners.delete(l);
    },
    () => gateOverride || readGate(),
    () => null,
  );
}

export function AdminApp() {
  const open = useGate();
  if (open === null) return null;
  return <NoticeProvider>{open ? <Dashboard /> : <Gate />}</NoticeProvider>;
}

function Gate() {
  return (
    <main className="page-x grid min-h-dvh place-items-center py-16">
      <div className="w-full max-w-lg">
        <p className="label inline-flex items-center gap-3 border border-accent px-3 py-1.5 text-accent">
          {t.admin.demoBadge}
        </p>
        <h1 className="mt-8 text-d2">{t.admin.gateHeading}</h1>
        <p className="mt-6 text-lead">{t.admin.gateBody}</p>
        <p className="mt-6 border-l-2 border-accent pl-4 text-small">{t.admin.gateWarning}</p>
        <div className="mt-10 flex flex-wrap items-center gap-6">
          <Button type="button" size="lg" arrow onClick={openGate} autoFocus>
            {t.admin.gateEnter}
          </Button>
          <Link href="/" className="link">
            {t.admin.viewSite}
          </Link>
        </div>
      </div>
    </main>
  );
}

const TABS = ["calendar", "services", "staff", "hours"] as const;
type Tab = (typeof TABS)[number];

function Dashboard() {
  const [tab, setTab] = useState<Tab>("calendar");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const notify = useNotice();

  const [confirmReset, setConfirmReset] = useState(false);

  async function reset() {
    await getRepository().resetDemoData();
    setConfirmReset(false);
    notify(t.admin.resetDone);
  }

  function onTabKey(e: React.KeyboardEvent, index: number) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + TABS.length) % TABS.length;
    setTab(TABS[next]!);
    tabRefs.current[next]?.focus();
  }

  return (
    <>
      <header className="page-x border-b border-line">
        <div className="mx-auto flex min-h-18 max-w-page flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3">
          <div className="flex items-center gap-4">
            <span className="font-display text-d4">{salon.name}</span>
            <span className="label border border-accent px-2 py-1 text-accent">{t.admin.demoBadge}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-small">
            <Link href="/" className="link">{t.admin.viewSite}</Link>
            <Link href="/bestill" className="link">{t.nav.book}</Link>
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              aria-expanded={confirmReset}
              aria-controls="reset-confirm"
              className="link min-h-11 text-accent"
            >
              {t.admin.reset}
            </button>
          </div>
        </div>
        {confirmReset && (
          <div
            id="reset-confirm"
            role="alertdialog"
            aria-labelledby="reset-text"
            className="mx-auto mb-4 flex max-w-page flex-wrap items-center gap-4 border-l-2 border-accent bg-tint px-4 py-3"
          >
            <p id="reset-text" className="flex-1 text-small">{t.admin.resetConfirm}</p>
            <Button type="button" onClick={reset} autoFocus>
              {t.admin.resetYes}
            </Button>
            <Button type="button" variant="outline" onClick={() => setConfirmReset(false)}>
              {t.common.cancel}
            </Button>
          </div>
        )}
      </header>

      <main className="page-x pb-24 pt-8">
        <div className="mx-auto max-w-page">
          <h1 className="sr-only">{t.admin.title}</h1>
          <div role="tablist" aria-label={t.admin.title} className="flex gap-1 overflow-x-auto border-b border-line">
            {TABS.map((id, i) => (
              <button
                key={id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                tabIndex={tab === id ? 0 : -1}
                onClick={() => setTab(id)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={cx(
                  "-mb-px min-h-12 shrink-0 border-b-2 px-4 text-body transition-colors",
                  tab === id ? "border-ink font-medium" : "border-transparent text-muted hover:text-ink",
                )}
              >
                {t.admin.tabs[id]}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-8">
            {tab === "calendar" && <CalendarView />}
            {tab === "services" && <ServicesEditor />}
            {tab === "staff" && <ScheduleEditor />}
            {tab === "hours" && <HoursEditor />}
          </div>
        </div>
      </main>
    </>
  );
}
