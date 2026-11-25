import Image from "next/image";
import { t } from "@/i18n";
import type { AspectRatio, ImageRef } from "@/lib/types";
import { cx } from "./cx";

const TONES = ["bg-stone", "bg-tint", "bg-[color-mix(in_oklab,var(--salon-stone)_70%,var(--salon-muted))]"];

function toneFor(label: string) {
  let h = 0;
  for (const c of label) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

interface Props {
  image: ImageRef;
  aspect: AspectRatio;
  /** Passed to next/image; describe the rendered width at each breakpoint. */
  sizes: string;
  priority?: boolean;
  className?: string;
}

/**
 * A photo when `image.src` is set, otherwise a tonal placeholder with crop
 * marks and a small label. Both reserve the same aspect ratio, so swapping in
 * real photos later never shifts the layout.
 */
export function ImageSlot({ image, aspect, sizes, priority, className }: Props) {
  return (
    <div className={cx("relative overflow-hidden", className)} style={{ aspectRatio: aspect }}>
      {image.src ? (
        <Image src={image.src} alt={image.alt} fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <div role="img" aria-label={image.alt} className={cx("absolute inset-0", toneFor(image.label))}>
          <span aria-hidden="true" className="absolute left-3 top-3 h-3 w-3 border-l border-t border-line-strong" />
          <span aria-hidden="true" className="absolute right-3 top-3 h-3 w-3 border-r border-t border-line-strong" />
          <span aria-hidden="true" className="absolute bottom-3 left-3 h-3 w-3 border-b border-l border-line-strong" />
          <span aria-hidden="true" className="absolute bottom-3 right-3 h-3 w-3 border-b border-r border-line-strong" />
          <span aria-hidden="true" className="label absolute bottom-5 left-6 text-ink/75">
            {t.common.imagePrefix}: {image.label}
          </span>
        </div>
      )}
    </div>
  );
}
