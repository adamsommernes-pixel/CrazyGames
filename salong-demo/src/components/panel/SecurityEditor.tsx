"use client";

import { useState } from "react";
import { t } from "@/i18n";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";
import { getRepository } from "@/lib/repository/client";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { useNotice } from "./Notice";

const f = t.panel.security;

export function SecurityEditor() {
  const notify = useNotice();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [wrong, setWrong] = useState(false);

  const errors = {
    next: next.length >= PASSWORD_MIN_LENGTH ? undefined : f.tooShort(PASSWORD_MIN_LENGTH),
    repeat: repeat === next ? undefined : f.mismatch,
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setWrong(false);
    if (errors.next || errors.repeat) return;
    const ok = await getRepository().changeAdminPassword(current, next);
    if (!ok) return setWrong(true);
    setCurrent("");
    setNext("");
    setRepeat("");
    setSubmitted(false);
    notify(f.changed);
  }

  return (
    <form onSubmit={save} noValidate className="grid max-w-md gap-6">
      <p className="text-muted">{f.lead}</p>
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
      <p className="border-l-2 border-accent pl-4 text-small">{t.panel.login.warning}</p>
    </form>
  );
}
