"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { t } from "@/i18n";
import { Button } from "@/components/ui/Button";
import { CalendarView } from "./CalendarView";
import { ClosuresEditor } from "./ClosuresEditor";
import { NoticeProvider } from "./Notice";
import { PanelShell } from "./PanelShell";
import { ScheduleEditor } from "./ScheduleEditor";
import { createSessionFlag } from "./session";

const gate = createSessionFlag("salong-demo:staff");

/** /staff: day-to-day work for everyone in the salon. */
export function StaffApp() {
  const open = useSyncExternalStore(gate.subscribe, gate.read, () => null);
  if (open === null) return null;
  return <NoticeProvider>{open ? <StaffPanel /> : <Gate />}</NoticeProvider>;
}

function Gate() {
  return (
    <main className="page-x grid min-h-dvh place-items-center py-16">
      <div className="w-full max-w-lg">
        <p className="label inline-flex items-center gap-3 border border-accent px-3 py-1.5 text-accent">{t.panel.demoBadge}</p>
        <h1 className="mt-8 text-d2">{t.panel.gateHeading}</h1>
        <p className="mt-6 text-lead">{t.panel.gateBody}</p>
        <p className="mt-6 border-l-2 border-accent pl-4 text-small">{t.panel.gateWarning}</p>
        <div className="mt-10 flex flex-wrap items-center gap-6">
          <Button type="button" size="lg" arrow onClick={() => gate.set(true)} autoFocus>
            {t.panel.gateEnter}
          </Button>
          <Link href="/" className="link">
            {t.panel.viewSite}
          </Link>
        </div>
      </div>
    </main>
  );
}

function StaffPanel() {
  const [tab, setTab] = useState("calendar");
  const [calendarDate, setCalendarDate] = useState<string | null>(null);
  return (
    <PanelShell
      area={t.panel.staffTitle}
      tab={tab}
      onTabChange={setTab}
      actions={
        <>
          <Link href="/" className="link">{t.panel.viewSite}</Link>
          <Link href="/bestill" className="link">{t.nav.book}</Link>
          <Link href="/admin" className="link font-medium">{t.panel.login.toAdmin}</Link>
        </>
      }
      tabs={[
        {
          id: "calendar",
          label: t.panel.tabs.calendar,
          render: () => <CalendarView key={calendarDate ?? "today"} initialDate={calendarDate} />,
        },
        {
          id: "closures",
          label: t.panel.tabs.closures,
          render: () => (
            <ClosuresEditor
              onOpenDate={(date) => {
                setCalendarDate(date);
                setTab("calendar");
              }}
            />
          ),
        },
        { id: "schedules", label: t.panel.tabs.staff, render: () => <ScheduleEditor /> },
      ]}
    />
  );
}
