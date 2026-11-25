import { describe, expect, it } from "vitest";
import { isValidEmail, normalizeNorwegianPhone, validateCustomer } from "./validation";
import { buildIcs, escapeIcsText, foldLine } from "./ics";
import { createReference, normalizeReference } from "./reference";

describe("normalizeNorwegianPhone", () => {
  it.each([
    ["41234567", "+47 412 34 567"],
    ["412 34 567", "+47 412 34 567"],
    ["+47 412 34 567", "+47 412 34 567"],
    ["0047 91234567", "+47 912 34 567"],
    ["22-35-18-40", "+47 22 35 18 40"],
    ["55123456", "+47 55 12 34 56"],
  ])("accepts %s", (input, expected) => {
    expect(normalizeNorwegianPhone(input)).toBe(expected);
  });

  it.each(["1234567", "123456789", "01234567", "+46 41234567", "4123456a", ""])("rejects %s", (input) => {
    expect(normalizeNorwegianPhone(input)).toBeNull();
  });
});

describe("isValidEmail", () => {
  it("accepts normal addresses, including Norwegian letters", () => {
    expect(isValidEmail("kari.nordmann@example.no")).toBe(true);
    expect(isValidEmail("  bjørn@ærlig.no ")).toBe(true);
  });
  it("rejects malformed addresses", () => {
    for (const bad of ["kari", "kari@", "kari@example", "kari@@example.no", "kari @example.no", "kari..n@example.no"]) {
      expect(isValidEmail(bad)).toBe(false);
    }
  });
});

describe("validateCustomer", () => {
  it("returns normalized values when valid", () => {
    const r = validateCustomer({ name: "  Kari   Nordmann ", phone: "41234567", email: "Kari@Example.no", note: "  " });
    expect(r).toEqual({ ok: true, value: { name: "Kari Nordmann", phone: "+47 412 34 567", email: "kari@example.no" } });
  });

  it("lets the salon leave out email for phone bookings", () => {
    expect(validateCustomer({ name: "Ola", phone: "91234567", email: "" }).ok).toBe(false);
    expect(validateCustomer({ name: "Ola", phone: "91234567", email: "" }, { requireEmail: false }).ok).toBe(true);
  });

  it("returns a Norwegian message per invalid field", () => {
    const r = validateCustomer({ name: "", phone: "123", email: "nope", note: "x".repeat(501) });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.name).toBe("Skriv inn navnet ditt.");
      expect(r.errors.phone).toMatch(/8 siffer/);
      expect(r.errors.email).toMatch(/E-postadressen/);
      expect(r.errors.note).toMatch(/500/);
    }
  });
});

describe("ics", () => {
  const ics = buildIcs({
    uid: "abc@salong",
    start: "2026-11-26T09:00:00.000Z",
    end: "2026-11-26T10:00:00.000Z",
    createdAt: "2026-11-25T08:00:00.000Z",
    summary: "Dameklipp, langt hår hos Ingrid",
    description: "Referanse ABC123",
    location: "Kleivgata 7, 0553 Oslo",
    organizerName: "Salong Lyng",
  });

  it("writes UTC times and CRLF line endings", () => {
    expect(ics).toContain("DTSTART:20261126T090000Z\r\n");
    expect(ics).toContain("DTEND:20261126T100000Z\r\n");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("escapes commas and semicolons", () => {
    expect(escapeIcsText("a,b;c\nd")).toBe("a\\,b\;c\\nd");
    expect(ics).toContain("LOCATION:Kleivgata 7\\, 0553 Oslo");
  });

  it("folds long lines at 75 octets without splitting characters", () => {
    const folded = foldLine("DESCRIPTION:" + "æ".repeat(80));
    const encoder = new TextEncoder();
    for (const line of folded.split("\r\n")) expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe("DESCRIPTION:" + "æ".repeat(80));
  });
});

describe("references", () => {
  it("creates six unambiguous characters", () => {
    const ref = createReference();
    expect(ref).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(normalizeReference(" k7q-3md ")).toBe("K7Q3MD");
  });
});
