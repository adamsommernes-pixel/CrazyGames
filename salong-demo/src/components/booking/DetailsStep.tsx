"use client";

import { useRef, useState } from "react";
import { t } from "@/i18n";
import { NOTE_MAX, validateCustomer, type CustomerErrors, type CustomerField } from "@/lib/booking/validation";
import type { Customer } from "@/lib/types";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { StepHeading } from "./StepHeading";

export const DETAILS_FORM_ID = "booking-details";

interface Props {
  initial: Customer;
  onChange: (customer: Customer) => void;
  onSubmit: (customer: Customer) => void;
}

const FIELDS: CustomerField[] = ["name", "phone", "email", "note"];

export function DetailsStep({ initial, onChange, onSubmit }: Props) {
  const [values, setValues] = useState<Customer>(initial);
  const [touched, setTouched] = useState<Partial<Record<CustomerField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  const result = validateCustomer(values);
  const allErrors: CustomerErrors = result.ok ? {} : result.errors;
  const visible = (f: CustomerField) => (submitted || touched[f] ? allErrors[f] : undefined);
  const errorList = submitted ? FIELDS.filter((f) => allErrors[f]) : [];

  const update = (field: CustomerField, value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    onChange(next);
  };
  const blur = (field: CustomerField) => setTouched((prev) => ({ ...prev, [field]: true }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (result.ok) onSubmit(result.value);
    else requestAnimationFrame(() => summaryRef.current?.focus());
  }

  const labels: Record<CustomerField, string> = {
    name: t.booking.name,
    phone: t.booking.phone,
    email: t.booking.email,
    note: t.booking.note,
  };

  return (
    <div>
      <StepHeading>{t.booking.yourDetails}</StepHeading>
      {errorList.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="mb-8 border-l-2 border-accent bg-tint px-4 py-4 outline-none">
          <p className="font-medium">{t.booking.errorsHeading}</p>
          <ul className="mt-2 grid gap-1 text-small">
            {errorList.map((f) => (
              <li key={f}>
                <a href={`#customer-${f}`} className="link">
                  {labels[f]}: {allErrors[f]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <form id={DETAILS_FORM_ID} noValidate onSubmit={submit} className="grid max-w-xl gap-7">
        <Field id="customer-name" label={labels.name} error={visible("name")}>
          {(aria) => (
            <TextInput
              {...aria}
              name="name"
              autoComplete="name"
              autoCapitalize="words"
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
              onBlur={() => blur("name")}
            />
          )}
        </Field>
        <Field id="customer-phone" label={labels.phone} hint={t.booking.phoneHint} error={visible("phone")}>
          {(aria) => (
            <TextInput
              {...aria}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="412 34 567"
              value={values.phone}
              onChange={(e) => update("phone", e.target.value)}
              onBlur={() => blur("phone")}
            />
          )}
        </Field>
        <Field id="customer-email" label={labels.email} error={visible("email")}>
          {(aria) => (
            <TextInput
              {...aria}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={values.email}
              onChange={(e) => update("email", e.target.value)}
              onBlur={() => blur("email")}
            />
          )}
        </Field>
        <Field
          id="customer-note"
          label={labels.note}
          hint={t.booking.noteHint}
          optionalLabel={t.booking.optional}
          error={visible("note")}
        >
          {(aria) => (
            <TextArea
              {...aria}
              name="note"
              maxLength={NOTE_MAX + 50}
              rows={3}
              value={values.note ?? ""}
              onChange={(e) => update("note", e.target.value)}
              onBlur={() => blur("note")}
            />
          )}
        </Field>
      </form>
    </div>
  );
}
