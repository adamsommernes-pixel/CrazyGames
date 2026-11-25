"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { t } from "@/i18n";
import { qualifiedStaff, type Slot } from "@/lib/booking/slots";
import { getRepository } from "@/lib/repository/client";
import { useLiveCatalog } from "@/lib/repository/live";
import { SlotUnavailableError } from "@/lib/repository/types";
import type { Customer, LocalDate } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { DateStep } from "./DateStep";
import { DETAILS_FORM_ID, DetailsStep } from "./DetailsStep";
import { ServiceStep } from "./ServiceStep";
import { StaffStep } from "./StaffStep";
import { Summary, summaryLine } from "./Summary";
import { TimeStep } from "./TimeStep";
import { STEPS } from "./types";

interface Props {
  initialServiceIds: string[];
  initialStaffId: string | null;
}

const emptyCustomer: Customer = { name: "", phone: "", email: "", note: "" };

export function BookingFlow({ initialServiceIds, initialStaffId }: Props) {
  const router = useRouter();
  const { services, staff, rules } = useLiveCatalog();
  const top = useRef<HTMLDivElement>(null);

  // A link can combine a service and a person who doesn't do it; then the person is dropped.
  const presetFits =
    !!initialStaffId && qualifiedStaff(staff, initialServiceIds).some((m) => m.id === initialStaffId);
  const initialStaff = initialStaffId && (initialServiceIds.length === 0 || presetFits) ? initialStaffId : null;
  const [presetStaffId, setPresetStaffId] = useState<string | null>(initialStaff);
  const [serviceIds, setServiceIds] = useState<string[]>(initialServiceIds);
  const [staffId, setStaffId] = useState<string | null | undefined>(initialStaff ?? undefined);
  const [date, setDate] = useState<LocalDate | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [customer, setCustomer] = useState<Customer>(emptyCustomer);
  const [step, setStep] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const activeIds = serviceIds.filter((id) => services.some((s) => s.id === id));
  const qualified = qualifiedStaff(staff, activeIds);
  const presetStaff = presetStaffId ? (staff.find((m) => m.id === presetStaffId) ?? null) : null;

  function go(next: number) {
    setStep(next);
    setNotice(null);
    setSubmitError(null);
    top.current?.scrollIntoView({ block: "start" });
  }

  function toggleService(id: string) {
    const next = serviceIds.includes(id) ? serviceIds.filter((s) => s !== id) : [...serviceIds, id];
    setServiceIds(next);
    setDate(null);
    setSlot(null);
    if (staffId && !qualifiedStaff(staff, next).some((m) => m.id === staffId)) setStaffId(undefined);
  }

  function clearPreset() {
    setPresetStaffId(null);
    setStaffId(undefined);
  }

  async function submit(details: Customer) {
    if (!slot) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const booking = await getRepository().createBooking({
        serviceIds: activeIds,
        staffId: staffId ?? null,
        start: slot.start,
        customer: details,
      });
      router.push(`/bestilling/${booking.reference}`);
    } catch (error) {
      setSubmitting(false);
      if (error instanceof SlotUnavailableError) {
        setSlot(null);
        go(3);
        setNotice(t.booking.slotTaken);
      } else {
        setSubmitError(t.common.genericError);
      }
    }
  }

  const canAdvance = [
    activeIds.length > 0,
    staffId === null ? qualified.length > 0 : qualified.some((m) => m.id === staffId),
    date !== null,
    slot !== null,
    true,
  ];

  const isLast = step === STEPS.length - 1;
  const primary = isLast ? (
    <Button type="submit" form={DETAILS_FORM_ID} size="lg" disabled={submitting} className="w-full lg:w-auto" arrow={!submitting}>
      {submitting ? t.booking.confirming : t.booking.confirm}
    </Button>
  ) : (
    <Button type="button" size="lg" onClick={() => go(step + 1)} disabled={!canAdvance[step]} className="w-full lg:w-auto" arrow>
      {t.booking.continue}
    </Button>
  );

  return (
    <div ref={top} className="page-x scroll-mt-0 pb-44 pt-8 md:pt-12 lg:pb-24">
      <div className="mx-auto max-w-page">
        <h1 className="sr-only">{t.booking.title}</h1>
        <Progress step={step} canJump={(i) => i < step} onJump={go} />

        <div className="page-grid mt-10 gap-y-10 md:mt-14">
          <div className="col-span-12 lg:col-span-7">
            {step === 0 && (
              <ServiceStep
                services={services}
                staff={staff}
                selected={activeIds}
                presetStaff={presetStaff}
                onToggle={toggleService}
                onClearPreset={clearPreset}
              />
            )}
            {step === 1 && (
              <StaffStep
                qualified={qualified}
                selected={staffId}
                onSelect={(id) => {
                  if (id !== staffId) {
                    setDate(null);
                    setSlot(null);
                  }
                  setStaffId(id);
                  go(2);
                }}
              />
            )}
            {step === 2 && (
              <DateStep
                serviceIds={activeIds}
                staffId={staffId ?? null}
                selected={date}
                onSelect={(d) => {
                  if (d !== date) setSlot(null);
                  setDate(d);
                  go(3);
                }}
              />
            )}
            {step === 3 && date && (
              <TimeStep
                serviceIds={activeIds}
                staffId={staffId ?? null}
                date={date}
                selected={slot}
                notice={notice}
                onSelect={(s) => {
                  setSlot(s);
                  go(4);
                }}
                onChangeDate={() => go(2)}
              />
            )}
            {step === 4 && (
              <>
                <DetailsStep initial={customer} onChange={setCustomer} onSubmit={submit} />
                <p className="mt-8 max-w-xl text-small text-muted">
                  {t.booking.payInSalon} {t.booking.cancellationPolicy(rules.cancellationHours)}
                </p>
                {submitError && (
                  <p role="alert" className="mt-6 border-l-2 border-accent bg-tint px-4 py-3">
                    {submitError}
                  </p>
                )}
              </>
            )}

            <div className="mt-12 hidden items-center gap-6 border-t border-line pt-6 lg:flex">
              {step > 0 && (
                <button type="button" onClick={() => go(step - 1)} className="link min-h-11 font-medium">
                  ← {t.common.back}
                </button>
              )}
              <div className="ml-auto">{primary}</div>
            </div>
          </div>

          <aside className="col-span-4 col-start-9 hidden lg:block">
            <div className="sticky top-8">
              <Summary
                services={services}
                serviceIds={activeIds}
                staff={staff}
                staffId={staffId}
                date={date}
                slot={slot}
              />
            </div>
          </aside>
        </div>
      </div>

      {/* Sticky action bar on phones and tablets. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink bg-paper lg:hidden">
        <div className="page-x pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <p className="tabular mb-3 flex items-baseline justify-between gap-4 text-small" aria-live="polite">
            <span className="text-muted">
              {t.booking.serviceCount(activeIds.length)}
              {slot && date ? ` · ${t.booking.atTime(slot.label)}` : ""}
            </span>
            <span className="font-medium">{summaryLine(services, activeIds)}</span>
          </p>
          <div className="flex items-stretch gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={() => go(step - 1)}
                className="min-h-14 shrink-0 rounded-ctl border border-line-strong px-5 font-medium"
                aria-label={t.common.back}
              >
                ←
              </button>
            )}
            <div className="flex-1">{primary}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Progress({ step, canJump, onJump }: { step: number; canJump: (i: number) => boolean; onJump: (i: number) => void }) {
  return (
    <nav aria-label={t.booking.title}>
      <p className="label text-muted">
        {t.booking.stepOf(step + 1, STEPS.length)}
        <span className="md:hidden"> · {t.booking.steps[step]}</span>
      </p>
      <ol className="mt-4 grid grid-cols-5 gap-1.5 md:gap-3">
        {t.booking.steps.map((name, i) => {
          const state = i < step ? "done" : i === step ? "current" : "todo";
          const content = (
            <>
              <span
                aria-hidden="true"
                className={cx("block h-0.5 w-full", state === "todo" ? "bg-line" : state === "current" ? "bg-accent" : "bg-ink")}
              />
              <span className={cx("mt-3 hidden text-small md:block", state === "todo" && "text-muted", state === "current" && "font-medium")}>
                <span className="tabular mr-2 text-muted">{i + 1}</span>
                {name}
              </span>
              <span className="sr-only md:hidden">{name}</span>
            </>
          );
          return (
            <li key={name} aria-current={state === "current" ? "step" : undefined}>
              {canJump(i) ? (
                <button type="button" onClick={() => onJump(i)} className="block w-full py-2 text-left hover:[&>span:last-child]:underline">
                  {content}
                </button>
              ) : (
                <span className="block py-2">{content}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
