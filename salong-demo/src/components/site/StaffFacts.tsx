import { t } from "@/i18n";
import { weekdayShort } from "@/lib/format";
import { WEEKDAYS } from "@/lib/hours";
import type { Service, StaffMember } from "@/lib/types";

/** What a staff member does and which days they work. */
export function StaffFacts({ member, services, className }: { member: StaffMember; services: Service[]; className?: string }) {
  const own = services.filter((s) => member.serviceIds.includes(s.id));
  const days = WEEKDAYS.filter((d) => member.schedule[d].length > 0);
  return (
    <dl className={className}>
      <dt className="label pt-1 text-muted">{t.team.does}</dt>
      <dd>{own.map((s) => s.name).join(" · ")}</dd>
      <dt className="label pt-1 text-muted">{t.team.works}</dt>
      <dd className="capitalize">{days.map(weekdayShort).join(", ")}</dd>
    </dl>
  );
}
