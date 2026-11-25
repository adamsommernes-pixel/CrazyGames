"use client";

import Link from "next/link";
import { t } from "@/i18n";
import { formatDuration, formatPrice } from "@/lib/format";
import { useLiveCatalog } from "@/lib/repository/live";
import type { Service } from "@/lib/types";
import { cx } from "@/components/ui/cx";

interface Props {
  /** Limit to one category. */
  categoryId?: string;
  /** Only services flagged `popular` in the config. */
  popularOnly?: boolean;
  /** Show the description under each service. */
  withDescription?: boolean;
  className?: string;
}

/**
 * Menu-style price list: name, dotted leader, price; duration below.
 * Rendered on the server from config, then updated from the repository so
 * admin edits to prices and visibility show up here too.
 */
export function PriceList({ categoryId, popularOnly, withDescription = true, className }: Props) {
  const { services } = useLiveCatalog();
  const list = services.filter(
    (s) => (!categoryId || s.categoryId === categoryId) && (!popularOnly || s.popular),
  );
  return (
    <ul className={cx("border-t border-line", className)}>
      {list.map((s) => (
        <PriceRow key={s.id} service={s} withDescription={withDescription} />
      ))}
    </ul>
  );
}

function PriceRow({ service, withDescription }: { service: Service; withDescription: boolean }) {
  return (
    <li className="group relative border-b border-line py-5">
      <div className="flex items-baseline gap-3">
        <h3 className="font-display text-d4 leading-tight">{service.name}</h3>
        <span aria-hidden="true" className="leader" />
        <p className="tabular shrink-0 text-body font-medium">{formatPrice(service.priceNok, service.priceFrom)}</p>
      </div>
      <div className="mt-1.5 flex items-start justify-between gap-6">
        <p className="max-w-measure text-small text-muted">
          <span className="tabular">{formatDuration(service.durationMin)}</span>
          {withDescription && service.description && <span> · {service.description}</span>}
        </p>
        <Link
          href={`/bestill?tjeneste=${service.id}`}
          className="label -my-3 inline-flex min-h-11 shrink-0 items-center gap-2 py-3 text-ink link"
          aria-label={t.services.bookService(service.name)}
        >
          {t.services.book}
          <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
        </Link>
      </div>
    </li>
  );
}
