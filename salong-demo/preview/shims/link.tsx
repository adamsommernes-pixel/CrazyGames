import type { AnchorHTMLAttributes } from "react";
import { isInternal, navigate, pathToHash } from "../router";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string };

/** next/link for the preview: internal links become hash routes. */
export default function Link({ href, onClick, ...rest }: Props) {
  if (!isInternal(href)) return <a href={href} onClick={onClick} {...rest} />;
  const path = href.split(/[?#]/)[0] ?? "/";
  return (
    <a
      href={`#${pathToHash(path)}`}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        navigate(href);
      }}
      {...rest}
    />
  );
}
