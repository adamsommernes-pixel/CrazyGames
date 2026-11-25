"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { t } from "@/i18n";
import { getRepository } from "@/lib/repository/client";
import { CalendarView } from "./CalendarView";
import { ClosuresEditor } from "./ClosuresEditor";
import { NoticeProvider } from "./Notice";
import { PanelShell } from "./PanelShell";
import { ScheduleEditor } from "./ScheduleEditor";
import { PasswordLogin } from "./PasswordLogin";
import { adminSession, staffSession } from "./session";

const subscribe = (listener: () => void) => {
  const a = staffSession.subscribe(listener);
  const b = adminSession.subscribe(listener);
  return () => {
    a();
    b();
  };
};
const read = () => staffSession.read() || adminSession.read();

/** /ansatte: day-to-day work for everyone in the salon, behind the staff password. */
export function StaffApp() {
  const open = useSyncExternalStore(subscribe, read, () => null);
  if (open === null) return null;
  return (
    <NoticeProvider>
      {open ? (
        <StaffPanel />
      ) : (
        <PasswordLogin
          id="staff"
          heading={t.panel.staffLogin.heading}
          body={t.panel.staffLogin.body}
          verify={(password) => getRepository().verifyStaffPassword(password)}
          onSuccess={() => staffSession.set(true)}
          link={{ href: "/", label: t.panel.viewSite }}
        />
      )}
    </NoticeProvider>
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
          <button
            type="button"
            className="link min-h-11"
            onClick={() => {
              staffSession.set(false);
              adminSession.set(false);
            }}
          >
            {t.panel.login.logout}
          </button>
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
