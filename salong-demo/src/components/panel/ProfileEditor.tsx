"use client";

import { useState } from "react";
import { t } from "@/i18n";
import { normalizeNorwegianPhone, isValidEmail } from "@/lib/booking/validation";
import { getRepository } from "@/lib/repository/client";
import { useRepoQuery } from "@/lib/repository/query";
import type { SalonProfile } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { useNotice } from "./Notice";

export function ProfileEditor() {
  const profile = useRepoQuery("admin-profile", (repo) => repo.getProfile());
  if (!profile) return <p className="text-muted">{t.common.loading}</p>;
  return <ProfileForm key={JSON.stringify(profile)} initial={profile} />;
}

const f = t.panel.profileForm;

function ProfileForm({ initial }: { initial: SalonProfile }) {
  const notify = useNotice();
  const [p, setP] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const a = p.contact.address;

  const required = (v: string) => (v.trim() ? undefined : f.required);
  const errors: Record<string, string | undefined> = {
    name: required(p.name),
    logoText: required(p.logo.text),
    logoMark: required(p.logo.mark),
    tagline: required(p.tagline),
    heading: required(p.hero.heading),
    lead: required(p.hero.lead),
    phone: !p.contact.phone.trim() ? f.required : normalizeNorwegianPhone(p.contact.phone) ? undefined : t.validation.phoneInvalid,
    email: !p.contact.email.trim() ? f.required : isValidEmail(p.contact.email) ? undefined : t.validation.emailInvalid,
    street: required(a.street),
    postalCode: /^\d{4}$/.test(a.postalCode) ? undefined : f.postalInvalid,
    city: required(a.city),
    area: required(a.area),
  };
  const err = (key: string) => (submitted ? errors[key] : undefined);
  const dirty = JSON.stringify(p) !== JSON.stringify(initial);

  const setContact = (patch: Partial<SalonProfile["contact"]>) => setP({ ...p, contact: { ...p.contact, ...patch } });
  const setAddress = (patch: Partial<SalonProfile["contact"]["address"]>) => setContact({ address: { ...a, ...patch } });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    const phone = normalizeNorwegianPhone(p.contact.phone)!;
    await getRepository().updateProfile({
      ...p,
      name: p.name.trim(),
      tagline: p.tagline.trim(),
      contact: { ...p.contact, phone, email: p.contact.email.trim().toLowerCase() },
    });
    notify(f.saved);
  }

  return (
    <form onSubmit={save} noValidate className="grid max-w-3xl gap-12">
      <p className="max-w-measure text-muted">{f.lead}</p>

      <fieldset className="grid gap-6">
        <legend className="text-d4">{f.identity}</legend>
        <Field id="p-name" label={f.name} error={err("name")}>
          {(aria) => <TextInput {...aria} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />}
        </Field>
        <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)]">
          <Field id="p-logo-text" label={f.logoText} error={err("logoText")}>
            {(aria) => <TextInput {...aria} value={p.logo.text} onChange={(e) => setP({ ...p, logo: { ...p.logo, text: e.target.value } })} />}
          </Field>
          <Field id="p-logo-mark" label={f.logoMark} error={err("logoMark")}>
            {(aria) => (
              <TextInput {...aria} maxLength={2} value={p.logo.mark} onChange={(e) => setP({ ...p, logo: { ...p.logo, mark: e.target.value } })} />
            )}
          </Field>
          <Field id="p-logo-suffix" label={f.logoSuffix} optionalLabel={t.booking.optional}>
            {(aria) => (
              <TextInput
                {...aria}
                maxLength={20}
                value={p.logo.suffix ?? ""}
                onChange={(e) => setP({ ...p, logo: { ...p.logo, suffix: e.target.value } })}
              />
            )}
          </Field>
        </div>
        <Field id="p-tagline" label={f.tagline} error={err("tagline")}>
          {(aria) => <TextInput {...aria} maxLength={80} value={p.tagline} onChange={(e) => setP({ ...p, tagline: e.target.value })} />}
        </Field>
      </fieldset>

      <fieldset className="grid gap-6">
        <legend className="text-d4">{f.front}</legend>
        <Field id="p-eyebrow" label={f.eyebrow} optionalLabel={t.booking.optional}>
          {(aria) => (
            <TextInput {...aria} maxLength={60} value={p.hero.eyebrow} onChange={(e) => setP({ ...p, hero: { ...p.hero, eyebrow: e.target.value } })} />
          )}
        </Field>
        <Field id="p-heading" label={f.heading} error={err("heading")}>
          {(aria) => (
            <TextInput {...aria} maxLength={70} value={p.hero.heading} onChange={(e) => setP({ ...p, hero: { ...p.hero, heading: e.target.value } })} />
          )}
        </Field>
        <Field id="p-lead" label={f.heroLead} error={err("lead")}>
          {(aria) => (
            <TextArea {...aria} rows={3} maxLength={220} value={p.hero.lead} onChange={(e) => setP({ ...p, hero: { ...p.hero, lead: e.target.value } })} />
          )}
        </Field>
      </fieldset>

      <fieldset className="grid gap-6">
        <legend className="text-d4">{f.contact}</legend>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field id="p-phone" label={f.phone} error={err("phone")}>
            {(aria) => <TextInput {...aria} type="tel" value={p.contact.phone} onChange={(e) => setContact({ phone: e.target.value })} />}
          </Field>
          <Field id="p-email" label={f.email} error={err("email")}>
            {(aria) => <TextInput {...aria} type="email" value={p.contact.email} onChange={(e) => setContact({ email: e.target.value })} />}
          </Field>
        </div>
        <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)]">
          <Field id="p-street" label={f.street} error={err("street")}>
            {(aria) => <TextInput {...aria} value={a.street} onChange={(e) => setAddress({ street: e.target.value })} />}
          </Field>
          <Field id="p-postal" label={f.postalCode} error={err("postalCode")}>
            {(aria) => (
              <TextInput {...aria} inputMode="numeric" maxLength={4} value={a.postalCode} onChange={(e) => setAddress({ postalCode: e.target.value.replace(/\D/g, "") })} />
            )}
          </Field>
          <Field id="p-city" label={f.city} error={err("city")}>
            {(aria) => <TextInput {...aria} value={a.city} onChange={(e) => setAddress({ city: e.target.value })} />}
          </Field>
        </div>
        <Field id="p-area" label={f.area} error={err("area")}>
          {(aria) => <TextInput {...aria} value={a.area} onChange={(e) => setAddress({ area: e.target.value })} />}
        </Field>
        <Field id="p-directions" label={f.directions} optionalLabel={t.booking.optional}>
          {(aria) => (
            <TextArea {...aria} rows={2} maxLength={240} value={p.contact.directions} onChange={(e) => setContact({ directions: e.target.value })} />
          )}
        </Field>
      </fieldset>

      <div className="grid gap-4">
        <div>
          <Button type="submit" size="lg" disabled={!dirty}>
            {t.common.save}
          </Button>
        </div>
        <p className="max-w-measure text-small text-muted">{f.seoNote}</p>
      </div>
    </form>
  );
}
