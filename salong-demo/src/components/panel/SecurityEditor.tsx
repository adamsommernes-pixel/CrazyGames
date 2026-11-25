"use client";

import { useState } from "react";
import { t } from "@/i18n";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";
import { getRepository } from "@/lib/repository/client";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { useNotice } from "./Notice";

const f = t.panel.security;

function checkNew(next: string, repeat: string) {
  return {
    next: next.length >= PASSWORD_MIN_LENGTH ? undefined : f.tooShort(PASSWORD_MIN_LENGTH),
    repeat: repeat === next ? undefined : f.mismatch,
  };
}

/** Admin → Passord: the admin's own password, and the shared password for Ansatte. */
export function SecurityEditor() {
  return (
    <div className="grid gap-16 lg:grid-cols-2">
      <AdminPasswordForm />
      <StaffPasswordForm />
    </div>
  );
}

function AdminPasswordForm() {
  const notify = useNotice();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [wrong, setWrong] = useState(false);
  const errors = checkNew(next, repeat);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setWrong(false);
    if (errors.next || errors.repeat) return;
    if (!(await getRepository().changeAdminPassword(current, next))) return setWrong(true);
    setCurrent("");
    setNext("");
    setRepeat("");
    setSubmitted(false);
    notify(f.changed);
  }

  return (
    <form onSubmit={save} noValidate className="grid max-w-md content-start gap-6" aria-labelledby="pw-admin-heading">
      <div>
        <h2 id="pw-admin-heading" className="text-d4">{f.adminHeading}</h2>
        <p className="mt-2 text-muted">{f.lead}</p>
      </div>
      <Field id="pw-current" label={f.current} error={wrong ? f.wrong : undefined}>
        {(aria) => <TextInput {...aria} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />}
      </Field>
      <Field id="pw-next" label={f.next} error={submitted ? errors.next : undefined}>
        {(aria) => <TextInput {...aria} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />}
      </Field>
      <Field id="pw-repeat" label={f.repeat} error={submitted ? errors.repeat : undefined}>
        {(aria) => <TextInput {...aria} type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />}
      </Field>
      <div>
        <Button type="submit" size="lg">{f.submit}</Button>
      </div>
    </form>
  );
}

function StaffPasswordForm() {
  const notify = useNotice();
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const errors = checkNew(next, repeat);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (errors.next || errors.repeat) return;
    await getRepository().setStaffPassword(next);
    setNext("");
    setRepeat("");
    setSubmitted(false);
    notify(f.staffChanged);
  }

  return (
    <form onSubmit={save} noValidate className="grid max-w-md content-start gap-6" aria-labelledby="pw-staff-heading">
      <div>
        <h2 id="pw-staff-heading" className="text-d4">{f.staffHeading}</h2>
        <p className="mt-2 text-muted">{f.staffLead}</p>
      </div>
      <Field id="pw-staff-next" label={f.next} error={submitted ? errors.next : undefined}>
        {(aria) => <TextInput {...aria} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />}
      </Field>
      <Field id="pw-staff-repeat" label={f.repeat} error={submitted ? errors.repeat : undefined}>
        {(aria) => <TextInput {...aria} type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />}
      </Field>
      <div>
        <Button type="submit" size="lg">{f.staffSubmit}</Button>
      </div>
      <p className="border-l-2 border-accent pl-4 text-small">{t.panel.login.warning}</p>
    </form>
  );
}
