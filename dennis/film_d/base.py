# -*- coding: utf-8 -*-
"""Gemensamt för Dennis-filmen: tidslinje, tagningsramverk, foton (2.5D), videokort, piktogram."""
import functools
import json
import math
import os
import sys

import cv2
import numpy as np

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALAND = os.path.join(os.path.dirname(HERE), "aland")
if ALAND not in sys.path:
    sys.path.insert(0, ALAND)

from film.common import (AMBER, H, INK, INK_DIM, W, blank, clamp01, draw_text,  # noqa: E402
                         ease_io, ease_out, fade, lin, over, over_color, poly_lines,
                         reveal_text, smooth, text_width)

DB = os.path.join(HERE, "build")
MEDIA = os.path.join(DB, "media")
SRC = os.path.join(HERE, "media")

TL = json.load(open(os.path.join(DB, "timeline.json"), encoding="utf-8"))
LINES = TL["lines"]
TOTAL = TL["total"]

WARM = np.array([0.95, 0.72, 0.42], np.float32)
PAPER_TINT = (0.034, 0.036, 0.04)


def S(lid, k=0):
    return LINES[lid]["sents"][k][0]


def E(lid, k=-1):
    return LINES[lid]["sents"][k][1]


# --------------------------------------------------------------------------
# Tagningsramverk (samma idé som Åland-filmen)
# --------------------------------------------------------------------------
class Shot:
    def __init__(self, name, t0, t1, fn, fin=0.0, fout=0.0):
        self.name, self.t0, self.t1, self.fn, self.fin, self.fout = name, t0, t1, fn, fin, fout

    def render(self, t):
        img = self.fn(t, t - self.t0, self)
        k = 1.0
        if self.fin > 0:
            k *= smooth(lin(t, self.t0, self.t0 + self.fin))
        if self.fout > 0:
            k *= 1 - smooth(lin(t, self.t1 - self.fout, self.t1))
        if k < 1:
            img = img * k
        return img


SHOTS = []
OVERLAYS = []


def shot(name, t0, t1, fin=0.0, fout=0.0):
    def deco(fn):
        SHOTS.append(Shot(name, t0, t1, fn, fin, fout))
        return fn
    return deco


def overlay(t0, t1):
    def deco(fn):
        OVERLAYS.append((t0, t1, fn))
        return fn
    return deco


def compose(t):
    act = [s for s in SHOTS if s.t0 <= t < s.t1]
    if not act:
        img = blank((0, 0, 0))
    elif len(act) == 1:
        img = act[0].render(t)
    else:
        a, b = act[0], act[-1]
        x = smooth(lin(t, b.t0, a.t1))
        ia = a.render(t) if x < 0.999 else None
        ib = b.render(t) if x > 0.001 else None
        img = ib if ia is None else ia if ib is None else ia * (1 - x) + ib * x
    for t0, t1, fn in OVERLAYS:
        if t0 <= t < t1:
            img = fn(img, t)
    return img


def chapter(num, title, t0, dur=4.4):
    @overlay(t0, t0 + dur)
    def _(img, t):
        a = fade(t, t0, t0 + 1.0, t0 + dur - 1.1, t0 + dur)
        x, y = 120, 150
        draw_text(img, num, x, y, name="serif_it", size=44, weight=400, alpha=a * 0.9, color=AMBER, shadow=0.8)
        nw = text_width(num, "serif_it", 44, 0, 400)
        reveal_text(img, title.upper(), x + nw + 26, y - 4, t - t0 - 0.25, dur=1.0, stagger=0.035,
                    name="sans_m", size=22, tracking=0.38, alpha=a, color=INK, rise=6, shadow=0.8)
        return img


def caption(img, t, t0, t1, text, sub=None, x=120, y=H - 250, size=26):
    """Nedre vänster bildtext med kort bärnstenslinje."""
    a = fade(t, t0, t0 + 0.9, t1 - 0.8, t1)
    if a <= 0:
        return img
    rise = 8 * (1 - ease_out(lin(t, t0, t0 + 1.2)))
    ln = 46 * ease_out(lin(t, t0, t0 + 1.0))
    m = np.zeros((H, W), np.float32)
    poly_lines(m, [np.array([(x, y - size - 14), (x + ln, y - size - 14)])], 1)
    over_color(img, AMBER, m * a * 0.9)
    draw_text(img, text, x, y + rise, name="sans_m", size=size, tracking=0.12, alpha=a, color=INK, shadow=0.9)
    if sub:
        draw_text(img, sub, x, y + size + 12 + rise, name="serif_it", size=int(size * 1.15), weight=400,
                  tracking=0.02, alpha=a * 0.85, color=INK, shadow=0.9)
    return img


# --------------------------------------------------------------------------
# Foton med 2.5D-parallax
# --------------------------------------------------------------------------
@functools.lru_cache(maxsize=8)
def photo(name):
    fg = cv2.cvtColor(cv2.imread(os.path.join(SRC, f"{name}.jpg")), cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    bg = cv2.cvtColor(cv2.imread(os.path.join(MEDIA, f"{name}_plate.jpg")), cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    m = cv2.imread(os.path.join(MEDIA, f"{name}_mask.png"), cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255.0
    m = cv2.GaussianBlur(m, (0, 0), 1.2)
    # mjukt skärpedjup på bakgrunden
    bgb = cv2.GaussianBlur(bg, (0, 0), 2.2)
    return fg, bgb, m


def _cover_matrix(shape, cx, cy, zoom, dx=0.0, dy=0.0):
    """Källa->skärm: bildpunkt (cx,cy) (andelar) hamnar i mitten; zoom 1 = täcker skärmen."""
    h, w = shape[:2]
    s = max(W / w, H / h) * zoom
    return np.float32([[s, 0, W / 2 + dx - cx * w * s], [0, s, H / 2 + dy - cy * h * s]])


def photo_frame(name, x, c0, c1, par=(0.0, 0.0, 0.0), look=None):
    """x 0..1 genom tagningen. c = (cx, cy, zoom) i bildandelar.
    par = (extra zoom för motivet, px-förskjutning x, px-förskjutning y) vid x=1 (bakgrunden rör sig mindre)."""
    fg, bg, m = photo(name)
    e = ease_io(x, 1.6) if look is None else look(x)
    cx = c0[0] + (c1[0] - c0[0]) * e
    cy = c0[1] + (c1[1] - c0[1]) * e
    z = math.exp(math.log(c0[2]) + (math.log(c1[2]) - math.log(c0[2])) * e)
    pz, px, py = par
    u = x - 0.5
    Mb = _cover_matrix(fg.shape, cx, cy, z * (1 + pz * 0.25 * u), -px * 0.3 * u, -py * 0.3 * u)
    Mf = _cover_matrix(fg.shape, cx, cy, z * (1 + pz * u), px * u, py * u)
    b = cv2.warpAffine(bg, Mb, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    f = cv2.warpAffine(fg, Mf, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    a = cv2.warpAffine(m, Mf, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)[..., None]
    return b * (1 - a) + f * a


def photo_to_screen(name, x, c0, c1, px_py, par=(0, 0, 0), look=None):
    """Var hamnar en bildpunkt (andelar) på skärmen (för förgrundslagret)."""
    fg, _, _ = photo(name)
    e = ease_io(x, 1.6) if look is None else look(x)
    cx = c0[0] + (c1[0] - c0[0]) * e
    cy = c0[1] + (c1[1] - c0[1]) * e
    z = math.exp(math.log(c0[2]) + (math.log(c1[2]) - math.log(c0[2])) * e)
    u = x - 0.5
    M = _cover_matrix(fg.shape, cx, cy, z * (1 + par[0] * u), par[1] * u, par[2] * u)
    h, w = fg.shape[:2]
    p = np.array([px_py[0] * w, px_py[1] * h, 1.0])
    return M @ p


def film_tone(img, warmth=0.03, sat=0.9, gain=0.95):
    luma = img @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    x = luma[..., None] + (img - luma[..., None]) * sat
    x = x * gain
    x += np.array([warmth, warmth * 0.3, -warmth * 0.6], np.float32) * luma[..., None]
    return x


def print_card(img, src, cx, cy, w, alpha=1.0, rot=0.0, border=18):
    """Foto som papperskopia med vit kant och skugga."""
    h = int(w * src.shape[0] / src.shape[1])
    ph = cv2.resize(src, (w, h), interpolation=cv2.INTER_AREA if w < src.shape[1] else cv2.INTER_CUBIC)
    cw, ch = w + 2 * border, h + 2 * border
    card = np.empty((ch, cw, 3), np.float32)
    card[:] = (0.86, 0.84, 0.79)
    card[border:border + h, border:border + w] = ph
    a = np.ones((ch, cw), np.float32)
    M = cv2.getRotationMatrix2D((cw / 2, ch / 2), rot, 1.0)
    M[0, 2] += cx - cw / 2
    M[1, 2] += cy - ch / 2
    cs = cv2.warpAffine(card, M, (W, H), flags=cv2.INTER_LINEAR)
    am = cv2.warpAffine(a, M, (W, H), flags=cv2.INTER_LINEAR)
    sh = cv2.GaussianBlur(am, (0, 0), 22)
    over_color(img, (0, 0, 0), np.roll(sh, (18, 12), (0, 1)) * 0.75 * alpha)
    img += (cs - img) * (am * alpha)[..., None]
    return img


# --------------------------------------------------------------------------
# Videoklipp (stående) i kort med suddig utfyllnad
# --------------------------------------------------------------------------
@functools.lru_cache(maxsize=None)
def clip_count(name):
    return len([f for f in os.listdir(os.path.join(MEDIA, name)) if f.endswith(".jpg")])


@functools.lru_cache(maxsize=64)
def clip_frame(name, i):
    n = clip_count(name)
    i = max(1, min(n, i + 1))
    im = cv2.imread(os.path.join(MEDIA, name, f"{i:04d}.jpg"))
    return cv2.cvtColor(im, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0


def clip_card(t_local, name, scale=1.0, cx=W / 2, cy=H / 2, bg_alpha=1.0, card_h=990, tone=True):
    fr = clip_frame(name, int(t_local * 25))
    if tone:
        fr = film_tone(fr, warmth=0.02, sat=0.92, gain=0.97)
    img = np.zeros((H, W, 3), np.float32)
    if bg_alpha > 0:
        small = cv2.resize(fr, (96, 170), interpolation=cv2.INTER_AREA)
        small = cv2.GaussianBlur(small, (0, 0), 5)
        big = cv2.resize(small, (W, int(W * 170 / 96)), interpolation=cv2.INTER_LINEAR)
        oy = (big.shape[0] - H) // 2
        img += big[oy:oy + H] * 0.32 * bg_alpha
    ch = int(card_h * scale)
    cw = int(ch * fr.shape[1] / fr.shape[0])
    if cw < 4:
        return img
    ph = cv2.resize(fr, (cw, ch), interpolation=cv2.INTER_AREA)
    x0, y0 = int(cx - cw / 2), int(cy - ch / 2)
    m = np.zeros((H, W), np.float32)
    cv2.rectangle(m, (x0, y0), (x0 + cw, y0 + ch), 1.0, -1)
    sh = cv2.GaussianBlur(m, (0, 0), 26)
    over_color(img, (0, 0, 0), np.roll(sh, (16, 0), (0, 1)) * 0.8)
    over(img, ph, np.ones((ch, cw), np.float32), x0, y0)
    return img


# --------------------------------------------------------------------------
# Piktogram: människor, tassar
# --------------------------------------------------------------------------
SH = 4
SC = 1 << SH


def person(mask, x, y, s=1.0, value=1.0):
    """Stiliserad människa (huvud + axlar), fötterna vid y."""
    hr = 7.5 * s
    cv2.circle(mask, (int(x * SC), int((y - 30 * s) * SC)), int(hr * SC), value, -1, cv2.LINE_AA, SH)
    cv2.ellipse(mask, (int(x * SC), int((y - 2 * s) * SC)), (int(12 * s * SC), int(18 * s * SC)), 0, 180, 360,
                value, -1, cv2.LINE_AA, SH)
    return mask


def paw(mask, x, y, s=1.0, ang=0.0, value=1.0):
    """Tassavtryck: trampdyna + fyra tår. ang i grader (0 = pekar uppåt)."""
    c, sn = math.cos(math.radians(ang)), math.sin(math.radians(ang))

    def P(dx, dy):
        return x + (dx * c - dy * sn) * s, y + (dx * sn + dy * c) * s
    px, py = P(0, 6)
    cv2.ellipse(mask, (int(px * SC), int(py * SC)), (int(11 * s * SC), int(9 * s * SC)), ang, 0, 360, value, -1, cv2.LINE_AA, SH)
    for dx, dy, r in ((-12, -8, 4.6), (-4.5, -15, 4.8), (4.5, -15, 4.8), (12, -8, 4.6)):
        qx, qy = P(dx, dy)
        cv2.ellipse(mask, (int(qx * SC), int(qy * SC)), (int(r * s * SC), int(r * 1.25 * s * SC)), ang + dx * 1.5, 0, 360,
                    value, -1, cv2.LINE_AA, SH)
    return mask


def glow_layer(img, mask, color, alpha=1.0, glow=0.6, radius=6):
    over_color(img, color, np.clip(mask, 0, 1) * alpha)
    if glow > 0:
        g = cv2.GaussianBlur(mask, (0, 0), radius)
        img += g[..., None] * np.asarray(color, np.float32) * glow * alpha
    return img
