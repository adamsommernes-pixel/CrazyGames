/**
 * Builds the hosted preview: one self-contained HTML page (preview/dist/index.html)
 * with inlined CSS, fonts and JavaScript, for sandboxes that only serve a single
 * page. The real deployment target is the Next.js app; this is for showing the demo.
 */
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const r = (p) => join(root, p);

// Read the salon config by bundling it (Node cannot import TypeScript with path aliases).
const configBundle = await build({ entryPoints: [r("salon.config.ts")], bundle: true, write: false, format: "esm", platform: "node", tsconfig: r("tsconfig.json") });
const { salon } = await import(`data:text/javascript;base64,${Buffer.from(configBundle.outputFiles[0].text).toString("base64")}`);

// CSS: the app's Tailwind stylesheet, plus the theme variables and fonts that
// the Next.js layout and next/font would otherwise provide.
const globals = await readFile(r("src/app/globals.css"), "utf8");
const { css } = await postcss([tailwind({ base: root, optimize: { minify: true } })]).process(globals, {
  from: r("src/app/globals.css"),
});
const font = async (file) => `data:font/woff2;base64,${(await readFile(r(`src/fonts/${file}`))).toString("base64")}`;
const { colors, radius } = salon.theme;
const fontCss = `
@font-face{font-family:"Newsreader";src:url(${await font("newsreader-latin-wght-normal.woff2")}) format("woff2");font-weight:200 800;font-style:normal;font-display:swap}
@font-face{font-family:"Newsreader";src:url(${await font("newsreader-latin-wght-italic.woff2")}) format("woff2");font-weight:200 800;font-style:italic;font-display:swap}
@font-face{font-family:"Schibsted Grotesk";src:url(${await font("schibsted-grotesk-latin-wght-normal.woff2")}) format("woff2");font-weight:400 900;font-style:normal;font-display:swap}
:root{--ff-display:"Newsreader";--ff-text:"Schibsted Grotesk";--salon-paper:${colors.paper};--salon-stone:${colors.stone};--salon-ink:${colors.ink};--salon-muted:${colors.muted};--salon-accent:${colors.accent};--salon-radius:${radius};color-scheme:light}
body{background:${colors.paper}}`;

const js = await build({
  entryPoints: [r("preview/App.tsx")],
  bundle: true,
  write: false,
  minify: true,
  format: "iife",
  target: ["es2022"],
  jsx: "automatic",
  tsconfig: r("tsconfig.json"),
  alias: {
    "next/link": r("preview/shims/link.tsx"),
    "next/navigation": r("preview/shims/navigation.ts"),
    "next/image": r("preview/shims/image.tsx"),
  },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_PREVIEW": '"artifact"',
  },
  logLevel: "warning",
});
const script = js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

const html = `<title>${salon.name}</title>
<meta name="description" content="${salon.description}">
<style>${fontCss}${css}</style>
<div id="app"></div>
<script>${script}</script>
`;

await mkdir(r("preview/dist"), { recursive: true });
await writeFile(r("preview/dist/index.html"), html);
console.log(`preview/dist/index.html: ${(html.length / 1024).toFixed(0)} KB`);
