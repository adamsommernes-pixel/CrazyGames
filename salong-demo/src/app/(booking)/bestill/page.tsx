import { salon } from "@config";
import { t } from "@/i18n";
import { pageMetadata } from "@/lib/seo";
import { BookingFlow } from "@/components/booking/BookingFlow";

export const metadata = pageMetadata(salon, {
  title: t.booking.title,
  description: `Bestill time hos ${salon.name} på nett. Velg behandling, frisør og et tidspunkt som passer.`,
  path: "/bestill",
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BookPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const serviceIds = (first(params.tjeneste) ?? "")
    .split(",")
    .filter((id) => salon.services.some((s) => s.id === id));
  const staffParam = first(params.frisor);
  const staffId = salon.staff.some((m) => m.id === staffParam) ? staffParam! : null;
  return <BookingFlow key={`${serviceIds.join()}-${staffId}`} initialServiceIds={serviceIds} initialStaffId={staffId} />;
}
