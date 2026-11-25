/**
 * Customer input validation for the booking form. Messages are Norwegian,
 * written to tell the customer exactly what to fix.
 */
import { t } from "@/i18n";
import type { Customer } from "@/lib/types";

export const NOTE_MAX = 500;

export type CustomerField = keyof Customer;
export type CustomerErrors = Partial<Record<CustomerField, string>>;

export type ValidationResult =
  | { ok: true; value: Customer }
  | { ok: false; errors: CustomerErrors };

/**
 * Accepts Norwegian numbers with or without +47/0047 and any spacing.
 * Norwegian numbers are 8 digits; mobile numbers start with 4 or 9, landlines
 * with 2, 3, 5, 6 or 7. Numbers starting with 0 or 1 are service numbers.
 */
export function normalizeNorwegianPhone(raw: string): string | null {
  const compact = raw.replace(/[\s().-]/g, "");
  const local = compact.replace(/^(\+47|0047)/, "");
  if (!/^[2-9]\d{7}$/.test(local)) return null;
  // Format as "+47 412 34 567"
  return `+47 ${local.slice(0, 3)} ${local.slice(3, 5)} ${local.slice(5)}`;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/;

export function isValidEmail(raw: string): boolean {
  const value = raw.trim();
  return value.length <= 254 && EMAIL.test(value) && !value.includes("..");
}

export function validateCustomer(input: Customer): ValidationResult {
  const errors: CustomerErrors = {};
  const name = input.name.trim().replace(/\s+/g, " ");
  const email = input.email.trim();
  const note = input.note?.trim() ?? "";

  if (!name) errors.name = t.validation.nameRequired;
  else if (name.replace(/[^\p{L}]/gu, "").length < 2) errors.name = t.validation.nameTooShort;

  let phone: string | null = null;
  if (!input.phone.trim()) errors.phone = t.validation.phoneRequired;
  else {
    phone = normalizeNorwegianPhone(input.phone);
    if (!phone) errors.phone = t.validation.phoneInvalid;
  }

  if (!email) errors.email = t.validation.emailRequired;
  else if (!isValidEmail(email)) errors.email = t.validation.emailInvalid;

  if (note.length > NOTE_MAX) errors.note = t.validation.noteTooLong(NOTE_MAX);

  if (Object.keys(errors).length > 0 || !phone) return { ok: false, errors };
  return { ok: true, value: { name, phone, email: email.toLowerCase(), ...(note ? { note } : {}) } };
}
