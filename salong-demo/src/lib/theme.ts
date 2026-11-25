import type { ThemeTokens } from "@/lib/types";

/** CSS custom properties for the theme, written once on <html>. */
export function themeStyle(theme: ThemeTokens): Record<string, string> {
  return {
    "--salon-paper": theme.colors.paper,
    "--salon-stone": theme.colors.stone,
    "--salon-ink": theme.colors.ink,
    "--salon-muted": theme.colors.muted,
    "--salon-accent": theme.colors.accent,
    "--salon-radius": theme.radius,
  };
}
