import { salon } from "@config";
import { t } from "@/i18n";
import { pageMetadata } from "@/lib/seo";
import { PageHeader } from "@/components/site/PageHeader";
import { TeamList } from "@/components/site/TeamList";

export const metadata = pageMetadata(salon, {
  title: t.team.title,
  description: `Møt frisørene og bryn- og vippeterapeuten hos ${salon.name}, og bestill time hos den du vil.`,
  path: "/team",
});

export default function TeamPage() {
  return (
    <>
      <PageHeader label={t.nav.team} title={t.team.title} lead={salon.team.pageLead} />
      <TeamList />
    </>
  );
}
