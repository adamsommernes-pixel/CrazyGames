import type { Metadata } from "next";
import { t } from "@/i18n";
import { Confirmation } from "@/components/booking/Confirmation";

export const metadata: Metadata = {
  title: t.confirmation.title,
  robots: { index: false, follow: false },
};

export default async function BookingPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  return <Confirmation reference={ref} />;
}
