"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { t } from "@/i18n";
import { getRepository } from "@/lib/repository/client";
import { Button } from "@/components/ui/Button";
import { HoursEditor } from "./HoursEditor";
import { NoticeProvider, useNotice } from "./Notice";
import { PanelShell } from "./PanelShell";
import { ProfileEditor } from "./ProfileEditor";
import { RulesEditor } from "./RulesEditor";
import { SecurityEditor } from "./SecurityEditor";
import { ServicesEditor } from "./ServicesEditor";
import { PasswordLogin } from "./PasswordLogin";
import { adminSession } from "./session";
import { StaffManager } from "./StaffManager";

/** /admin: owner settings behind a password. */
export function AdminApp() {
  const open = useSyncExternalStore(adminSession.subscribe, adminSession.read, () => null);
  if (open === null) return null;
  return <NoticeProvider>{open ? <AdminPanel /> : <Login />}</NoticeProvider>;
}

function Login() {
  return (
    <PasswordLogin
      id="admin"
      heading={t.panel.login.heading}
      body={t.panel.login.body}
      verify={(password) => getRepository().verifyAdminPassword(password)}
      onSuccess={() => adminSession.set(true)}
      link={{ href: "/ansatte", label: t.panel.login.toStaff }}
    />
  );
}

function AdminPanel() {
  const notify = useNotice();
  const [confirmReset, setConfirmReset] = useState(false);

  async function reset() {
    await getRepository().resetDemoData();
    setConfirmReset(false);
    notify(t.panel.resetDone);
  }

  return (
    <PanelShell
      area={t.panel.adminTitle}
      actions={
        <>
          <Link href="/" className="link">{t.panel.viewSite}</Link>
          <Link href="/ansatte" className="link">{t.panel.login.toStaff}</Link>
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            aria-expanded={confirmReset}
            aria-controls="reset-confirm"
            className="link min-h-11 text-accent"
          >
            {t.panel.reset}
          </button>
          <button type="button" onClick={() => adminSession.set(false)} className="link min-h-11 font-medium">
            {t.panel.login.logout}
          </button>
        </>
      }
      banner={
        confirmReset && (
          <div
            id="reset-confirm"
            role="alertdialog"
            aria-labelledby="reset-text"
            className="mx-auto mb-4 flex max-w-page flex-wrap items-center gap-4 border-l-2 border-accent bg-tint px-4 py-3"
          >
            <p id="reset-text" className="flex-1 text-small">{t.panel.resetConfirm}</p>
            <Button type="button" onClick={reset} autoFocus>
              {t.panel.resetYes}
            </Button>
            <Button type="button" variant="outline" onClick={() => setConfirmReset(false)}>
              {t.common.cancel}
            </Button>
          </div>
        )
      }
      tabs={[
        { id: "team", label: t.panel.tabs.team, render: () => <StaffManager /> },
        { id: "services", label: t.panel.tabs.services, render: () => <ServicesEditor /> },
        { id: "hours", label: t.panel.tabs.hours, render: () => <HoursEditor /> },
        { id: "salon", label: t.panel.tabs.salon, render: () => <ProfileEditor /> },
        { id: "rules", label: t.panel.tabs.rules, render: () => <RulesEditor /> },
        { id: "security", label: t.panel.tabs.security, render: () => <SecurityEditor /> },
      ]}
    />
  );
}
