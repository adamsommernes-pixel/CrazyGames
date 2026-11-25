import { salon } from "@config";
import { t } from "@/i18n";
import { ArrowLink } from "@/components/ui/Button";
import { SectionHead } from "@/components/ui/SectionHead";
import { TeamStrip } from "./TeamStrip";

export function TeamTeaser() {
  return (
    <section className="py-24 md:py-32">
      <div className="page-x">
        <div className="page-grid mx-auto max-w-page gap-y-6">
          <SectionHead number="03" label={t.home.teamLabel} className="col-span-12" />
          <h2 className="col-span-12 text-d2 lg:col-span-6">{salon.team.heading}</h2>
          <div className="col-span-12 self-end lg:col-span-4 lg:col-start-9">
            <p className="text-muted">{salon.team.lead}</p>
            <ArrowLink href="/team" className="mt-5">
              {t.home.meetTeam}
            </ArrowLink>
          </div>
        </div>
      </div>
      <TeamStrip />
    </section>
  );
}
