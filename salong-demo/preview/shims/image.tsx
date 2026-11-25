interface Props {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
}

/** next/image for the preview: a plain image filling its slot. */
export default function Image({ src, alt, className }: Props) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}
