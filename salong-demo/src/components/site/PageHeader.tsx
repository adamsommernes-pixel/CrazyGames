import { SectionHead } from "@/components/ui/SectionHead";

interface Props {
  label: string;
  title: string;
  lead: React.ReactNode;
  children?: React.ReactNode;
}

/** Large page title with the lead set off to the right, editorial style. */
export function PageHeader({ label, title, lead, children }: Props) {
  return (
    <header className="page-x pb-14 pt-12 md:pb-20 md:pt-20">
      <div className="page-grid mx-auto max-w-page gap-y-8">
        <SectionHead label={label} className="col-span-12" />
        <h1 className="col-span-12 text-d1 lg:col-span-7">{title}</h1>
        <div className="col-span-12 self-end md:col-span-8 lg:col-span-4 lg:col-start-9">
          <p className="text-lead text-muted">{lead}</p>
          {children}
        </div>
      </div>
    </header>
  );
}
