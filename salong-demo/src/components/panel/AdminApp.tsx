"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { t } from "@/i18n";
import { getRepository } from "@/lib/repository/client";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { HoursEditor } from "./HoursEditor";
import { NoticeProvider, useNotice } from "./Notice";
import { PanelShell } from "./PanelShell";
import { ProfileEditor } from "./ProfileEditor";
import { RulesEditor } from "./RulesEditor";
import { SecurityEditor } from "./SecurityEditor";
import { ServicesEditor } from "./ServicesEditor";
import { createSessionFlag } from "./session";
import { StaffManager } from "./StaffManager";

const unlocked = createSessionFlag("salong-demo:admin");

/** /admin: owner settings behind a password. */
export function AdminApp() {
  const open = useSyncExternalStore(unlocked.subscribe, unlocked.read, () => null);
  if (open === null) return null;
  return <NoticeProvider>{open ? <AdminPanel /> : <Login />}</NoticeProvider>;
}

function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return setError(t.panel.login.required);
    setBusy(true);
    const ok = await getRepository().verifyAdminPassword(password);
    setBusy(false);
    if (ok) unlocked.set(true);
    else {
      setError(t.panel.login.wrong);
      setPassword("");
    }
  }

  return (
    <main className="page-x grid min-h-dvh place-items-center py-16">
      <div className="w-full max-w-md">
        <p className="label inline-flex items-center gap-3 border border-accent px-3 py-1.5 text-accent">{t.panel.demoBadge}</p>
        <h1 className="mt-8 text-d2">{t.panel.login.heading}</h1>
        <p className="mt-6 text-lead">{t.panel.login.body}</p>
        <form onSubmit={submit} noValidate className="mt-10 grid gap-6">
          <Field id="admin-password" label={t.panel.login.password} error={error ?? undefined}>
            {(aria) => (
              <TextInput
                {...aria}
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
              />
            )}
          </Field>
          <div className="flex flex-wrap items-center gap-6">
            <Button type="submit" size="lg" arrow disabled={busy}>
              {t.panel.login.submit}
            </Button>
            <Link href="/staff" className="link">
              {t.panel.login.toStaff}
            </Link>
          </div>
        </form>
        <p className="mt-10 border-l-2 border-accent pl-4 text-small">{t.panel.login.warning}</p>
      </div>
    </main>
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
          <Link href="/staff" className="link">{t.panel.login.toStaff}</Link>
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            aria-expanded={confirmReset}
            aria-controls="reset-confirm"
            className="link min-h-11 text-accent"
          >
            {t.panel.reset}
          </button>
          <button type="button" onClick={() => unlocked.set(false)} className="link min-h-11 font-medium">
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
