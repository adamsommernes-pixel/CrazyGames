import type { Metadata, Viewport } from "next";
import { salon } from "@config";
import { displayFonts, textFonts } from "./fonts";
import { themeStyle } from "@/lib/theme";
import { localBusinessJsonLd } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(salon.siteUrl),
  title: { default: `${salon.name}: ${salon.tagline}`, template: `%s · ${salon.name}` },
  description: salon.description,
  applicationName: salon.name,
  formatDetection: { telephone: false },
  openGraph: { siteName: salon.name, locale: "nb_NO", type: "website" },
};

export const viewport: Viewport = {
  themeColor: salon.theme.colors.paper,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const display = displayFonts[salon.theme.fonts.display];
  const text = textFonts[salon.theme.fonts.text];
  return (
    <html lang="nb" className={`${display.variable} ${text.variable}`} style={themeStyle(salon.theme)}>
      <body className="bg-paper text-ink min-h-dvh">
        {children}
        <script
          type="application/ld+json"
          // JSON-LD is generated from our own config, not user input.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd(salon)).replace(/</g, "\\u003c") }}
        />
      </body>
    </html>
  );
}
