"use client";

import Link from "next/link";
import { useState } from "react";
import { salon } from "@config";
import { t } from "@/i18n";
import { buildIcs } from "@/lib/booking/ics";
import { canCustomerCancel, isLateCancellation } from "@/lib/booking/policy";
import { formatDateLongYear, formatDuration, formatPrice, formatTime, telHref } from "@/lib/format";
import { getRepository } from "@/lib/repository/client";
import { useLiveCatalog, useNow } from "@/lib/repository/live";
import { useRepoQuery } from "@/lib/repository/query";
import type { Booking, SalonProfile, Service } from "@/lib/types";
import { Button, ButtonLink } from "@/components/ui/Button";

function downloadIcs(booking: Booking, services: Service[], staffName: string, profile: SalonProfile) {
  const names = booking.serviceIds.map((id) => services.find((s) => s.id === id)?.name ?? id).join(", ");
  const { address } = profile.contact;
  const ics = buildIcs({
    uid: `${booking.id}@${new URL(salon.siteUrl).hostname}`,
    start: booking.start,
    end: booking.end,
    createdAt: booking.createdAt,
    summary: `${names} hos ${staffName}, ${profile.name}`,
    description: `Referanse: ${booking.reference}\nAvbestill eller se timen: ${salon.siteUrl}/bestilling/${booking.reference}\nTelefon: ${profile.contact.phone}`,
    location: `${profile.name}, ${address.street}, ${address.postalCode} ${address.city}`,
    organizerName: profile.name,
    url: `${salon.siteUrl}/bestilling/${booking.reference}`,
    cancelled: booking.status === "cancelled",
  });
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${salon.shortName.toLowerCase()}-${booking.reference}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function Confirmation({ reference }: { reference: string }) {
  const { profile, rules } = useLiveCatalog();
  const staff = useRepoQuery("confirmation-staff", (repo) => repo.listStaff({ includeArchived: true }));
  const allServices = useRepoQuery("confirmation-services", (repo) => repo.listServices({ includeInactive: true, includeArchived: true }));
  const booking = useRepoQuery(`booking:${reference}`, (repo) => repo.getBooking(reference));
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const now = useNow();

  if (booking === undefined || allServices === undefined || staff === undefined || now === null) {
    return (
      <div className="page-x py-24" aria-busy="true">
        <p className="mx-auto max-w-page text-muted">{t.common.loading}</p>
      </div>
    );
  }

  if (booking === null) {
    return (
      <div className="page-x py-20 md:py-28">
        <div className="mx-auto max-w-page">
          <h1 className="text-d2">{t.confirmation.notFound}</h1>
          <ButtonLink href="/bestill" size="lg" arrow className="mt-10">
            {t.confirmation.bookAnother}
          </ButtonLink>
        </div>
      </div>
    );
  }

  const services = booking.serviceIds
    .map((id) => allServices.find((s) => s.id === id))
    .filter((s): s is Service => !!s);
  const person = staff.find((m) => m.id === booking.staffId);
  const staffName = person?.name ?? "";
  const cancelled = booking.status === "cancelled";
  const canCancel = canCustomerCancel(booking, now);
  const late = isLateCancellation(booking, now, rules);
  const duration = (Date.parse(booking.end) - Date.parse(booking.start)) / 60_000;
  const total = services.reduce((sum, s) => sum + s.priceNok, 0);

  async function cancel() {
    setBusy(true);
    await getRepository().cancelBooking(booking!.reference);
    setBusy(false);
    setConfirming(false);
  }

  return (
    <div className="page-x pb-24 pt-10 md:pt-16">
      <div className="page-grid mx-auto max-w-page gap-y-12">
        <div className="col-span-12 lg:col-span-7">
          <p className="label flex items-center gap-4 text-muted">
            <span aria-hidden="true" className="h-px w-10 bg-accent" />
            {t.confirmation.reference} <span className="tabular text-ink">{booking.reference}</span>
          </p>
          <h1 className="mt-6 text-d1" aria-live="polite">
            {cancelled ? t.confirmation.cancelledTitle : t.confirmation.title}
          </h1>
          {!cancelled && <p className="mt-6 text-lead">{t.confirmation.lead(booking.customer.name)}</p>}

          <dl className="mt-12 border-t-2 border-ink">
            {[
              [t.panel.date, formatDateLongYear(booking.start)],
              [t.panel.time, `${formatTime(booking.start)}–${formatTime(booking.end)} (${formatDuration(duration)})`],
              [t.booking.steps[0], services.map((s) => s.name).join(", ")],
              [t.booking.steps[1], staffName],
              [t.booking.total, formatPrice(total, services.some((s) => s.priceFrom))],
              [t.common.address, `${profile.contact.address.street}, ${profile.contact.address.postalCode} ${profile.contact.address.city}`],
            ].map(([k, v]) => (
              <div key={k} className="grid gap-1 border-b border-line py-4 sm:grid-cols-[10rem_1fr]">
                <dt className="label pt-1 text-muted">{k}</dt>
                <dd className={cancelled ? "text-muted line-through decoration-1" : "text-body"}>{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            {!cancelled &&
              // The hosted preview (preview/) runs in a sandbox that blocks file downloads;
              // the inline check lets the bundler drop the download code there.
              (process.env.NEXT_PUBLIC_PREVIEW === "artifact" ? (
                <p className="max-w-sm text-small text-muted">{t.confirmation.calendarInPreview}</p>
              ) : (
                <Button type="button" size="lg" onClick={() => downloadIcs(booking, allServices, staffName, profile)}>
                  {t.confirmation.addToCalendar}
                  <span aria-hidden="true" className="label">.ics</span>
                </Button>
              ))}
            <Link href="/bestill" className="link font-medium">
              {t.confirmation.bookAnother}
            </Link>
          </div>
        </div>

        <aside className="col-span-12 lg:col-span-4 lg:col-start-9">
          <div className="border-t-2 border-ink pt-5 lg:mt-40">
            <h2 className="label text-muted">{t.confirmation.whatNext}</h2>
            <ul className="mt-4 grid gap-3 text-small">
              <li>{t.confirmation.arriveEarly}</li>
              <li>{profile.contact.directions}</li>
              <li>{t.booking.payInSalon}</li>
            </ul>
            <p className="mt-6 border-l-2 border-line-strong pl-4 text-small text-muted">{t.confirmation.demoNote}</p>

            {!cancelled && (
              <div className="mt-10 border-t border-line pt-6">
                {canCancel ? (
                  confirming ? (
                    <div role="group" aria-labelledby="cancel-q">
                      <p id="cancel-q" className="font-medium">{t.confirmation.cancelQuestion}</p>
                      {late && (
                        <p className="mt-2 text-small text-muted">
                          {t.confirmation.lateWarning(rules.cancellationHours)}
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Button type="button" variant="outline" onClick={cancel} disabled={busy}>
                          {t.confirmation.confirmCancel}
                        </Button>
                        <Button type="button" onClick={() => setConfirming(false)} autoFocus>
                          {t.confirmation.keep}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirming(true)} className="link min-h-11 font-medium">
                      {t.confirmation.cancel}
                    </button>
                  )
                ) : (
                  <p className="text-small">
                    {t.confirmation.started}{" "}
                    <a className="link" href={telHref(profile.contact.phone)}>{profile.contact.phone}</a>.
                  </p>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
