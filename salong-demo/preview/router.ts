/**
 * A tiny hash router for the hosted preview. The artifact sandbox only keeps a
 * plain "#name" in the address, so routes map to hashes ("/tjenester" ↔
 * "#tjenester") and query strings (pre-selected service or staff member) stay
 * in memory.
 */
import { useSyncExternalStore } from "react";

export interface Route {
  path: string;
  query: URLSearchParams;
  anchor: string | null;
}

const ROUTES = ["/", "/tjenester", "/team", "/galleri", "/om-oss", "/bestill", "/staff", "/admin"];
const BOOKING_PREFIX = "bestilling-";

export function pathToHash(path: string): string {
  if (path === "/") return "";
  if (path.startsWith("/bestilling/")) return BOOKING_PREFIX + path.slice("/bestilling/".length);
  return path.slice(1);
}

function hashToPath(hash: string): string | null {
  const name = hash.replace(/^#/, "");
  if (!name) return "/";
  if (name.startsWith(BOOKING_PREFIX)) return `/bestilling/${name.slice(BOOKING_PREFIX.length)}`;
  return ROUTES.includes(`/${name}`) ? `/${name}` : null;
}

let current: Route = {
  path: hashToPath(window.location.hash) ?? "/",
  query: new URLSearchParams(),
  anchor: null,
};
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function isInternal(href: string): boolean {
  return href.startsWith("/");
}

export function navigate(href: string) {
  const url = new URL(href, "https://preview.local");
  const path = url.pathname.startsWith("/bestilling/") || ROUTES.includes(url.pathname) ? url.pathname : "/";
  current = { path, query: url.searchParams, anchor: url.hash ? url.hash.slice(1) : null };
  const hash = pathToHash(path);
  if (window.location.hash.replace(/^#/, "") !== hash) window.location.hash = hash;
  emit();
}

window.addEventListener("hashchange", () => {
  const path = hashToPath(window.location.hash);
  // Unknown hashes are in-page anchors (e.g. "#klipp"); the browser scrolls to them.
  if (path && path !== current.path) {
    current = { path, query: new URLSearchParams(), anchor: null };
    emit();
  }
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => current);
}
