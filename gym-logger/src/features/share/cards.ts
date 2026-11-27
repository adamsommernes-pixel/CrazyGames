import { createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { STATIC_BODY_RATIO, StaticBody } from '../../components/BodyMap';
import { TierEmblem, tierAccent } from '../../components/TierBadge';
import { currentAccent } from '../../lib/theme';
import type { MuscleGroup } from '../../db/types';
import { num } from '../../lib/format';
import { t } from '../../i18n';
import type { ShareData } from './shareData';

// Delekort tegnet med Canvas 2D: fire nivåer fra enkle tall til hele økta, i story- og postformat.

export type CardLevel = 1 | 2 | 3 | 4;
export type CardFormat = 'story' | 'post';

export const CARD_LEVELS: { level: CardLevel; readonly name: string; readonly text: string }[] = [
  { level: 1, get name() { return t('Enkel', 'Basic'); }, get text() { return t('Tid, sets, reps og volum', 'Time, sets, reps and volume'); } },
  { level: 2, get name() { return t('Tall', 'Stats'); }, get text() { return t('Tyngste løft, rekorder og nivå', 'Heaviest lift, records and level'); } },
  { level: 3, get name() { return t('Høyde\u00ADpunkter', 'High\u00ADlights'); }, get text() { return t('Muskler trent, rekorder og toppsett', 'Muscles trained, records and top sets'); } },
  { level: 4, get name() { return t('Hele økta', 'Full workout'); }, get text() { return t('Hver øvelse med alle sets', 'Every exercise with all sets'); } },
];

export const CARD_SIZE: Record<CardFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  post: { w: 1080, h: 1350 },
};

const C = {
  bg: '#07090a',
  ink: '#f2f5f3',
  muted: '#9aa59f',
  faint: '#5f6964',
  raised: '#111513',
  line: '#232a26',
};
const PAD = 84;

/** Brukerens appfarge, satt ved hver tegning (renderCard). */
let A = currentAccent();
const DISPLAY = '"Space Grotesk", "Inter Variable", system-ui, sans-serif';
const SANS = '"Inter Variable", system-ui, sans-serif';

type Ctx = CanvasRenderingContext2D;

const font = (ctx: Ctx, weight: number, size: number, family = DISPLAY) => {
  ctx.font = `${weight} ${size}px ${family}`;
};

function draw(ctx: Ctx, s: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left') {
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
}

function ellipsize(ctx: Ctx, s: string, maxW: number): string {
  if (ctx.measureText(s).width <= maxW) return s;
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(s.slice(0, mid) + '…').width <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return s.slice(0, lo).trimEnd() + '…';
}

function wrap(ctx: Ctx, s: string, maxW: number, maxLines: number): string[] {
  const words = s.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= maxW || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = ellipsize(ctx, lines.slice(maxLines - 1).join(' '), maxW);
    return kept;
  }
  return lines.map((l) => ellipsize(ctx, l, maxW));
}

function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function panel(ctx: Ctx, x: number, y: number, w: number, h: number, r = 36) {
  rrect(ctx, x, y, w, h, r);
  ctx.fillStyle = 'rgba(17, 21, 19, 0.92)';
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function bar(ctx: Ctx, x: number, y: number, w: number, h: number, p: number, color: string) {
  rrect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = '#1b211e';
  ctx.fill();
  if (p > 0) {
    rrect(ctx, x, y, Math.max(h, w * Math.min(1, p)), h, h / 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

// ---------- Bilder fra React-komponenter (emblem og kroppsfigur) ----------

const VARS: Record<string, string> = {
  'var(--color-bg)': C.bg,
  'var(--color-raised)': '#1b211e',
  'var(--color-surface)': '#121614',
  'var(--color-line)': '#2a322e',
  'var(--color-ink)': C.ink,
};

async function svgImage(el: ReactElement): Promise<HTMLImageElement> {
  const div = document.createElement('div');
  const root = createRoot(div);
  flushSync(() => root.render(el));
  let svg = div.innerHTML;
  root.unmount();
  for (const [k, v] of Object.entries(VARS)) svg = svg.split(k).join(v);
  if (!svg.includes('xmlns=')) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  return img;
}

let fontsReady: Promise<unknown> | null = null;
function loadFonts() {
  fontsReady ??= Promise.all(
    ['700 80px "Space Grotesk"', '500 40px "Space Grotesk"', '400 40px "Inter Variable"', '600 40px "Inter Variable"'].map((f) => document.fonts?.load(f)),
  ).catch(() => undefined);
  return fontsReady;
}

// ---------- Felles ramme ----------

function background(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, w, h);
  // Bare et svakt skjær av brukerens farge øverst.
  const g = ctx.createLinearGradient(0, 0, 0, h * 0.45);
  g.addColorStop(0, A.soft);
  g.addColorStop(1, C.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

let logo: HTMLImageElement | null = null;
async function loadLogo() {
  if (logo) return;
  try {
    const img = new Image();
    img.src = `${import.meta.env.BASE_URL}favicon.svg`;
    await img.decode();
    logo = img;
  } catch {
    logo = null;
  }
}

function header(ctx: Ctx, w: number, date: string): number {
  const y = PAD + 34;
  // Logoen (samme som app-ikonet) og navnet.
  if (logo) ctx.drawImage(logo, PAD, y - 38, 48, 48);
  font(ctx, 700, 32);
  draw(ctx, 'Repgrade', PAD + 64, y, C.ink);
  font(ctx, 500, 28, SANS);
  draw(ctx, ellipsize(ctx, date, w / 2 - PAD), w - PAD, y, C.muted, 'right');
  return y + 40;
}

function footer(ctx: Ctx, w: number, h: number, data: ShareData, emblem: HTMLImageElement | null, withTier: boolean): number {
  const y = h - PAD;
  if (withTier && data.tier && emblem) {
    const size = 96;
    ctx.drawImage(emblem, PAD, y - size, size, size);
    font(ctx, 500, 26, SANS);
    draw(ctx, t('Styrkenivå', 'Strength level'), PAD + size + 24, y - 58, C.faint);
    font(ctx, 700, 44);
    draw(ctx, data.tier.name, PAD + size + 24, y - 12, tierAccent(data.tier.index, A.strong));
  } else {
    font(ctx, 500, 26, SANS);
    draw(ctx, t('Logget med Repgrade', 'Logged with Repgrade'), PAD, y - 12, C.faint);
  }
  font(ctx, 600, 26, SANS);
  draw(ctx, 'repgrade', w - PAD, y - 12, A.accent, 'right');
  return 120;
}

/** Overskrift: «ØKT FULLFØRT» og navnet på økta. Returnerer y under blokken. */
function title(ctx: Ctx, w: number, y: number, name: string, size: number, maxLines: number): number {
  font(ctx, 600, 30, SANS);
  draw(ctx, t('Økt fullført', 'Workout complete'), PAD, y + 28, C.muted);
  font(ctx, 700, size);
  const lines = wrap(ctx, name, w - PAD * 2, maxLines);
  let ty = y + 28 + size * 1.15;
  for (const l of lines) {
    draw(ctx, l, PAD, ty, C.ink);
    ty += size * 1.05;
  }
  return ty - size * 1.05 + size * 0.3;
}

function titleHeight(ctx: Ctx, w: number, name: string, size: number, maxLines: number) {
  font(ctx, 700, size);
  const n = wrap(ctx, name, w - PAD * 2, maxLines).length;
  return 28 + size * 1.15 + (n - 1) * size * 1.05 + size * 0.3;
}

function statTile(ctx: Ctx, x: number, y: number, w: number, h: number, value: string, label: string, valueSize: number) {
  panel(ctx, x, y, w, h);
  font(ctx, 700, valueSize);
  let size = valueSize;
  while (ctx.measureText(value).width > w - 56 && size > 36) {
    size -= 4;
    font(ctx, 700, size);
  }
  draw(ctx, value, x + 32, y + h / 2 + size * 0.28, C.ink);
  font(ctx, 600, Math.round(valueSize * 0.27), SANS);
  draw(ctx, label, x + 32, y + h - 30, C.muted);
}

// ---------- De fire kortene ----------

function basic(ctx: Ctx, w: number, h: number, data: ShareData, top: number, bottom: number) {
  const story = h > 1500;
  const tSize = story ? 112 : 92;
  const tileH = story ? 300 : 230;
  const gap = 28;
  const blockH = titleHeight(ctx, w, data.name, tSize, 2) + 70 + tileH * 2 + gap;
  let y = top + Math.max(0, (bottom - top - blockH) / 2);
  y = title(ctx, w, y, data.name, tSize, 2) + 70;
  const tw = (w - PAD * 2 - gap) / 2;
  const vs = story ? 120 : 96;
  statTile(ctx, PAD, y, tw, tileH, data.duration, t('Tid', 'Time'), vs);
  statTile(ctx, PAD + tw + gap, y, tw, tileH, String(data.sets), 'Sets', vs);
  statTile(ctx, PAD, y + tileH + gap, tw, tileH, String(data.reps), 'Reps', vs);
  statTile(ctx, PAD + tw + gap, y + tileH + gap, tw, tileH, data.volume, `${t('Volum', 'Volume')} (${data.unit})`, vs);
}

function statRow(ctx: Ctx, w: number, y: number, label: string, value: string, color = C.ink, size = 40) {
  font(ctx, 500, Math.round(size * 0.85), SANS);
  draw(ctx, label, PAD, y, C.muted);
  const lw = ctx.measureText(label).width;
  font(ctx, 700, size);
  draw(ctx, ellipsize(ctx, value, w - PAD * 2 - lw - 40), w - PAD, y, color, 'right');
}

function stats(ctx: Ctx, w: number, h: number, data: ShareData, top: number, bottom: number) {
  const story = h > 1500;
  const tSize = story ? 96 : 80;
  const tileH = story ? 210 : 170;
  const rowH = story ? 92 : 74;
  const rows: [string, string, string?][] = [
    [t('Øvelser', 'Exercises'), String(data.exercises.length)],
    ['Reps', String(data.reps)],
  ];
  if (data.heaviest) rows.push([t('Tyngste løft', 'Heaviest lift'), `${data.heaviest.exercise} · ${data.heaviest.text}`]);
  rows.push([t('Rekorder', 'Records'), data.prs.length ? `★ ${data.prs.length}` : '0', data.prs.length ? A.strong : undefined]);
  if (data.volumeDiff !== null) rows.push([t('Volum mot forrige', 'Volume vs last time'), `${data.volumeDiff >= 0 ? '▲' : '▼'} ${num(Math.abs(data.volumeDiff), 0)} %`, data.volumeDiff >= 0 ? A.strong : C.muted]);

  const blockH = titleHeight(ctx, w, data.name, tSize, 2) + 56 + tileH + 50 + rows.length * rowH;
  let y = top + Math.max(0, (bottom - top - blockH) / 2);
  y = title(ctx, w, y, data.name, tSize, 2) + 56;
  const gap = 22;
  const tw = (w - PAD * 2 - gap * 2) / 3;
  statTile(ctx, PAD, y, tw, tileH, data.duration, t('Tid', 'Time'), story ? 72 : 60);
  statTile(ctx, PAD + tw + gap, y, tw, tileH, String(data.sets), 'Sets', story ? 72 : 60);
  statTile(ctx, PAD + (tw + gap) * 2, y, tw, tileH, data.volume, data.unit, story ? 72 : 60);
  y += tileH + 50;
  for (const [label, value, color] of rows) {
    y += rowH * 0.62;
    statRow(ctx, w, y, label, value, color, story ? 44 : 38);
    y += rowH * 0.38;
    ctx.fillStyle = C.line;
    ctx.fillRect(PAD, y, w - PAD * 2, 2);
  }
  if (data.tier) {
    const accent = tierAccent(data.tier.index, A.strong);
    y += story ? 60 : 36;
    font(ctx, 500, 30, SANS);
    draw(ctx, `${num(data.tier.score, 1)} ${t('poeng', 'points')}`, PAD, y + 4, C.muted);
    bar(ctx, PAD + 230, y - 14, w - PAD * 2 - 230, 16, data.tier.progress, accent);
  }
}

function bodyBlock(ctx: Ctx, body: HTMLImageElement, x: number, y: number, maxW: number, maxH: number) {
  const ratio = STATIC_BODY_RATIO;
  let bw = maxW;
  let bh = bw * ratio;
  if (bh > maxH) {
    bh = maxH;
    bw = bh / ratio;
  }
  const bx = x + (maxW - bw) / 2;
  ctx.drawImage(body, bx, y, bw, bh);
  return bh;
}

function strip(ctx: Ctx, data: ShareData, y: number, size: number) {
  font(ctx, 500, size);
  draw(ctx, `${data.duration}  ·  ${data.sets} ${data.sets === 1 ? 'set' : 'sets'}  ·  ${data.volume} ${data.unit}`, PAD, y, C.muted);
}

function highlights(ctx: Ctx, w: number, h: number, data: ShareData, top: number, bottom: number, body: HTMLImageElement) {
  const story = h > 1500;
  const tSize = story ? 84 : 68;
  let y = title(ctx, w, top, data.name, tSize, story ? 2 : 1);
  strip(ctx, data, y + 30, story ? 38 : 32);
  y += story ? 70 : 56;

  const prs = data.prs.slice(0, story ? 3 : 3);
  const tops = data.exercises.filter((e) => e.top).slice(0, story ? 5 : 4);
  const lineH = story ? 64 : 52;
  // Story: figur over listene. Post: figur til venstre, listene til høyre.
  const listX = story ? PAD : PAD + (w - PAD * 2) * 0.5 + 20;
  const listW = story ? w - PAD * 2 : (w - PAD * 2) * 0.5 - 20;
  const listsH = (prs.length ? 50 + prs.length * lineH + 30 : 0) + (tops.length ? 50 + tops.length * lineH : 0);
  if (story) {
    const bodyH = bodyBlock(ctx, body, PAD, y, w - PAD * 2, Math.max(260, bottom - y - listsH - 30));
    y += bodyH + 30;
  } else {
    const bw = (w - PAD * 2) * 0.5 + 20;
    const est = Math.min(bw * (234 / 250), bottom - y - 10);
    y += Math.max(0, (bottom - y - Math.max(est, listsH)) / 2);
    const bodyH = bodyBlock(ctx, body, PAD - 20, y + 10, bw, bottom - y - 10);
    y = y + Math.max(0, (bodyH - listsH) / 2);
  }
  const fs = story ? 38 : 30;
  const line = (left: string, right: string, color: string, star = false) => {
    y += lineH;
    font(ctx, 700, fs + 2);
    const rightW = ctx.measureText(right).width;
    draw(ctx, right, listX + listW, y, color, 'right');
    font(ctx, 600, fs, SANS);
    draw(ctx, ellipsize(ctx, (star ? '★ ' : '') + left, listW - rightW - 24), listX, y, star ? A.strong : C.ink);
  };
  const heading = (s: string) => {
    font(ctx, 600, 28, SANS);
    draw(ctx, s, listX, y + 10, C.muted);
  };
  if (prs.length) {
    y += 20;
    heading(t('Rekorder', 'Records'));
    for (const p of prs) line(p.exercise, p.text, A.strong, true);
    y += 30;
  }
  if (tops.length) {
    y += 20;
    heading(t('Toppsett', 'Top sets'));
    for (const e of tops) line(e.name, e.top!, C.ink);
  }
}

interface Placed {
  name: string;
  rows: { text: string; pr: boolean; x: number }[][];
  h: number;
}

function layoutExercises(ctx: Ctx, data: ShareData, colW: number, f: number) {
  const lineH = f * 1.5;
  const nameH = f * 1.45;
  const gap = f * 0.8;
  const sepW = (() => {
    font(ctx, 500, f);
    return ctx.measureText('   ').width;
  })();
  return data.exercises.map((e): Placed => {
    font(ctx, 500, f);
    const rows: Placed['rows'] = [[]];
    let x = 0;
    for (const s of e.sets) {
      const label = s.pr ? `★ ${s.text}` : s.text;
      const tw = ctx.measureText(label).width;
      if (x > 0 && x + tw > colW) {
        rows.push([]);
        x = 0;
      }
      rows[rows.length - 1].push({ text: label, pr: s.pr, x });
      x += tw + sepW;
    }
    return { name: e.name, rows, h: nameH + rows.length * lineH + gap };
  });
}

function full(ctx: Ctx, w: number, h: number, data: ShareData, top: number, bottom: number) {
  const story = h > 1500;
  const tSize = story ? 80 : 64;
  let y = title(ctx, w, top, data.name, tSize, 1);
  strip(ctx, data, y + 30, story ? 36 : 30);
  y += story ? 80 : 62;
  const totalsH = 70;
  const avail = bottom - y - totalsH;

  // Største skrift som får plass, først i én kolonne, så i to.
  let chosen: { f: number; cols: number; placed: Placed[]; shown: number } | null = null;
  for (const cols of [1, 2]) {
    const colW = (w - PAD * 2 - (cols - 1) * 48) / cols;
    for (let f = story ? 48 : 40; f >= 22; f -= 2) {
      const placed = layoutExercises(ctx, data, colW, f);
      let col = 0;
      let used = 0;
      let shown = 0;
      for (const p of placed) {
        if (used + p.h > avail) {
          col++;
          used = 0;
        }
        if (col >= cols) break;
        used += p.h;
        shown++;
      }
      if (shown === placed.length) {
        chosen = { f, cols, placed, shown };
        break;
      }
      if (cols === 2 && f === 22) chosen = { f, cols, placed, shown };
    }
    if (chosen && chosen.shown === chosen.placed.length) break;
  }
  const { f, cols, placed, shown } = chosen!;
  const colW = (w - PAD * 2 - (cols - 1) * 48) / cols;
  let col = 0;
  let cy = y;
  for (let i = 0; i < shown; i++) {
    const p = placed[i];
    if (cy - y + p.h > avail) {
      col++;
      cy = y;
    }
    const x = PAD + col * (colW + 48);
    font(ctx, 700, Math.round(f * 1.05));
    draw(ctx, ellipsize(ctx, p.name, colW), x, cy + f * 1.05, C.ink);
    cy += f * 1.45;
    for (const row of p.rows) {
      cy += f * 1.5;
      font(ctx, 500, f);
      for (const tok of row) draw(ctx, tok.text, x + tok.x, cy - f * 0.35, tok.pr ? A.strong : C.muted);
    }
    cy += f * 0.8;
  }
  if (shown < placed.length) {
    font(ctx, 600, 30, SANS);
    draw(ctx, t(`+ ${placed.length - shown} øvelser til`, `+ ${placed.length - shown} more exercises`), PAD, bottom - totalsH - 10, C.muted);
  }
  ctx.fillStyle = C.line;
  ctx.fillRect(PAD, bottom - totalsH + 4, w - PAD * 2, 2);
  font(ctx, 600, 30, SANS);
  draw(ctx, t('Totalt', 'Total'), PAD, bottom - 10, C.muted);
  font(ctx, 700, 36);
  draw(ctx, `${data.sets} sets · ${data.reps} reps · ${data.volume} ${data.unit}`, w - PAD, bottom - 10, C.ink, 'right');
}

/** Tegner ett kort og returnerer canvasen. */
export async function renderCard(data: ShareData, level: CardLevel, format: CardFormat, canvas = document.createElement('canvas')): Promise<HTMLCanvasElement> {
  await loadFonts();
  const { w, h } = CARD_SIZE[format];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  A = currentAccent();
  await loadLogo();
  const emblem = data.tier ? await svgImage(createElement(TierEmblem, { index: data.tier.index, size: 200, palette: { accent: A.accent, on: A.on } })) : null;
  const body =
    level === 3 ? await svgImage(createElement(StaticBody, { levelOf: (g: MuscleGroup) => data.muscles[g] ?? 0, accent: A.accent })) : null;

  background(ctx, w, h);
  const top = header(ctx, w, data.date) + 60;
  const footH = footer(ctx, w, h, data, emblem, level >= 2);
  const bottom = h - PAD - footH - 20;
  if (level === 1) basic(ctx, w, h, data, top, bottom);
  else if (level === 2) stats(ctx, w, h, data, top, bottom);
  else if (level === 3) highlights(ctx, w, h, data, top, bottom, body!);
  else full(ctx, w, h, data, top, bottom);
  return canvas;
}

export function cardBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/png'));
}
