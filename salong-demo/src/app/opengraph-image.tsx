import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { salon } from "@config";

export const alt = `${salon.name}: ${salon.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Typographic share image in the salon's own colours and faces. */
export default async function OpengraphImage() {
  const [display, text] = await Promise.all([
    readFile(join(process.cwd(), "src/fonts/og/newsreader-400.ttf")),
    readFile(join(process.cwd(), "src/fonts/og/schibsted-500.ttf")),
  ]);
  const { colors } = salon.theme;
  const { address } = salon.contact;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: colors.paper,
          color: colors.ink,
          padding: "64px 72px",
          fontFamily: "Text",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 22, letterSpacing: 3, textTransform: "uppercase", color: colors.muted }}>
          <div style={{ width: 56, height: 2, background: colors.accent }} />
          {salon.hero.eyebrow}
        </div>
        <div style={{ fontFamily: "Display", fontSize: 96, lineHeight: 1, letterSpacing: -2, maxWidth: 950 }}>
          {salon.hero.heading}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: `1px solid ${colors.muted}`, paddingTop: 28, fontSize: 26 }}>
          <span style={{ fontFamily: "Display", fontSize: 44 }}>{salon.name}</span>
          <span>
            {address.street}, {address.city} · {salon.contact.phone}
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Display", data: display, weight: 400, style: "normal" },
        { name: "Text", data: text, weight: 500, style: "normal" },
      ],
    },
  );
}
