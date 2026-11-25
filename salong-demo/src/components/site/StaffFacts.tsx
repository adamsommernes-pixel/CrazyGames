"use client";

import { t } from "@/i18n";
import { weekdayShort } from "@/lib/format";
import { WEEKDAYS } from "@/lib/hours";
import { useLiveCatalog } from "@/lib/repository/live";

/** What a staff member does and which days they work, kept in step with admin edits. */
export function StaffFacts({ staffId, className }: { staffId: string; className?: string }) {
  const { services, staff } = useLiveCatalog();
  const member = staff.find((m) => m.id === staffId);
  if (!member) return null;
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
