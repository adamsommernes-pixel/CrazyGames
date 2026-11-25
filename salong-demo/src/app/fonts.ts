/**
 * Font registry. next/font needs static declarations, so every face a salon
 * might pick is declared here and selected by key in salon.config.ts
 * (theme.fonts). Files are self-hosted from src/fonts (subset to Latin-1 + typographic
 * punctuation, which covers æ, ø, å).
 */
import localFont from "next/font/local";

const newsreader = localFont({
  src: [
    { path: "../fonts/newsreader-latin-wght-normal.woff2", style: "normal", weight: "200 800" },
    { path: "../fonts/newsreader-latin-wght-italic.woff2", style: "italic", weight: "200 800" },
  ],
  variable: "--ff-display",
  display: "swap",
  fallback: ["Iowan Old Style", "Georgia", "serif"],
  adjustFontFallback: "Times New Roman",
});

const schibsted = localFont({
  src: [{ path: "../fonts/schibsted-grotesk-latin-wght-normal.woff2", style: "normal", weight: "400 900" }],
  variable: "--ff-text",
  display: "swap",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
  adjustFontFallback: "Arial",
});

export const displayFonts = { newsreader } as const;
export const textFonts = { schibsted } as const;
