import { t } from "@/i18n";
import type { Slot } from "@/lib/booking/slots";
import { totalDurationMin, totalPriceNok } from "@/lib/booking/slots";
import { formatDuration, formatLocalDateLong, formatPrice } from "@/lib/format";
import type { Service, StaffMember } from "@/lib/types";

interface Props {
  services: Service[];
  serviceIds: string[];
  staff: StaffMember[];
  staffId: string | null | undefined;
  date: string | null;
  slot: Slot | null;
}

export function summaryLine(services: Service[], serviceIds: string[]): string {
  if (serviceIds.length === 0) return t.booking.noServices;
  const anyFrom = serviceIds.some((id) => services.find((s) => s.id === id)?.priceFrom);
  return `${formatDuration(totalDurationMin(services, serviceIds))} · ${formatPrice(totalPriceNok(services, serviceIds), anyFrom)}`;
}

/** The running summary of the booking, shown beside the steps on larger screens. */
export function Summary({ services, serviceIds, staff, staffId, date, slot }: Props) {
  const chosen = serviceIds.map((id) => services.find((s) => s.id === id)).filter((s): s is Service => !!s);
  const person = staffId ? staff.find((m) => m.id === staffId)?.name : staffId === null ? t.booking.noPreference : null;
  return (
    <section aria-label={t.booking.summary} className="border-t-2 border-ink pt-5">
      <h2 className="label text-muted">{t.booking.summary}</h2>
      {chosen.length === 0 ? (
        <p className="mt-4 text-muted">{t.booking.summaryEmpty}</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {chosen.map((s) => (
            <li key={s.id} className="flex items-baseline justify-between gap-4">
              <span className="font-display text-d4 leading-tight">{s.name}</span>
              <span className="tabular shrink-0 text-small">{formatPrice(s.priceNok, s.priceFrom)}</span>
            </li>
          ))}
        </ul>
      )}
      <dl className="mt-6 grid grid-cols-[6rem_1fr] gap-y-2 border-t border-line pt-4 text-small">
        <dt className="text-muted">{t.booking.steps[1]}</dt>
        <dd>{person ?? "–"}</dd>
        <dt className="text-muted">{t.booking.steps[2]}</dt>
        <dd>{date ? formatLocalDateLong(date) : "–"}</dd>
        <dt className="text-muted">{t.booking.steps[3]}</dt>
        <dd className="tabular">{slot ? t.booking.atTime(slot.label) : "–"}</dd>
        <dt className="text-muted">{t.booking.total}</dt>
        <dd className="tabular font-medium">{chosen.length ? summaryLine(services, serviceIds) : "–"}</dd>
      </dl>
      <p className="mt-6 text-small text-muted">{t.booking.payInSalon}</p>
    </section>
  );
}
