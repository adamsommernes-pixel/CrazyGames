"use client";

import Link from "next/link";
import { useState } from "react";
import { t } from "@/i18n";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";

interface Props {
  id: string;
  heading: string;
  body: string;
  verify: (password: string) => Promise<boolean>;
  onSuccess: () => void;
  /** A secondary link under the form, e.g. back to the site. */
  link: { href: string; label: string };
}

/** Password screen shared by Ansatte and Admin. */
export function PasswordLogin({ id, heading, body, verify, onSuccess, link }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return setError(t.panel.login.required);
    setBusy(true);
    const ok = await verify(password);
    setBusy(false);
    if (ok) onSuccess();
    else {
      setError(t.panel.login.wrong);
      setPassword("");
    }
  }

  return (
    <main className="page-x grid min-h-dvh place-items-center py-16">
      <div className="w-full max-w-md">
        <p className="label inline-flex items-center gap-3 border border-accent px-3 py-1.5 text-accent">{t.panel.demoBadge}</p>
        <h1 className="mt-8 text-d2">{heading}</h1>
        <p className="mt-6 text-lead">{body}</p>
        <form onSubmit={submit} noValidate className="mt-10 grid gap-6">
          <Field id={`${id}-password`} label={t.panel.login.password} error={error ?? undefined}>
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
            <Link href={link.href} className="link">
              {link.label}
            </Link>
          </div>
        </form>
        <p className="mt-10 border-l-2 border-accent pl-4 text-small">{t.panel.login.warning}</p>
      </div>
    </main>
  );
}
