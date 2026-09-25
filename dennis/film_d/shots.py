# -*- coding: utf-8 -*-
"""Alla tagningar i "Dennis", synkade mot berättarrösten (build/timeline.json)."""
import functools
import math
import re

import cv2
import numpy as np

from . import art
from .base import (DB, E, LINES, S, SHOTS, TOTAL, WARM, caption, chapter,  # noqa: F401
                   clip_card, clip_count, compose, film_tone, glow_layer, overlay,
                   paw, person, photo, photo_frame, photo_to_screen, print_card, shot)
from film import fx, geo, sat
from film import drawings as D
from film.common import (AMBER, H, INK, INK_DIM, RED, W, arc_between, blank,
                         catmull, clamp01, dashed, dot, draw_text, ease_in, ease_io,
                         ease_out, fade, lin, mix, over, over_color, partial_polyline,
                         point_at, poly_lines, reveal_text, ring, smooth, smoother,
                         text_width)
from film.geo import Camera, project, zoom_path

PAPER = (0.034, 0.036, 0.04)
CLIP_FIDDLE = 249.2
CLIP_SHH = 327.35


def Wt(lid, word, occ=0):
    """Uppskattad tid då ordet börjar (teckenproportionellt inom meningen)."""
    from narration import display
    text = display(LINES[lid]["text"])
    sents = [p for p in re.split(r"(?<=[.!?])\s+", text.strip()) if p]
    n = 0
    for k, s in enumerate(sents):
        start = 0
        while True:
            i = s.find(word, start)
            if i < 0:
                break
            if n == occ:
                a, b = LINES[lid]["sents"][k]
                return a + (b - a) * (i / max(1, len(s)))
            n += 1
            start = i + 1
    raise KeyError(f"{word} not in {lid}")


def utm(lon, lat):
    return project("utm", lon, lat)


ALAND_C = utm(20.02, 60.19)
FIDDLE_LL = (19.9419, 60.0993)
FIDDLE = utm(*FIDDLE_LL)


@functools.lru_cache(maxsize=None)
def L_wide():
    return geo.MapLayers("utm", (-4, 50, 48, 73), detail="50m")


@functools.lru_cache(maxsize=None)
def L_det():
    return geo.MapLayers("utm", (2, 53, 36, 72), detail="10m")


def layers(mpp):
    return L_wide() if mpp > 650 else L_det()


@functools.lru_cache(maxsize=None)
def E_wide():
    return geo.MapLayers("eur", (-8, 50, 46, 74), detail="50m")


@functools.lru_cache(maxsize=None)
def E_det():
    return geo.MapLayers("eur", (2, 53, 36, 72), detail="10m")


def elayers(mpp):
    return E_wide() if mpp > 650 else E_det()


def eur(lon, lat):
    return project("eur", lon, lat)


def fill_mask(img, m, color, alpha):
    img += (np.asarray(color, np.float32) - img) * (m * alpha)[..., None]
    return img


def outline_glow(img, lm, color, alpha):
    e = cv2.morphologyEx((lm > 0.5).astype(np.uint8), cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8)).astype(np.float32)
    g = cv2.GaussianBlur(e, (0, 0), 6)
    img += g[..., None] * np.asarray(color, np.float32) * alpha * 0.9
    over_color(img, color, e * alpha * 0.9)
    return img


def _valid_mask(cam, raw):
    A = np.vstack([cam.affine_from_world(), [0, 0, 1]])
    Ai = np.linalg.inv(A)
    yy, xx = np.mgrid[0:H:4, 0:W:4].astype(np.float64)
    wx = Ai[0, 0] * xx + Ai[0, 1] * yy + Ai[0, 2]
    wy = Ai[1, 0] * xx + Ai[1, 1] * yy + Ai[1, 2]
    inside = ((wx > sat.X0 + 200) & (wx < sat.X1 - 200) & (wy > sat.Y0 + 200) & (wy < sat.Y1 - 200)).astype(np.float32)
    inside = cv2.resize(inside, (W, H), interpolation=cv2.INTER_LINEAR)
    nod = np.abs(raw - np.array([7, 12, 18], np.float32) / 255).max(2) < 3.5 / 255
    m = inside * (1 - nod.astype(np.float32))
    small = cv2.resize(m, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
    small = cv2.erode(small, np.ones((9, 9), np.uint8))
    small = cv2.GaussianBlur(small, (0, 0), 14)
    return np.clip(cv2.resize(small, (W, H), interpolation=cv2.INTER_LINEAR), 0, 1)


def sat_img(cam, s=0.85, gain=1.0, interp=cv2.INTER_LINEAR):
    raw = sat.render(cam, interp=interp)
    img = sat.look(raw, sat=s, gain=gain)
    if cam.mpp > 25:
        vm = _valid_mask(cam, raw)
        if vm.min() < 0.999:
            under, _ = geo.render_map(cam, layers(cam.mpp), border_alpha=0.0, coast_alpha=0.3)
            luma = img @ np.array([0.2126, 0.7152, 0.0722], np.float32)
            sel = (vm > 0.98) & (luma < 0.09)
            if sel.sum() > 500:
                target = np.median(img[sel], axis=0)
                cur = np.median(under[(vm < 0.02)], axis=0) if (vm < 0.02).sum() > 500 else target
                under = under * (target / np.maximum(cur, 1e-3))
            img = under + (img - under) * vm[..., None]
    return img


def cloud_layer(img, t, alpha, seed=3, speed=(22, 6)):
    if alpha <= 0:
        return img
    c = fx.smoke(t, speed=speed, seed=seed, density=1.0)
    c = cv2.GaussianBlur(c, (0, 0), 6)
    sh = np.roll(c, (40, 60), (0, 1))
    img *= (1 - sh * 0.35 * alpha)[..., None]
    img += (np.array([0.75, 0.78, 0.8], np.float32) - img) * (c * 0.55 * alpha)[..., None]
    return img


@functools.lru_cache(maxsize=4)
def paper(seed=2, tint=PAPER):
    return D.ink_paper(tint=tint, seed=seed)


def pin(img, x, y, label, t, t0, t1=1e9, side="r", sub=None, color=AMBER, size=30):
    a = fade(t, t0, t0 + 0.6, t1 - 0.6, t1)
    if a <= 0:
        return img
    e = ease_out(lin(t, t0, t0 + 0.8))
    pr = (t - t0) % 2.2 / 2.2
    ring(img, x, y, 6 + 26 * ease_out(pr), color, alpha=a * (1 - pr) * 0.7, width=1.4)
    dot(img, x, y, 4.2, color, alpha=a, glow=0.5)
    ring(img, x, y, 9, color, alpha=a * 0.8, width=1.2)
    sg = 1 if side == "r" else -1
    m = np.zeros((H, W), np.float32)
    p1 = (x + 12 * sg, y)
    p2 = (x + 70 * sg * e, y - 34 * e)
    poly_lines(m, [np.array([p1, p2, (p2[0] + 30 * sg * e, p2[1])])], 1)
    over_color(img, INK, m * a * 0.8)
    anc = "l" if side == "r" else "r"
    lx = p2[0] + 40 * sg
    draw_text(img, label, lx, p2[1] + 10, name="sans_m", size=size, tracking=0.08, alpha=a * e, anchor=anc, shadow=0.8)
    if sub:
        draw_text(img, sub, lx, p2[1] + 44, name="serif_it", size=28, weight=400, alpha=a * e * 0.9,
                  anchor=anc, shadow=0.8)
    return img


# ==========================================================================
# KALL ÖPPNING
# ==========================================================================
@functools.lru_cache(maxsize=1)
def stars():
    rng = np.random.default_rng(3)
    img = np.zeros((H, W, 3), np.float32)
    m = np.zeros((H, W), np.float32)
    for _ in range(900):
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        v = rng.uniform(0.15, 1.0) ** 3
        cv2.circle(m, (int(x * 16), int(y * 16)), int(rng.uniform(0.5, 1.4) * 16), v, -1, cv2.LINE_AA, 4)
    img += m[..., None] * np.array([0.75, 0.8, 0.9], np.float32) * 0.8
    return img


@shot("globe", 0.0, 7.4, fin=2.0)
def _(t, lt, sh):
    x = ease_io(lin(t, 0, 7.4), 2.2)
    lon0 = mix(-2, 20.5, x)
    lat0 = mix(38, 60, x)
    rad = 360 * math.exp(math.log(1500 / 360) * ease_in(lin(t, 0.0, 7.4), 1.7))
    col, a, glow = fx.globe(lon0, lat0, rad, sun=(-0.35, 0.45, 0.8))
    img = stars() * (1 - a[..., None]) * (1 - smooth(lin(t, 4, 7))) + col * a[..., None] + glow
    # Åland-markör på globen
    p, vis = fx.globe_project(np.array([20.0]), np.array([60.2]), lon0, lat0, rad)
    ma = smooth(lin(t, 2.2, 3.4))
    if vis[0] and ma > 0:
        dot(img, p[0, 0], p[0, 1], 3.5, AMBER, alpha=ma, glow=0.7)
        pr = (t % 2.0) / 2.0
        ring(img, p[0, 0], p[0, 1], 6 + 24 * ease_out(pr), AMBER, alpha=ma * (1 - pr) * 0.8, width=1.3)
    return img


@shot("map_in", 6.2, 13.4)
def _(t, lt, sh):
    x = ease_io(lin(t, 6.2, 13.4), 2.0)
    a = Camera(*utm(19.5, 60.0), 1350)
    b = Camera(*ALAND_C, 150)
    cam = zoom_path(a, b, x)
    Ls = layers(cam.mpp)
    img, _ = geo.render_map(cam, Ls, coast_alpha=0.5, border_alpha=0.35)
    la = 1 - smooth(lin(t, 10.8, 12.2))
    geo.label(img, cam, utm(19.4, 57.9), "Östersjön", "sea", alpha=smooth(lin(t, 6.6, 7.8)) * la)
    ts, tf = Wt("o1", "Sverige"), Wt("o1", "Finland")
    geo.label(img, cam, utm(15.8, 62.3), "Sverige", "country", alpha=smooth(lin(t, min(ts, 6.8), 7.6)) * la)
    geo.label(img, cam, utm(26.0, 62.5), "Finland", "country", alpha=smooth(lin(t, min(tf, 7.0), 7.9)) * la)
    ha = smooth(lin(t, 7.2, 8.6))
    if ha > 0:
        am = geo.polys_mask(cam, Ls.country("ALD"))
        fill_mask(img, am, AMBER, 0.32 * ha)
        outline_glow(img, am, AMBER, ha * 0.8)
        p = cam.to_screen(ALAND_C)
        draw_text(img, "Åland", p[0] + 70, p[1] - 50, name="serif_it", size=38, weight=500,
                  alpha=ha * (1 - smooth(lin(t, 11.4, 12.6))), color=INK, shadow=0.7)
    return img


@functools.lru_cache(maxsize=1)
def people_dots():
    """Slumpade punkter på land (Åland) + tätare kring Mariehamn. Världskoord (UTM)."""
    rng = np.random.default_rng(12)
    lm = np.asarray(sat.level(3, "land"))
    r = sat.RES[3]
    xa, ya = utm(19.45, 59.95)
    xb, yb = utm(20.6, 60.46)
    c0, c1 = int((xa - sat.X0) / r), int((xb - sat.X0) / r)
    r0, r1 = int((sat.Y1 - yb) / r), int((sat.Y1 - ya) / r)
    sub = lm[r0:r1, c0:c1]
    ys, xs = np.nonzero(sub > 140)
    pick = rng.choice(len(xs), 900, replace=False)
    wx = sat.X0 + (c0 + xs[pick] + rng.random(900)) * r
    wy = sat.Y1 - (r0 + ys[pick] + rng.random(900)) * r
    pts = list(zip(wx, wy))
    for _ in range(420):
        ang, rr = rng.uniform(0, 2 * math.pi), abs(rng.normal(0, 1100))
        pts.append((FIDDLE[0] + rr * math.cos(ang), FIDDLE[1] + rr * math.sin(ang) * 0.8))
    pts = np.array(pts)
    delay = rng.uniform(0, 2.6, len(pts))
    tw = rng.uniform(0, 6.28, len(pts))
    return pts, delay, tw


@shot("sat_dive", 12.4, 21.6)
def _(t, lt, sh):
    k0, k1 = 12.4, S("o3", 1)
    a = Camera(*ALAND_C, 150)
    b = Camera(*utm(19.99, 60.17), 62)
    c = Camera(*FIDDLE, 16)
    if t < k1:
        cam = zoom_path(a, b, ease_io(lin(t, k0, k1), 1.8))
    else:
        cam = zoom_path(b, c, ease_io(lin(t, k1, 21.6), 2.2))
    img = sat_img(cam, s=0.75, gain=0.9)
    img = cloud_layer(img, t, 0.85 * (1 - smooth(lin(t, 12.6, 14.8))))
    # människor som ljuspunkter
    t_on = S("o3") + 0.1
    if t > t_on:
        pts, delay, tw = people_dots()
        dim = 1 - smooth(lin(t, S("o3") + 2.2, S("o3") + 3.4)) * 0.35
        others = 1 - smooth(lin(t, S("o3", 1) + 0.3, S("o3", 1) + 1.8))
        img *= dim
        sp = cam.to_screen(pts)
        m = np.zeros((H, W), np.float32)
        for i, (x, y) in enumerate(sp):
            if not (-10 < x < W + 10 and -10 < y < H + 10):
                continue
            v = smooth(lin(t, t_on + delay[i], t_on + delay[i] + 0.6)) * (0.75 + 0.25 * math.sin(t * 2.2 + tw[i]))
            v *= others
            if v > 0.01:
                cv2.circle(m, (int(x * 16), int(y * 16)), 26, v, -1, cv2.LINE_AA, 4)
        glow_layer(img, m, WARM, alpha=0.95, glow=1.4, radius=5)
        one = smooth(lin(t, S("o3", 1) + 0.2, S("o3", 1) + 1.2))
        if one > 0:
            p = cam.to_screen(FIDDLE)
            dot(img, p[0], p[1], 3.0 + 2 * one, WARM, alpha=one, glow=1.0)
            pr = (t % 2.2) / 2.2
            ring(img, p[0], p[1], 8 + 30 * ease_out(pr), WARM, alpha=one * (1 - pr) * 0.8, width=1.4)
    ca = fade(t, 13.4, 14.4, S("o3") - 0.2, S("o3") + 0.6)
    if ca > 0:
        draw_text(img, "ÅLAND", 120, H - 290, name="sans_m", size=22, tracking=0.4, alpha=ca * 0.9, color=INK, shadow=0.8)
        draw_text(img, "60°12′ N   20°01′ E", 120, H - 250, name="mono", size=24, tracking=0.1, alpha=ca * 0.8,
                  color=INK, shadow=0.8)
    return img


# --- Titel: porträttet --------------------------------------------------
@functools.lru_cache(maxsize=1)
def portrait_edge():
    xx = np.linspace(0, 1, W, dtype=np.float32)
    return np.clip((xx - 0.36) / 0.2, 0, 1)[None, :, None]


def portrait_frame(t, t0, t1, cx=1330, push=0.06):
    fg, _, _ = photo("portrait")
    x = lin(t, t0, t1)
    s = 1.12 * H / fg.shape[0] * (1 + push * ease_io(x, 1.3))
    M = np.float32([[s, 0, cx - fg.shape[1] * s / 2], [0, s, H / 2 + 30 - fg.shape[0] * s * 0.5]])
    img = cv2.warpAffine(fg, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    img = img * portrait_edge() * 0.92
    return img


def title_block(img, t, t0, big="DENNIS ERIKSSON", sub="Ett porträtt", x=150, y=H / 2 + 10, a_out=1.0):
    a = smooth(lin(t, t0, t0 + 1.4)) * a_out
    if a <= 0:
        return img
    e = ease_out(lin(t, t0, t0 + 2.2))
    reveal_text(img, big, x, y, t - t0, dur=1.2, stagger=0.05, name="serif", size=86, weight=500,
                tracking=0.14, alpha=a, color=INK, rise=10)
    m = np.zeros((H, W), np.float32)
    ln = 120 * ease_out(lin(t, t0 + 0.8, t0 + 2.2))
    poly_lines(m, [np.array([(x + 2, y + 34), (x + 2 + ln, y + 34)])], 1)
    over_color(img, AMBER, m * a)
    if sub:
        a2 = smooth(lin(t, t0 + 1.1, t0 + 2.3)) * a_out
        draw_text(img, sub, x, y + 88, name="serif_it", size=40, weight=400, tracking=0.04,
                  alpha=a2 * 0.85, color=INK)
    _ = e
    return img


@shot("title", S("o3", 1) + 0.9, S("a1") + 0.7, fin=1.2)
def _(t, lt, sh):
    img = portrait_frame(t, sh.t0, sh.t1)
    title_block(img, t, E("o3") + 0.5)
    return img


# ==========================================================================
# I. ÅLÄNNINGEN
# ==========================================================================
chapter("I", "Ålänningen", S("a1") + 0.4)


@shot("steps", S("a1") - 0.3, S("a3") + 0.5)
def _(t, lt, sh):
    x = lin(t, sh.t0, sh.t1)
    img = photo_frame("steps", x, (0.5, 0.47, 1.0), (0.49, 0.37, 1.32), par=(0.05, 0, 10))
    img = film_tone(img, 0.02, 0.88, 0.92)
    caption(img, t, S("a2") - 0.2, E("a2") + 0.9, "DENNIS ERIKSSON", "Åland")
    return img


def briefcase(d, cx, cy, s=1.0, group=0):
    X = lambda p: np.asarray(p, float) * s + np.array([cx, cy])  # noqa: E731
    d.add(X(D.rect(-80, -40, 80, 70)), 2.0, INK, 1.0, group)
    d.add(X(catmull([(-28, -40), (-28, -66), (28, -66), (28, -40)], 6)), 2.0, INK, 1.0, group)
    d.add(X(D.line((-80, 6), (80, 6))), 1.2, INK, 0.7, group)
    d.add(X(D.rect(-12, -2, 12, 14)), 1.6, AMBER, 1.0, group)
    return d


@functools.lru_cache(maxsize=1)
def facets_drawing():
    d = D.Drawing()
    briefcase(d, 420, 470, 1.25, group=0)
    art.violin(d, 1500, 520, 0.42, group=2, rot=math.radians(18))
    return d


def shoe_trail(mask, x0, y0, t, t0, n=6, step=62, s=0.9, ang=-18, speed=0.33, value=1.0):
    for k in range(n):
        tk = t0 + k * speed
        v = smooth(lin(t, tk, tk + 0.25)) * value
        if v <= 0:
            continue
        a = math.radians(ang)
        side = -1 if k % 2 else 1
        x = x0 + k * step * math.sin(a) + side * 16 * math.cos(a)
        y = y0 - k * step * math.cos(a) + side * 16 * math.sin(a)
        art.shoe_print(mask, x, y, s, ang, v, flip=bool(k % 2))
    return mask


@shot("facets", S("a3") - 0.3, S("a4") + 0.6)
def _(t, lt, sh):
    img = paper(4).copy()
    sents = LINES["a3"]["sents"]
    gp = {0: ease_io(lin(t, sents[0][0] + 0.2, sents[0][0] + 1.8)),
          2: ease_io(lin(t, sents[2][0] + 0.1, sents[2][0] + 2.2))}
    facets_drawing().render(img, 0.0, group_progress=gp, glow=0.3)
    m = np.zeros((H, W), np.float32)
    shoe_trail(m, 915, 640, t, sents[1][0] + 0.1, n=6, step=64, s=1.0, ang=12, speed=0.26)
    over_color(img, INK, m * 0.9)
    for i, (x, word) in enumerate(((420, "ARBETE"), (960, "LÖPNING"), (1500, "MUSIK"))):
        a = smooth(lin(t, sents[i][0] + 0.4, sents[i][0] + 1.2))
        draw_text(img, word, x, 800, name="sans_m", size=24, tracking=0.42, alpha=a, anchor="c")
        dm = np.zeros((H, W), np.float32)
        ln = 36 * ease_out(lin(t, sents[i][0] + 0.5, sents[i][0] + 1.4))
        poly_lines(dm, [np.array([(x - ln, 836), (x + ln, 836)])], 1)
        over_color(img, AMBER, dm * a)
    for x in (690, 1230):
        dm = np.zeros((H, W), np.float32)
        poly_lines(dm, [np.array([(x, 300), (x, 820)])], 1)
        over_color(img, INK_DIM, dm * 0.25 * smooth(lin(t, sh.t0, sh.t0 + 1)))
    return img


def phone_body(img, cx, cy, w, h, alpha=1.0, screen=None, glow=0.0):
    """Telefon: kropp + skärm (screen = (sh, sw, 3) bild) ."""
    x0, y0, x1, y1 = cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2
    outer = art.rounded_rect_mask(x0, y0, x1, y1, 58)
    sh = cv2.GaussianBlur(outer, (0, 0), 30)
    over_color(img, (0, 0, 0), np.roll(sh, (22, 10), (0, 1)) * 0.8 * alpha)
    over_color(img, (0.075, 0.078, 0.085), outer * alpha)
    edge = cv2.morphologyEx((outer > 0.5).astype(np.uint8), cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8)).astype(np.float32)
    over_color(img, (0.42, 0.42, 0.42), edge * 0.6 * alpha)
    inner = art.rounded_rect_mask(x0 + 16, y0 + 16, x1 - 16, y1 - 16, 44)
    if screen is not None:
        sw, shh = int(x1 - x0 - 32), int(y1 - y0 - 32)
        scr = cv2.resize(screen, (sw, shh), interpolation=cv2.INTER_AREA)
        full = np.zeros((H, W, 3), np.float32)
        over(full, scr, np.ones((shh, sw), np.float32), int(x0 + 16), int(y0 + 16))
        img += (full - img) * (inner * alpha)[..., None]
        if glow > 0:
            g = cv2.GaussianBlur(full * inner[..., None], (0, 0), 40)
            img += g * glow * alpha
    else:
        over_color(img, (0.012, 0.014, 0.018), inner * alpha)
    # ön (kameran)
    isl = art.rounded_rect_mask(cx - 54, y0 + 30, cx + 54, y0 + 62, 16)
    over_color(img, (0.0, 0.0, 0.0), isl * alpha)
    # reflex
    ref = np.zeros((H, W), np.float32)
    cv2.fillPoly(ref, [np.int32([(x0 + 30, y0 + 20), (x0 + 150, y0 + 20), (x0 + 30, y0 + 360)])], 1.0, cv2.LINE_AA)
    ref = cv2.GaussianBlur(ref, (0, 0), 20) * inner
    img += ref[..., None] * 0.035 * alpha
    return img


SW, SHH = 388, 828


def screen_canvas(bg=(0.06, 0.065, 0.075)):
    c = np.empty((SHH, SW, 3), np.float32)
    c[:] = bg
    return c


def app_grid(t, jiggle=0.0):
    c = screen_canvas((0.05, 0.06, 0.09))
    yy = np.linspace(0, 1, SHH, dtype=np.float32)[:, None, None]
    c += (1 - yy) * np.array([0.05, 0.03, 0.08], np.float32)
    rng = np.random.default_rng(4)
    cols = [(0.85, 0.45, 0.25), (0.25, 0.55, 0.85), (0.35, 0.7, 0.4), (0.9, 0.75, 0.3), (0.6, 0.4, 0.8),
            (0.85, 0.3, 0.35), (0.3, 0.75, 0.75), (0.8, 0.8, 0.82)]
    k = 0
    for r in range(6):
        for q in range(4):
            x = 38 + q * 88
            y = 110 + r * 108
            ph = rng.uniform(0, 6.28)
            ang = jiggle * 4.0 * math.sin(t * 22 + ph)
            m = art.rounded_rect_mask(0, 0, 64, 64, 15, shape=(64, 64))
            M = cv2.getRotationMatrix2D((32, 32), ang, 1.0)
            m = cv2.warpAffine(m, M, (64, 64))
            col = np.asarray(cols[k % len(cols)], np.float32) * 0.8
            over(c, col, m, x, y)
            k += 1
    draw_text_small(c, "13:37", SW / 2, 58, 26)
    return c


def draw_text_small(c, text, x, y, size, color=INK, anchor="c", name="sans_m", alpha=1.0):
    """draw_text på en mindre duk."""
    from film.common import text_mask
    m, base, tw, pad = text_mask(text, name, size, 0.0)
    x0 = x - tw / 2 - pad if anchor == "c" else (x - pad if anchor == "l" else x - tw - pad)
    over(c, np.asarray(color, np.float32), m * alpha, int(x0), int(y - base))
    return c


@shot("phone_q", S("a4") - 0.5, S("b1") - 1.2, fout=0.8)
def _(t, lt, sh):
    img = paper(5).copy()
    e = ease_out(lin(t, sh.t0, sh.t0 + 1.2))
    cy = 560 + 80 * (1 - e)
    on = smooth(lin(t, S("a4") + 0.3, S("a4") + 0.9))
    jig = smooth(lin(t, Wt("a4", "förstått") - 0.3, Wt("a4", "förstått") + 0.3))
    scr = app_grid(t, jig) * on
    buzz = 0.0
    tb = Wt("a4", "mobiltelefon")
    if tb < t < tb + 0.9:
        buzz = 5 * math.sin(t * 90) * (1 - lin(t, tb, tb + 0.9))
    phone_body(img, 960 + buzz, cy, 420, 860, e, screen=scr, glow=0.25 * on)
    qa = smooth(lin(t, tb + 0.2, tb + 1.0))
    if qa > 0:
        draw_text(img, "?", 960 + 300, 400, name="serif", size=180, weight=500, alpha=qa, color=AMBER,
                  anchor="c", dy=12 * (1 - qa), shadow=0.6)
    return img


# ==========================================================================
# II. VÄSTERUT
# ==========================================================================
chapter("II", "Västerut", S("b1") + 0.2)
NOR_PT = eur(9.6, 61.3)
ALAND_E = eur(20.02, 60.19)
SCAND = Camera(*eur(15.5, 63.2), 1750)


def norway_mask(cam):
    return geo.polys_mask(cam, elayers(cam.mpp).country("NOR"))


@shot("map_west", S("b1") - 2.2, S("b3") + 0.4)
def _(t, lt, sh):
    x = ease_io(lin(t, sh.t0, S("b1") + 3.4), 2.0)
    a = Camera(*ALAND_E, 420)
    cam = zoom_path(a, SCAND, x)
    cam = Camera(cam.cx - 60000 * lin(t, S("b1") + 3.4, sh.t1), cam.cy, cam.mpp * (1 - 0.04 * lin(t, S("b1") + 3.4, sh.t1)))
    img, _ = geo.render_map(cam, elayers(cam.mpp), coast_alpha=0.5, border_alpha=0.4)
    # rutt Åland -> Norge
    p0, p1 = cam.to_screen(ALAND_E), cam.to_screen(NOR_PT)
    arc = arc_between(p0, p1, 0.22, 90)
    pr = ease_io(lin(t, S("b1") + 0.3, S("b1") + 2.6), 1.6)
    if pr > 0:
        m = np.zeros((H, W), np.float32)
        poly_lines(m, dashed(partial_polyline(arc, pr), 10, 8), 2)
        glow_layer(img, m, AMBER, 0.9, 0.5, 4)
        dot(img, *p0, 4, AMBER, glow=0.5)
    ka = fade(t, Wt("b1", "Kölen") - 0.2, Wt("b1", "Kölen") + 0.8, sh.t1 - 1.5, sh.t1)
    if ka > 0:
        geo.label(img, cam, eur(14.6, 65.3), "Kölen", "sea", alpha=ka, color=INK)
    na = smooth(lin(t, Wt("b1", "Norge") - 0.2, Wt("b1", "Norge") + 1.0))
    if na > 0:
        nm = norway_mask(cam)
        fill_mask(img, nm, AMBER, 0.28 * na)
        outline_glow(img, nm, AMBER, 0.7 * na)
        geo.label(img, cam, eur(9.4, 62.4), "Norge", "big", alpha=na)
        dot(img, *p1, 4, AMBER, alpha=na, glow=0.6)
    geo.label(img, cam, eur(15.6, 61.2), "Sverige", "country", alpha=0.6 * smooth(lin(t, sh.t0 + 1, sh.t0 + 2.5)))
    geo.label(img, cam, eur(26.5, 63.0), "Finland", "country", alpha=0.5 * smooth(lin(t, sh.t0 + 1, sh.t0 + 2.5)))
    caption(img, t, S("b2") + 0.2, sh.t1 + 0.6, "PSYKIATRI", "Norge, som ung")
    return img


@functools.lru_cache(maxsize=1)
def chairs_drawing():
    return art.chairs(960, 700, 1.25)


@functools.lru_cache(maxsize=1)
def lamp_light():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - 960) / 700) ** 2 + ((yy - 380) / 520) ** 2)
    return np.clip(1 - r, 0, 1) ** 2


@shot("listen", S("b3") - 0.4, S("b4") + 0.3)
def _(t, lt, sh):
    img = paper(6).copy()
    img += lamp_light()[..., None] * np.array([0.09, 0.065, 0.035], np.float32) * smooth(lin(t, sh.t0, sh.t0 + 2))
    s3 = LINES["b3"]["sents"]
    pr = ease_io(lin(t, sh.t0 + 0.1, s3[0][0] + 2.8), 1.4)
    chairs_drawing().render(img, pr, glow=0.3)
    words = [("TÅLAMOD", Wt("b3", "tålamod"), 560), ("LUGN", s3[1][0], 960), ("ATT LYSSNA", Wt("b3", "lyssna") - 0.3, 1360)]
    for w, tw, x in words:
        a = smooth(lin(t, tw - 0.1, tw + 0.7))
        draw_text(img, w, x, 880, name="sans_m", size=24, tracking=0.42, alpha=a, anchor="c", dy=8 * (1 - a))
    # ljudvågor från vänster stol till höger (lyssnande)
    tl = Wt("b3", "lyssna") - 0.5
    if t > tl:
        m = np.zeros((H, W), np.float32)
        for k in range(4):
            ph = ((t - tl) * 0.6 - k * 0.25)
            if 0 < ph < 1:
                r = 40 + 150 * ph
                arc = D.circle(700, 395, r, -0.55, 0.55, 30)
                poly_lines(m, [arc], 1, value=(1 - ph))
        over_color(img, AMBER, m * 0.8)
    return img


@shot("map_home", S("b4") - 0.4, S("c1") + 0.6)
def _(t, lt, sh):
    x = ease_io(lin(t, S("b4") + 1.4, E("b4") + 2.2), 2.0)
    a = Camera(SCAND.cx - 60000, SCAND.cy, SCAND.mpp * 0.96)
    b = Camera(*ALAND_E, 260)
    cam = zoom_path(a, b, x)
    img, _ = geo.render_map(cam, elayers(cam.mpp), coast_alpha=0.5, border_alpha=0.4)
    nm = norway_mask(cam)
    na = 1 - smooth(lin(t, S("b4") + 2.5, E("b4") + 1.5))
    fill_mask(img, nm, AMBER, 0.28 * na)
    p0, p1 = cam.to_screen(NOR_PT), cam.to_screen(ALAND_E)
    arc = arc_between(p0, p1, -0.22, 90)
    pr = ease_io(lin(t, S("b4") + 0.1, S("b4") + 2.6), 1.6)
    m = np.zeros((H, W), np.float32)
    poly_lines(m, dashed(partial_polyline(arc, pr), 10, 8), 2)
    glow_layer(img, m, AMBER, 0.9 * (1 - smooth(lin(t, E("b4") + 1.0, E("b4") + 2.0))), 0.5, 4)
    ha = smooth(lin(t, S("b4") + 2.2, S("b4") + 3.4))
    if ha > 0:
        am = geo.polys_mask(cam, elayers(cam.mpp).country("ALD"))
        fill_mask(img, am, AMBER, 0.3 * ha)
        outline_glow(img, am, AMBER, 0.9 * ha)
        p = cam.to_screen(ALAND_E)
        draw_text(img, "hem", p[0] + 80, p[1] - 60, name="serif_it", size=40, weight=500, alpha=ha, shadow=0.7)
    return img


# ==========================================================================
# III. ARBETET
# ==========================================================================
chapter("III", "Arbetet", S("c1") + 0.2)


@shot("sat_aland", S("c1") - 0.4, S("c2") + 0.4)
def _(t, lt, sh):
    x = lin(t, sh.t0, sh.t1)
    cam = Camera(*(utm(19.97, 60.16) + np.array([3000 * x, 1500 * x])), mix(88, 70, ease_io(x)))
    img = sat_img(cam, s=0.75, gain=0.88)
    img = cloud_layer(img, t, 0.35, seed=5, speed=(30, 8))
    return img


RING_C, RING_R = (1290, 540), 290


@functools.lru_cache(maxsize=1)
def work_people():
    rng = np.random.default_rng(8)
    inside = []
    while len(inside) < 30:
        a, r = rng.uniform(0, 2 * math.pi), math.sqrt(rng.uniform(0, 1)) * (RING_R - 50)
        p = (RING_C[0] + r * math.cos(a), RING_C[1] + 30 + r * math.sin(a) * 0.9)
        if all((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 > 48 ** 2 for q in inside):
            inside.append(p)
    outside = []
    while len(outside) < 16:
        p = (rng.uniform(150, 640), rng.uniform(260, 900))
        if all((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 > 70 ** 2 for q in outside) and not (560 < p[0] and 460 < p[1] < 720):
            outside.append(p)
    slots = []
    while len(slots) < 16:
        a, r = rng.uniform(0, 2 * math.pi), math.sqrt(rng.uniform(0.05, 1)) * (RING_R - 45)
        p = (RING_C[0] + r * math.cos(a), RING_C[1] + 30 + r * math.sin(a) * 0.9)
        if all((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 > 44 ** 2 for q in inside + slots):
            slots.append(p)
    # sortera ytterfigurer: närmast Dennis först
    outside.sort(key=lambda p: -p[0])
    return inside, outside, slots


DENNIS_P = (800, 610)


def move_times():
    t1 = Wt("c3", "trodde") - 0.4
    ts = [t1, S("c4") + 0.1, S("c4", 1) + 0.1]
    tt = S("c4", 1) + 1.6
    step = 0.7
    while len(ts) < 16:
        ts.append(tt)
        tt += step
        step = max(0.18, step * 0.72)
    return ts


@shot("people", S("c2") - 0.3, S("c5") + 0.5)
def _(t, lt, sh):
    img = paper(7).copy()
    inside, outside, slots = work_people()
    ra = smooth(lin(t, S("c2") + 0.2, S("c2") + 1.4))
    m = np.zeros((H, W), np.float32)
    circ = D.circle(RING_C[0], RING_C[1] + 20, RING_R + 10, -math.pi / 2, -math.pi / 2 + 2 * math.pi * ease_io(ra), 200)
    poly_lines(m, [circ], 1)
    over_color(img, AMBER, m * 0.7)
    draw_text(img, "ARBETE", RING_C[0], RING_C[1] - RING_R - 30, name="sans_m", size=22, tracking=0.42, anchor="c", alpha=ra)
    mi = np.zeros((H, W), np.float32)
    for i, (x, y) in enumerate(inside):
        person(mi, x, y, 0.9, smooth(lin(t, S("c2") + 0.5 + i * 0.03, S("c2") + 1.3 + i * 0.03)))
    glow_layer(img, mi, np.array([0.62, 0.52, 0.38], np.float32), 0.8, 0.2)
    oa = smooth(lin(t, S("c3") - 0.2, S("c3") + 1.0))
    mo = np.zeros((H, W), np.float32)
    mm = np.zeros((H, W), np.float32)
    lines = np.zeros((H, W), np.float32)
    ts = move_times()
    for k, (p, q) in enumerate(zip(outside, slots)):
        t0 = ts[k]
        talk0, go0, go1 = t0 - 0.9, t0, t0 + 1.8
        u = ease_io(lin(t, go0, go1), 2)
        if u <= 0:
            person(mo, p[0], p[1], 0.9, oa * (0.8 + 0.2 * math.sin(t * 1.3 + k)))
            if t > talk0 and t0 < 1e9:
                la = smooth(lin(t, talk0, talk0 + 0.3))
                seg = np.array([(DENNIS_P[0] - 16, DENNIS_P[1] - 30), (p[0] + 16, p[1] - 30)])
                poly_lines(lines, dashed(seg, 6, 6, offset=t * 30), 1, value=la)
        else:
            path = arc_between(p, q, -0.18, 40)
            x, y = point_at(path, u)
            person(mm, x, y, 0.9, 1.0)
    over_color(img, INK_DIM, mo * 0.75)
    glow_layer(img, mm, WARM, 1.0, 0.5, 5)
    over_color(img, AMBER, lines * 0.8)
    da = smooth(lin(t, S("c3", 1) - 0.2, S("c3", 1) + 0.8))
    if da > 0:
        md = np.zeros((H, W), np.float32)
        person(md, DENNIS_P[0], DENNIS_P[1], 1.25, da)
        glow_layer(img, md, WARM, 1.0, 1.0, 8)
        draw_text(img, "DENNIS", DENNIS_P[0], DENNIS_P[1] + 50, name="sans_m", size=18, tracking=0.4, anchor="c",
                  alpha=da * 0.9, color=AMBER)
    return img


MH_C = utm(19.936, 60.1)
MH_PINS = [("AFFÄREN", (19.946, 60.1045), "c5", 2, "r"), ("HAMNEN", (19.9225, 60.0985), "c5", 3, "l"),
           ("CAFÉET", FIDDLE_LL, "c5", 4, "r")]


@functools.lru_cache(maxsize=1)
def town_dots():
    rng = np.random.default_rng(31)
    pts = []
    while len(pts) < 110:
        x, y = rng.normal(0, 900), rng.normal(0, 650)
        pts.append((MH_C[0] + x, MH_C[1] + y))
    return np.array(pts), rng.uniform(0, 4.5, 110)


@shot("mhamn", S("c5") - 0.4, E("c5") + 0.9)
def _(t, lt, sh):
    x = lin(t, sh.t0, sh.t1)
    cam = Camera(MH_C[0] - 400 + 800 * x, MH_C[1] + 200 - 300 * x, mix(8.0, 6.4, ease_io(x)))
    img = sat_img(cam, s=0.72, gain=0.86, interp=cv2.INTER_CUBIC)
    img *= 0.85
    pts, dl = town_dots()
    sp = cam.to_screen(pts)
    m = np.zeros((H, W), np.float32)
    t0 = S("c5") + 0.6
    for (px, py), d in zip(sp, dl):
        v = smooth(lin(t, t0 + d, t0 + d + 0.5))
        if v > 0 and -10 < px < W + 10 and -10 < py < H + 10:
            cv2.circle(m, (int(px * 16), int(py * 16)), 40, v, -1, cv2.LINE_AA, 4)
    glow_layer(img, m, WARM, 0.9, 1.0, 5)
    for label, ll, lid, k, side in MH_PINS:
        p = cam.to_screen(utm(*ll))
        pin(img, p[0], p[1], label, t, LINES[lid]["sents"][k][0] - 0.1, sh.t1 + 1, side=side, size=26)
    caption(img, t, sh.t0 + 0.6, S("c5", 2) - 0.3, "MARIEHAMN")
    return img


def life_line(img, t, t0, t1, cont0=None, cont1=None, a=1.0, shift=0.0):
    """Arbetslivets tidslinje; valfri fortsättning efter slutpunkten."""
    x0, x1, y = 250 - shift, 1500 - shift, 560
    pr = ease_io(lin(t, t0, t1), 1.4)
    m = np.zeros((H, W), np.float32)
    xe = x0 + (x1 - x0) * pr
    poly_lines(m, [np.array([(x0, y), (xe, y)])], 2)
    for k, xx in enumerate(np.arange(x0, xe, 50)):
        hh = 16 if k % 5 == 0 else 8
        poly_lines(m, [np.array([(xx, y - hh), (xx, y)])], 1)
    over_color(img, INK, m * 0.85 * a)
    draw_text(img, "ARBETSLIV", x0, y - 60, name="sans_m", size=22, tracking=0.42, alpha=smooth(lin(t, t0, t0 + 0.8)) * a)
    ea = smooth(lin(t, t1 - 0.2, t1 + 0.6)) * a
    if ea > 0:
        dot(img, x1, y, 7, AMBER, alpha=ea, glow=1.0)
        draw_text(img, "PENSIONÄR", x1, y + 70, name="sans_m", size=24, tracking=0.42, anchor="c", alpha=ea, color=AMBER)
    if cont0 is not None:
        cp = ease_io(lin(t, cont0, cont1), 1.3)
        if cp > 0:
            mc = np.zeros((H, W), np.float32)
            xc = x1 + 12 + (W + 400 - x1) * cp
            poly_lines(mc, dashed(np.array([(x1 + 12, y), (xc, y)]), 14, 10, offset=-t * 40), 2)
            glow_layer(img, mc, WARM, a, 0.8, 5)
    return img


@shot("retire", S("c6") - 0.5, S("d1") - 0.4, fout=0.8)
def _(t, lt, sh):
    img = paper(8).copy()
    life_line(img, t, S("c6") - 0.2, Wt("c6", "pensionär") + 0.2)
    return img


# ==========================================================================
# IV. FAMILJEN
# ==========================================================================
chapter("IV", "Familjen", S("d1") - 0.2)

NODES = {
    "Dennis": ((760, 300), 74), "Ann": ((1160, 300), 74), "Napso": ((1500, 320), 46),
    "Viktor": ((560, 620), 56), "Elin": ((960, 620), 56), "Ida": ((1360, 620), 56),
    "Adam": ((520, 930), 44), "Olle": ((740, 930), 44), "Tilly": ((960, 930), 44),
    "Kalle": ((1180, 930), 44), "Sigge": ((1400, 930), 44),
}


@functools.lru_cache(maxsize=1)
def dennis_face():
    fg, _, _ = photo("steps")
    cx, cy, r = 737, 700, 205
    crop = fg[cy - r:cy + r, cx - r:cx + r]
    crop = cv2.resize(crop, (256, 256), interpolation=cv2.INTER_AREA)
    return film_tone(crop, 0.02, 0.85, 0.95)


def node(img, cam, name, a, t_in, t, sub=None, content="mono", sub2=None):
    (x, y), r = NODES[name]
    cx, cy, z = cam
    sx, sy, rr = (x - cx) * z + W / 2, (y - cy) * z + H / 2, r * z
    e = ease_out(lin(t, t_in, t_in + 0.8))
    if e <= 0:
        return img
    al = a * smooth(lin(t, t_in, t_in + 0.6))
    rr_e = rr * (0.85 + 0.15 * e)
    m = np.zeros((H, W), np.float32)
    cv2.circle(m, (int(sx * 16), int(sy * 16)), int(rr_e * 16), 1.0, -1, cv2.LINE_AA, 4)
    over_color(img, (0.07, 0.07, 0.075), m * al)
    if content == "photo":
        face = dennis_face()
        d = int(rr_e * 2)
        if d > 4:
            fr = cv2.resize(face, (d, d), interpolation=cv2.INTER_AREA)
            cm = np.zeros((d, d), np.float32)
            cv2.circle(cm, (d // 2, d // 2), d // 2 - 1, 1.0, -1, cv2.LINE_AA)
            over(img, fr, cm * al, int(sx - d / 2), int(sy - d / 2))
    elif content == "paw":
        pm = np.zeros((H, W), np.float32)
        paw(pm, sx, sy + 4 * z, 1.35 * z)
        over_color(img, WARM, pm * al)
    else:
        draw_text(img, name[0], sx, sy + rr_e * 0.36, name="serif", size=max(8, int(rr_e * 1.0)), weight=500,
                  anchor="c", alpha=al, color=INK)
    ring(img, sx, sy, rr_e, AMBER, alpha=al * 0.95, width=1.6)
    ring(img, sx, sy, rr_e + 7 * z, AMBER, alpha=al * 0.3, width=1.0)
    draw_text(img, name, sx, sy + rr_e + 42 * z, name="sans_m", size=max(8, int(24 * z)), tracking=0.18,
              anchor="c", alpha=al, color=INK)
    if sub:
        sa = smooth(lin(t, sub[1], sub[1] + 0.8)) * a
        draw_text(img, sub[0], sx, sy + rr_e + 80 * z, name="serif_it", size=max(8, int(28 * z)), weight=400,
                  anchor="c", alpha=sa * 0.85, color=INK)
    return img


def tree_line(img, cam, pts, pr, a=1.0, color=INK_DIM):
    if pr <= 0:
        return img
    cx, cy, z = cam
    p = np.array([((x - cx) * z + W / 2, (y - cy) * z + H / 2) for x, y in pts])
    m = np.zeros((H, W), np.float32)
    poly_lines(m, [partial_polyline(p, pr)], 1)
    over_color(img, color, m * a * 0.9)
    return img


def cam_path(t, keys):
    """keys: [(t, (cx, cy, z)), ...] mjuk interpolation."""
    if t <= keys[0][0]:
        return keys[0][1]
    for (ta, ca), (tb, cb) in zip(keys[:-1], keys[1:]):
        if t <= tb:
            u = ease_io(lin(t, ta, tb), 2)
            return tuple(ca[i] + (cb[i] - ca[i]) * u for i in range(3))
    return keys[-1][1]


def draw_tree(img, t, cam, grand=True):
    s2 = LINES["d2"]["sents"]
    s3 = LINES["d3"]["sents"]
    node(img, cam, "Dennis", 1.0, S("d1") - 0.6, t, content="photo")
    node(img, cam, "Ann", 1.0, s2[0][0] + 0.2, t, sub=("född Granlund", s2[1][0] + 0.2))
    tree_line(img, cam, [(836, 300), (1084, 300)], ease_io(lin(t, s2[0][0] + 0.5, s2[0][0] + 1.4)))
    kids_t = [s3[1][0], s3[2][0] + 0.1, s3[3][0] + 0.2]
    tree_line(img, cam, [(960, 300), (960, 470)], ease_io(lin(t, s3[0][0] + 0.8, s3[0][0] + 1.6)))
    tree_line(img, cam, [(560, 470), (1360, 470)], ease_io(lin(t, s3[0][0] + 1.2, s3[0][0] + 2.4)))
    for nm, tk in zip(("Viktor", "Elin", "Ida"), kids_t):
        x = NODES[nm][0][0]
        tree_line(img, cam, [(x, 470), (x, 562)], ease_io(lin(t, tk - 0.3, tk + 0.2)))
        node(img, cam, nm, 1.0, tk, t)
    if grand:
        s5 = LINES["d5"]["sents"]
        la = smooth(lin(t, s5[0][0] + 0.3, s5[0][0] + 1.3))
        if la > 0:
            cx, cy, z = cam
            ly = (800 - cy) * z + H / 2
            lx = (960 - cx) * z + W / 2
            draw_text(img, "BARNBARN", lx, ly + 7 * z, name="sans_m", size=max(8, int(18 * z)), tracking=0.45,
                      anchor="c", alpha=la * 0.8, color=AMBER)
            tree_line(img, cam, [(500, 800), (870, 800)], la, 0.5)
            tree_line(img, cam, [(1050, 800), (1420, 800)], la, 0.5)
        for k, nm in enumerate(("Adam", "Olle", "Tilly", "Kalle", "Sigge")):
            node(img, cam, nm, 1.0, s5[1 + k][0] - 0.1, t)
    return img


@shot("tree1", S("d1") - 1.2, S("d4") + 0.4)
def _(t, lt, sh):
    img = paper(9).copy()
    s3 = LINES["d3"]["sents"]
    cam = cam_path(t, [(sh.t0, (760, 300, 1.7)), (S("d2") - 0.2, (760, 300, 1.55)), (S("d2") + 1.4, (960, 320, 1.25)),
                       (s3[0][0] + 0.4, (960, 330, 1.2)), (s3[1][0] + 0.2, (960, 470, 0.95)), (sh.t1, (960, 480, 0.92))])
    draw_tree(img, t, cam, grand=False)
    return img


STH = utm(18.0686, 59.3293)
MHN = utm(19.9348, 60.0973)


@shot("map_sthlm", S("d4") - 0.4, S("d5") + 0.4)
def _(t, lt, sh):
    x = lin(t, sh.t0, sh.t1)
    c = (STH + MHN) / 2 + np.array([15000, 12000])
    cam = Camera(c[0] - 6000 * x, c[1], mix(185, 165, ease_io(x)))
    img, _ = geo.render_map(cam, layers(cam.mpp), coast_alpha=0.55, border_alpha=0.3)
    s4 = LINES["d4"]["sents"]
    am = geo.polys_mask(cam, layers(cam.mpp).country("ALD"))
    ha = smooth(lin(t, s4[0][0], s4[0][0] + 1.0))
    fill_mask(img, am, AMBER, 0.22 * ha)
    geo.label(img, cam, utm(19.25, 59.93), "Ålands hav", "sea", alpha=smooth(lin(t, s4[1][0] + 1.2, s4[1][0] + 2.2)))
    pa = cam.to_screen(utm(20.05, 60.22))
    pin(img, pa[0], pa[1], "VIKTOR · ELIN", t, s4[0][0] + 0.1, 1e9, side="r", sub="Åland", size=28)
    ps = cam.to_screen(STH)
    pin(img, ps[0], ps[1], "IDA", t, Wt("d4", "Ida") - 0.1, 1e9, side="l", sub="Stockholm", size=28)
    pm = cam.to_screen(MHN)
    route = arc_between(pm, ps, 0.12, 80)
    pr = ease_io(lin(t, Wt("d4", "Stockholm") - 0.4, Wt("d4", "Stockholm") + 1.6), 1.5)
    if pr > 0:
        m = np.zeros((H, W), np.float32)
        poly_lines(m, dashed(partial_polyline(route, pr), 8, 7), 1)
        over_color(img, INK, m * 0.8)
        if pr >= 1:
            u = ((t - (Wt("d4", "Stockholm") + 1.6)) * 0.22) % 1
            bx, by = point_at(route, u)
            dot(img, bx, by, 3.2, WARM, glow=0.8)
    return img


PAW_TRAIL = None


def paw_trail(t, cam, t0, t_run):
    """Tassavtryck från Napsos nod åt höger; gången blir längre när hunden springer."""
    cx, cy, z = cam
    m = np.zeros((H, W), np.float32)
    x, y = 1560.0, 360.0
    tt = t0
    k = 0
    while tt < t and k < 60:
        running = tt > t_run
        stride = 95 if running else 58
        dt = 0.16 if running else 0.3
        side = 1 if k % 2 else -1
        age = t - tt
        v = smooth(lin(age, 0, 0.2)) * (1 - smooth(lin(age, 3.5, 5.0)))
        sx = (x - cx) * z + W / 2
        sy = (y + side * 16 - cy) * z + H / 2
        if v > 0:
            paw(m, sx, sy, 0.8 * z, 90, v)
        x += stride
        y += 6 * math.sin(k * 0.7)
        tt += dt
        k += 1
    return m


@shot("tree2", S("d5") - 0.3, S("e1") + 0.6)
def _(t, lt, sh):
    img = paper(9).copy()
    s5 = LINES["d5"]["sents"]
    s6 = LINES["d6"]["sents"]
    s8 = LINES["d8"]["sents"]
    cam = cam_path(t, [(sh.t0, (960, 480, 0.92)), (s5[1][0], (960, 640, 0.78)), (S("d6") + 0.2, (960, 640, 0.78)),
                       (s6[1][0] + 0.2, (1200, 520, 0.85)), (S("d7") + 0.2, (1440, 350, 1.35)),
                       (s8[0][0] + 0.8, (1700, 360, 1.25)), (sh.t1, (3000, 380, 1.15))])
    draw_tree(img, t, cam, grand=True)
    node(img, cam, "Napso", 1.0, s6[1][0] + 0.3, t, content="paw")
    m = paw_trail(t, cam, S("d8") + 0.1, s8[1][0] + 0.2)
    glow_layer(img, m, WARM, 0.9, 0.5, 4)
    return img


# ==========================================================================
# V. FLOCKEN
# ==========================================================================
chapter("V", "Flocken", S("e1") - 0.2)


@functools.lru_cache(maxsize=1)
def topo_layers():
    cont, hgt = art.topo()
    gx = cv2.Sobel(hgt, cv2.CV_32F, 1, 0, ksize=5)
    gy = cv2.Sobel(hgt, cv2.CV_32F, 0, 1, ksize=5)
    shade = np.clip(0.5 + (-gx * 0.6 - gy * 0.8) * 6.0, 0, 1)
    base = 0.035 + 0.03 * hgt + 0.035 * (shade - 0.5)
    rgb = np.stack([base * 0.95, base * 1.05, base * 1.0], -1).astype(np.float32)
    tr = art.trail_points()
    L = np.concatenate([[0], np.cumsum(np.sqrt((np.diff(tr, axis=0) ** 2).sum(1)))])
    return rgb, cont, tr, L


def trail_at(s):
    _, _, tr, L = topo_layers()
    d = np.clip(s, 0, L[-1])
    return np.array([np.interp(d, L, tr[:, 0]), np.interp(d, L, tr[:, 1])])


@functools.lru_cache(maxsize=1)
def rain_drops():
    rng = np.random.default_rng(5)
    return rng.uniform(0, 1, (500, 3))


@shot("topo", S("e1") - 1.4, S("f1") - 0.6, fout=1.2)
def _(t, lt, sh):
    rgb, cont, tr, L = topo_layers()
    t_run0, t_run1 = S("e1", 1) - 0.4, sh.t1
    u = ease_io(lin(t, t_run0, t_run1), 1.2)
    lead_s = 150 + (L[-1] - 350) * u
    lead = trail_at(lead_s)
    z = mix(1.05, 0.78, ease_io(lin(t, sh.t0, sh.t1), 1.5))
    zo = smooth(lin(t, S("e5"), S("e5") + 3.5))
    focus = lead * (1 - zo) + np.array([TW_C, TH_C]) * zo
    z = z * (1 - zo) + 0.5 * zo
    M = np.float32([[z, 0, W / 2 - focus[0] * z], [0, z, H / 2 - focus[1] * z]])
    img = cv2.warpAffine(rgb, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    cm = cv2.warpAffine(cont, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    img *= 1.35
    over_color(img, (0.6, 0.66, 0.62), cm * 0.45)
    sp = tr * z + np.array([M[0, 2], M[1, 2]])
    m = np.zeros((H, W), np.float32)
    poly_lines(m, dashed(sp, 6, 8), 1)
    over_color(img, INK, m * 0.35)
    # gången sträcka
    k = int(np.searchsorted(L, lead_s))
    if k > 1:
        m2 = np.zeros((H, W), np.float32)
        poly_lines(m2, [sp[:k]], 2)
        glow_layer(img, m2, AMBER, 0.75, 0.6, 5)
    # flocken
    pack_a = smooth(lin(t, S("e3", 1) - 0.2, S("e3", 1) + 1.6))
    tight = smooth(lin(t, S("e5") - 0.5, S("e5") + 1.5))
    mp = np.zeros((H, W), np.float32)
    for i in range(7):
        if i == 0:
            a_i = smooth(lin(t, S("e1", 1) - 0.8, S("e1", 1) - 0.2))
            gap = 0
        else:
            a_i = pack_a
            gap = (22 + i * 26 + 10 * math.sin(t * 0.9 + i)) * (1 - 0.45 * tight)
        if a_i <= 0:
            continue
        p = trail_at(lead_s - gap)
        q = trail_at(lead_s - gap - 4)
        dvec = p - q
        nrm = np.array([-dvec[1], dvec[0]]) / (np.linalg.norm(dvec) + 1e-6)
        off = (((i * 37) % 7) - 3) * 5 * (1 - 0.6 * tight) + 3 * math.sin(t * 5 + i * 1.7)
        pp = p + nrm * off
        s = pp * z + np.array([M[0, 2], M[1, 2]])
        cv2.circle(mp, (int(s[0] * 16), int(s[1] * 16)), int((6.5 if i == 0 else 5) * 16), a_i, -1, cv2.LINE_AA, 4)
    glow_layer(img, mp, WARM, 1.0, 1.2, 6)
    # väder
    ra = fade(t, S("e4") - 0.2, S("e4") + 0.6, Wt("e4", "motvind") - 0.3, Wt("e4", "motvind") + 0.6)
    if ra > 0:
        dr = rain_drops()
        mr = np.zeros((H, W), np.float32)
        for x0, y0, sp_ in dr:
            y = ((y0 + t * (1.6 + sp_)) % 1.0) * (H + 100) - 50
            x = ((x0 + t * 0.12) % 1.0) * (W + 100) - 50
            poly_lines(mr, [np.array([(x, y), (x - 8, y + 26)])], 1, value=0.4 + 0.6 * sp_)
        over_color(img, (0.7, 0.75, 0.8), mr * 0.45 * ra)
        img *= 1 - 0.18 * ra
    wa = fade(t, Wt("e4", "motvind") - 0.2, Wt("e4", "motvind") + 0.4, E("e4") + 0.6, E("e4") + 1.4)
    if wa > 0:
        mw = np.zeros((H, W), np.float32)
        for i in range(14):
            y = 140 + i * 60 + 20 * math.sin(i * 1.7)
            ph = (t * 1.3 + i * 0.37) % 1.0
            x1 = W + 100 - ph * (W + 600)
            seg = np.array([(x1 + j * 18, y + 6 * math.sin((x1 + j * 18) * 0.01 + i)) for j in range(16)])
            poly_lines(mw, [seg], 1, value=0.6)
        over_color(img, INK, mw * 0.4 * wa)
    # emblem
    ba = fade(t, S("e2") - 0.2, S("e2") + 1.0, S("e3", 1) - 0.4, S("e3", 1) + 0.6)
    if ba > 0:
        img *= 1 - 0.55 * ba
        emblem(img, t, 960, 470, ba, S("e2") - 0.2)
        la = fade(t, Wt("e3", "canis") - 0.2, Wt("e3", "canis") + 0.6, S("e3", 1) - 0.4, S("e3", 1) + 0.6)
        if la > 0:
            draw_text(img, "canis lupus", 960, 790, name="serif_it", size=46, weight=400, anchor="c", alpha=la)
            draw_text(img, "VARG  ·  LAT.", 960, 836, name="sans_m", size=17, tracking=0.45, anchor="c", alpha=la * 0.7,
                      color=AMBER)
    return img


TW_C, TH_C = art.TW / 2 + 150, art.TH / 2 + 100


def emblem(img, t, cx, cy, a, t0):
    e = ease_out(lin(t, t0, t0 + 1.2))
    r = 190 * (0.92 + 0.08 * e)
    m = np.zeros((H, W), np.float32)
    cv2.circle(m, (int(cx * 16), int(cy * 16)), int(r * 16), 1.0, -1, cv2.LINE_AA, 4)
    over_color(img, (0.04, 0.045, 0.045), m * a * 0.85)
    ring(img, cx, cy, r, AMBER, alpha=a, width=2.0)
    ring(img, cx, cy, r - 12, AMBER, alpha=a * 0.6, width=1.0)
    ring(img, cx, cy, r - 58, AMBER, alpha=a * 0.6, width=1.0)
    art.ring_text(img, "LÖPARGRUPP  ·  I FLOCK  ·  LÖPARGRUPP  ·  I FLOCK  · ", cx, cy, r - 36, size=16,
                  color=INK, alpha=a * 0.85, start=-math.pi / 2 + t * 0.08, tracking=0.25)
    pm = np.zeros((H, W), np.float32)
    paw(pm, cx, cy - 48, 1.9)
    over_color(img, WARM, pm * a)
    draw_text(img, "CANIS", cx, cy + 22, name="serif", size=46, weight=600, tracking=0.2, anchor="c", alpha=a)
    draw_text(img, "LØPHUS", cx, cy + 66, name="serif", size=38, weight=500, tracking=0.24, anchor="c", alpha=a,
              color=AMBER)
    return img


# ==========================================================================
# VI. MUSIKEN
# ==========================================================================
chapter("VI", "Musiken", S("f1") - 0.2)


@functools.lru_cache(maxsize=1)
def instruments():
    d = D.Drawing()
    art.violin(d, 520, 600, 0.66, group=0, color=INK)
    art.guitar(d, 975, 690, 0.52, group=1, color=INK)
    art.guitar(d, 1420, 690, 0.56, group=2, color=INK, strings=4, uke=True)
    return d


def staff(img, t, t0, a):
    m = np.zeros((H, W), np.float32)
    pr = ease_io(lin(t, t0, t0 + 2.0))
    ys = [120 + k * 16 for k in range(5)]
    for y in ys:
        xs = np.linspace(-20, W + 20, 90)
        pts = np.stack([xs, y + 8 * np.sin(xs * 0.004 + 1.2)], 1)
        poly_lines(m, [partial_polyline(pts, pr)], 1)
    over_color(img, INK_DIM, m * 0.35 * a)
    rng = np.random.default_rng(3)
    mn = np.zeros((H, W), np.float32)
    for k in range(14):
        x = (rng.uniform(0, 1) * (W + 300) - t * 40 + k * 173) % (W + 300) - 150
        step = rng.integers(0, 9)
        y = 120 + 64 - step * 8 + 8 * math.sin(x * 0.004 + 1.2)
        cv2.ellipse(mn, (int(x * 16), int(y * 16)), (9 * 16, 6 * 16), -20, 0, 360, 1.0, -1, cv2.LINE_AA, 4)
        poly_lines(mn, [np.array([(x + 8, y), (x + 8, y - 44)])], 2)
    over_color(img, INK, mn * 0.5 * a * pr)
    return img


@shot("instruments", S("f1") - 1.2, S("f4") - 0.9)
def _(t, lt, sh):
    img = paper(10).copy()
    staff(img, t, S("f1") - 0.4, 1.0)
    s2 = LINES["f2"]["sents"]
    gp = {0: ease_io(lin(t, s2[0][0] - 0.1, s2[0][0] + 1.8), 1.3),
          1: ease_io(lin(t, s2[1][0] - 0.1, s2[1][0] + 1.7), 1.3),
          2: ease_io(lin(t, s2[2][0] - 0.1, s2[2][0] + 1.9), 1.3)}
    zz = 1 + 0.04 * ease_io(lin(t, s2[2][0], sh.t1))
    instruments().render(img, 0.0, group_progress=gp, glow=0.35, scale=zz,
                         offset=(960 * (1 - zz), 600 * (1 - zz)))
    for i, (x, w) in enumerate(((520, "FIOL"), (975, "GITARR"), (1420, "UKULELE"))):
        a = smooth(lin(t, s2[i][0] + 0.5, s2[i][0] + 1.3))
        xx = 960 + (x - 960) * zz
        draw_text(img, w, xx, 985, name="sans_m", size=22, tracking=0.45, alpha=a, anchor="c")
    return img


@shot("geo_clip", S("f4") - 1.4, CLIP_FIDDLE + 14.0)
def _(t, lt, sh):
    k0 = sh.t0
    x = ease_io(lin(t, k0, S("f4") + 3.0), 2.3)
    a = Camera(*ALAND_C, 110)
    b = Camera(*FIDDLE, 6.0)
    cam = zoom_path(a, b, x)
    ct = t - CLIP_FIDDLE
    grow = ease_io(lin(ct, 0, 1.0), 2.2)
    if grow < 1:
        img = sat_img(cam, s=0.78, gain=0.92, interp=cv2.INTER_CUBIC)
        p = cam.to_screen(FIDDLE)
        pa = smooth(lin(t, S("f4") + 0.8, S("f4") + 1.6))
        if pa > 0:
            ring(img, p[0], p[1], 14, AMBER, alpha=pa, width=1.6)
            pr = (t % 1.8) / 1.8
            ring(img, p[0], p[1], 14 + 40 * ease_out(pr), AMBER, alpha=pa * (1 - pr) * 0.8, width=1.4)
            dot(img, p[0], p[1], 4, AMBER, alpha=pa, glow=0.6)
            draw_text(img, "MARIEHAMN", 120, H - 290, name="sans_m", size=22, tracking=0.4, alpha=pa * (1 - grow),
                      shadow=0.8)
            draw_text(img, "60°05′57″ N   19°56′31″ E", 120, H - 250, name="mono", size=24, tracking=0.1,
                      alpha=pa * 0.85 * (1 - grow), shadow=0.8)
            draw_text(img, "30 juli 2025", 120, H - 206, name="serif_it", size=30, weight=400,
                      alpha=pa * 0.85 * (1 - grow), shadow=0.8)
        if ct > 0:
            px, py = p
            card = clip_card(ct, "fiddle", scale=0.03 + 0.97 * grow, cx=mix(px, W / 2, grow), cy=mix(py, H / 2, grow),
                             bg_alpha=grow)
            k = smooth(lin(ct, 0, 0.35))
            img = img * (1 - grow) + card * grow if grow > 0.02 else img
            _ = k
        return img
    out = clip_card(ct, "fiddle")
    ta = fade(ct, 1.2, 2.2, 11.0, 12.4)
    draw_text(out, "MARIEHAMN  ·  JULI 2025", 120, 150, name="sans_m", size=20, tracking=0.4, alpha=ta * 0.9, shadow=0.8)
    return out


@shot("pointer", CLIP_FIDDLE + 13.3, S("g1") + 0.6)
def _(t, lt, sh):
    img = paper(11).copy()
    x = lin(t, sh.t0, sh.t1)
    fg, _, _ = photo("pointer")
    z = 1 + 0.07 * ease_io(x, 1.3)
    w = int(1320 * z)
    src = film_tone(fg, 0.02, 0.92, 0.97)
    e = ease_out(lin(t, sh.t0, sh.t0 + 1.4))
    cx, cy = 960 - 20 * x, 540 + 14 * (1 - e)
    rot = -1.6 + 0.6 * x
    print_card(img, src, int(cx), int(cy), w, alpha=1.0, rot=rot)
    # spåra pekpinnen
    tp = Wt("f5", "pekpinnen") - 0.2
    pa = fade(t, tp, tp + 0.4, tp + 2.0, tp + 2.8)
    if pa > 0:
        h = w * fg.shape[0] / fg.shape[1]
        a0 = np.array([(330 / 960 - 0.5) * w, (540 / 548 - 0.5) * h])
        a1 = np.array([(832 / 960 - 0.5) * w, (192 / 548 - 0.5) * h])
        c, s_ = math.cos(math.radians(-rot)), math.sin(math.radians(-rot))
        R = np.array([[c, -s_], [s_, c]])
        p0, p1 = R @ a0 + (cx, cy), R @ a1 + (cx, cy)
        pr = ease_io(lin(t, tp, tp + 0.9))
        m = np.zeros((H, W), np.float32)
        poly_lines(m, [np.array([p0, p0 + (p1 - p0) * pr])], 3)
        glow_layer(img, m, AMBER, pa * 0.8, 1.0, 6)
    return img


# ==========================================================================
# VII. TEKNIKEN
# ==========================================================================
chapter("VII", "Tekniken", S("g1") - 0.1)
PH_C = (960, 560)


def bubble(c, text, y, t, t0, side="r", size=24, maxw=270, color=(0.16, 0.42, 0.92), zoom=1.0):
    a = smooth(lin(t, t0, t0 + 0.35))
    if a <= 0:
        return y
    lines = []
    cur = ""
    for w in text.split():
        cand = (cur + " " + w).strip()
        if text_width(cand, "sans", size) > maxw and cur:
            lines.append(cur)
            cur = w
        else:
            cur = cand
    lines.append(cur)
    tw = max(text_width(ln, "sans", size) for ln in lines)
    bw, bh = int(tw + 32), int(len(lines) * size * 1.3 + 22)
    x1 = SW - 16 if side == "r" else 16 + bw
    x0 = x1 - bw
    e = ease_out(lin(t, t0, t0 + 0.4))
    yy = y + 16 * (1 - e)
    m = art.rounded_rect_mask(x0, yy, x1, yy + bh, min(20, bh / 2), shape=(SHH, SW))
    over(c, np.asarray(color, np.float32), m * a, 0, 0)
    for i, ln in enumerate(lines):
        draw_text_small(c, ln, x0 + 16, yy + 16 + size * 0.95 + i * size * 1.3, size, color=(0.97, 0.97, 0.97),
                        anchor="l", name="sans", alpha=a)
    return y + bh + 12


def chat_screen(t):
    c = screen_canvas((0.035, 0.037, 0.042))
    # huvud
    hdr = np.zeros((SHH, SW), np.float32)
    hdr[:118] = 1
    over(c, np.array([0.07, 0.072, 0.08], np.float32), hdr, 0, 0)
    m = np.zeros((SHH, SW), np.float32)
    cv2.circle(m, (SW // 2, 62), 20, 1.0, -1, cv2.LINE_AA)
    over(c, np.array([0.55, 0.45, 0.32], np.float32), m, 0, 0)
    draw_text_small(c, "A", SW / 2, 70, 20, color=(0.1, 0.08, 0.06), name="sans_sb")
    draw_text_small(c, "Adam", SW / 2, 106, 16, color=(0.8, 0.8, 0.8))
    s3 = LINES["g3"]["sents"]
    y = 150
    y = bubble(c, "Hej Adam! Hur skickar man en bild?", y, t, s3[0][0] - 0.2)
    y = bubble(c, "Vart tog appen vägen?", y, t, s3[1][0] - 0.1)
    y = bubble(c, "Och varför är allt så STORT på skärmen??", y, t, s3[2][0] - 0.1)
    # "skriver..."
    tt = s3[2][0] + 1.2
    if t > tt:
        a = smooth(lin(t, tt, tt + 0.3))
        mm = art.rounded_rect_mask(16, y + 4, 96, y + 44, 20, shape=(SHH, SW))
        over(c, np.array([0.2, 0.2, 0.22], np.float32), mm * a, 0, 0)
        for k in range(3):
            v = 0.5 + 0.5 * math.sin(t * 7 - k * 0.8)
            md = np.zeros((SHH, SW), np.float32)
            cv2.circle(md, (36 + k * 20, y + 24), 5, 1.0, -1, cv2.LINE_AA)
            over(c, np.array([0.7, 0.7, 0.72], np.float32), md * a * (0.4 + 0.6 * v), 0, 0)
    return c


def call_screen(t, t0, connected=None):
    c = screen_canvas((0.05, 0.05, 0.06))
    yy = np.linspace(0, 1, SHH, dtype=np.float32)[:, None, None]
    c += (1 - yy) * np.array([0.12, 0.09, 0.05], np.float32)
    draw_text_small(c, "Adam", SW / 2, 170, 44, color=(0.96, 0.96, 0.96), name="sans_m")
    if connected is not None and t > connected:
        s = int(t - connected)
        sub = f"00:{s:02d}"
    else:
        sub = "ringer" + "." * (1 + int((t - t0) * 2.5) % 3)
    draw_text_small(c, sub, SW / 2, 214, 22, color=(0.75, 0.75, 0.75), name="sans")
    cy = 400
    for k in range(3):
        ph = ((t - t0) * 0.7 + k / 3) % 1.0
        m = np.zeros((SHH, SW), np.float32)
        cv2.circle(m, (SW // 2, cy), int(70 + 80 * ph), 1.0, 2, cv2.LINE_AA)
        over(c, np.array([0.85, 0.65, 0.4], np.float32), m * (1 - ph) * 0.6, 0, 0)
    m = np.zeros((SHH, SW), np.float32)
    cv2.circle(m, (SW // 2, cy), 66, 1.0, -1, cv2.LINE_AA)
    over(c, np.array([0.55, 0.45, 0.32], np.float32), m, 0, 0)
    draw_text_small(c, "A", SW / 2, cy + 22, 60, color=(0.1, 0.08, 0.06), name="sans_sb")
    col = (0.2, 0.75, 0.35) if connected is not None and t > connected else (0.85, 0.25, 0.25)
    m = np.zeros((SHH, SW), np.float32)
    cv2.circle(m, (SW // 2, SHH - 120), 38, 1.0, -1, cv2.LINE_AA)
    over(c, np.array(col, np.float32), m, 0, 0)
    return c


@shot("phone", S("g1") - 0.6, S("g6") + 0.2)
def _(t, lt, sh):
    img = paper(5).copy()
    e = ease_out(lin(t, sh.t0, sh.t0 + 1.4))
    s3 = LINES["g3"]["sents"]
    s4 = LINES["g4"]["sents"]
    s5 = LINES["g5"]["sents"]
    on = smooth(lin(t, S("g2") - 0.1, S("g2") + 0.5))
    t_call = s4[1][0] - 0.1
    if t < s3[0][0] - 0.8:
        scr = app_grid(t, 0.0) * on
    elif t < t_call:
        scr = chat_screen(t)
        # "allt är så stort": zooma in skärmen
        zt = Wt("g3", "stort")
        zz = 1 + 0.9 * smooth(lin(t, zt - 0.1, zt + 0.5)) * (1 - smooth(lin(t, s4[0][0] + 0.8, s4[0][0] + 1.3)))
        if zz > 1.001:
            M = cv2.getRotationMatrix2D((SW * 0.62, SHH * 0.36), 0, zz)
            scr = cv2.warpAffine(scr, M, (SW, SHH), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        k = smooth(lin(t, s3[0][0] - 0.8, s3[0][0] - 0.4))
        if k < 1:
            scr = app_grid(t, 0.0) * (1 - k) + scr * k
    else:
        scr = call_screen(t, t_call, connected=s5[0][0] + 0.3)
        k = smooth(lin(t, t_call, t_call + 0.4))
        if k < 1:
            scr = chat_screen(t) * (1 - k) + scr * k
    px = PH_C[0] - 260 * smooth(lin(t, s5[0][0] - 0.3, s5[0][0] + 0.9))
    phone_body(img, px, PH_C[1] + 80 * (1 - e), 420, 860, e, screen=scr, glow=0.3 * on)
    # etikett: teknikhjälp
    la = smooth(lin(t, Wt("g5", "teknikhjälp") - 0.3, Wt("g5", "teknikhjälp") + 0.6))
    if la > 0:
        x = 1080
        draw_text(img, "ADAM", x, 420, name="sans_m", size=26, tracking=0.42, alpha=la)
        draw_text(img, "personlig teknikhjälp", x, 468, name="serif_it", size=36, weight=400, alpha=la * 0.9)
        m = np.zeros((H, W), np.float32)
        poly_lines(m, [np.array([(x, 380), (x + 46 * la, 380)])], 1)
        over_color(img, AMBER, m * la)
    oa = smooth(lin(t, s5[1][0] - 0.1, s5[1][0] + 0.6))
    if oa > 0:
        draw_text(img, "24/7", 1080, 640, name="serif", size=150, weight=500, alpha=oa, dy=10 * (1 - oa))
        na = smooth(lin(t, s5[2][0] - 0.1, s5[2][0] + 0.3))
        if na > 0:
            draw_text(img, "*", 1080 + text_width("24/7", "serif", 150, 0, 500) + 8, 560, name="serif", size=90,
                      weight=500, alpha=na, color=AMBER)
            draw_text(img, "*nästan", 1084, 710, name="serif_it", size=34, weight=400, alpha=na, color=AMBER)
    return img


@shot("vacuum", S("g6") - 0.6, S("g7") + 0.4)
def _(t, lt, sh):
    x = lin(t, sh.t0, sh.t1)
    s6 = LINES["g6"]["sents"]
    look = lambda u: ease_io(lin(sh.t0 + u * (sh.t1 - sh.t0), s6[0][0] + 0.8, s6[1][0] + 1.6), 2.2)  # noqa: E731
    c0, c1 = (0.44, 0.33, 1.0), (0.62, 0.64, 1.32)
    par = (0.04, 0, 0)
    img = photo_frame("vacuum", x, c0, c1, par=par, look=look)
    img = film_tone(img, 0.02, 0.88, 0.92)
    tc = Wt("g6", "dammsugarpåsar") + 0.3
    ca = smooth(lin(t, tc, tc + 0.7))
    if ca > 0:
        p = photo_to_screen("vacuum", x, c0, c1, (1255 / 1500, 1420 / 2000), par=par, look=look)
        img *= 1 - 0.25 * ca
        e = ease_out(lin(t, tc, tc + 0.9))
        ring(img, p[0], p[1], 40, AMBER, alpha=ca, width=2)
        q = (p[0] - 300 * e, p[1] - 220 * e)
        m = np.zeros((H, W), np.float32)
        poly_lines(m, [np.array([(p[0] - 30, p[1] - 26), q, (q[0] - 40 * e, q[1])])], 1)
        over_color(img, INK, m * ca)
        draw_text(img, "C 1800", q[0] - 56, q[1] + 12, name="sans_m", size=34, tracking=0.12, anchor="r", alpha=ca,
                  shadow=1.0)
        draw_text(img, "4-pack + 1 filter", q[0] - 56, q[1] + 52, name="serif_it", size=30, weight=400, anchor="r",
                  alpha=ca * 0.9, shadow=1.0)
        ka = smooth(lin(t, Wt("g6", "precis") - 0.2, Wt("g6", "precis") + 0.4))
        if ka > 0:
            ck = np.array([(q[0] - 300, q[1] + 104), (q[0] - 288, q[1] + 116), (q[0] - 264, q[1] + 88)])
            mk = np.zeros((H, W), np.float32)
            poly_lines(mk, [partial_polyline(ck, ease_out(lin(t, Wt("g6", "precis") - 0.2, Wt("g6", "precis") + 0.3)))], 3)
            glow_layer(img, mk, AMBER, ka, 0.6, 4)
            draw_text(img, "RÄTT MODELL", q[0] - 56, q[1] + 116, name="sans_m", size=22, tracking=0.35, anchor="r",
                      alpha=ka, color=AMBER, shadow=1.0)
    return img


def stamp(img, cx, cy, t, t0, rot=-9):
    e = ease_in(lin(t, t0, t0 + 0.16), 2)
    if e <= 0:
        return img
    s = 1.5 - 0.5 * e
    a = e
    w, h = 470, 130
    lay = np.zeros((H, W), np.float32)
    x0, y0 = cx - w / 2, cy - h / 2
    outer = art.rounded_rect_mask(x0, y0, x0 + w, y0 + h, 16)
    inner = art.rounded_rect_mask(x0 + 8, y0 + 8, x0 + w - 8, y0 + h - 8, 10)
    lay += np.clip(outer - inner, 0, 1)
    from film.common import text_mask
    tm, base, tw, pad = text_mask("HEMLIGT", "sans_sb", 84, 0.14)
    th, twid = tm.shape
    tx, ty = int(cx - tw / 2 - pad), int(cy - base + 30)
    lay[ty:ty + th, tx:tx + twid] = np.maximum(lay[ty:ty + th, tx:tx + twid], tm)
    M = cv2.getRotationMatrix2D((cx, cy), rot, s)
    lay = cv2.warpAffine(lay, M, (W, H))
    from film.common import value_noise
    grit = np.clip(0.55 + value_noise(H, W, 6, 9, 2) * 0.9, 0, 1)
    over_color(img, (0.72, 0.1, 0.08), lay * grit * a * 0.92)
    return img


@shot("secret", S("g7") - 0.5, CLIP_SHH + 0.35)
def _(t, lt, sh):
    img = paper(12, (0.05, 0.045, 0.04)).copy()
    e = ease_out(lin(t, sh.t0, sh.t0 + 1.2))
    rect_ = (560, 150 + 30 * (1 - e), 800, 800)
    D.paper_sheet(img, rect_, alpha=e, tone=(0.82, 0.76, 0.62), seed=6, rot=0.025)
    ink = np.array([0.12, 0.1, 0.09], np.float32)
    lines = [("PROJEKT: DENNIS", S("g7") + 0.1), ("Film, ca 7 minuter", S("g7") + 0.8),
             ("Regi: Adam", LINES["g7"]["sents"][1][0] + 0.2), ("Status: överraskning", LINES["g7"]["sents"][1][0] + 1.4)]
    for i, (ln, t0) in enumerate(lines):
        n = int(len(ln) * clamp01((t - t0) / 0.9))
        if n > 0:
            draw_text(img, ln[:n], 640, 300 + 30 * (1 - e) + i * 70, name="mono_r", size=34 if i == 0 else 30,
                      tracking=0.02, color=ink, alpha=e)
    m = np.zeros((H, W), np.float32)
    poly_lines(m, [np.array([(640, 330 + 30 * (1 - e)), (1280, 330 + 30 * (1 - e))])], 1)
    over_color(img, ink, m * 0.5 * e)
    ts = LINES["g7"]["sents"][2][0] + 0.9
    stamp(img, 960, 700, t, ts)
    # liten skakning vid stämpeln
    if ts < t < ts + 0.25:
        k = (1 - lin(t, ts, ts + 0.25)) * 6
        img = np.roll(img, int(k * math.sin(t * 120)), axis=0)
    return img


@shot("shh", CLIP_SHH, S("h1") + 0.3)
def _(t, lt, sh):
    ct = t - CLIP_SHH
    n = clip_count("shh")
    img = clip_card(min(ct, (n - 1) / 25.0), "shh")
    return img


# ==========================================================================
# VIII. JULIUS
# ==========================================================================
chapter("VIII", "Julius", S("h1") - 0.1)


@functools.lru_cache(maxsize=2)
def facade(s=1.0):
    return art.cafe_facade(960, 960, 0.95 * s)


@functools.lru_cache(maxsize=1)
def dusk_bg():
    img = D.ink_paper(tint=(0.03, 0.04, 0.06), seed=13)
    yy = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    img += (1 - yy) * np.array([0.02, 0.03, 0.06], np.float32)
    return img


def cafe_scene(t, t_draw0, t_draw1, t_light, t_sign, silhouettes=None, zoom=1.0, focus=(960, 600), chair=None):
    img = dusk_bg().copy()
    d, wins, sign = facade()
    la = smooth(lin(t, t_light, t_light + 1.2))
    if la > 0:
        m = np.zeros((H, W), np.float32)
        for (x0, y0), (x1, y1) in wins:
            cv2.rectangle(m, (int(x0), int(y0)), (int(x1), int(y1)), 1.0, -1)
        fl = 0.94 + 0.06 * math.sin(t * 3.1) * math.sin(t * 1.7)
        img += m[..., None] * np.array([0.55, 0.36, 0.16], np.float32) * la * fl
        g = cv2.GaussianBlur(m, (0, 0), 50)
        img += g[..., None] * np.array([0.35, 0.22, 0.08], np.float32) * la * fl
        # ljus på marken
        gm = np.zeros((H, W), np.float32)
        for (x0, y0), (x1, y1) in wins:
            cv2.fillPoly(gm, [np.int32([(x0, 960), (x1, 960), (x1 + 120, 1080), (x0 - 120, 1080)])], 1.0)
        gm = cv2.GaussianBlur(gm, (0, 0), 30)
        img += gm[..., None] * np.array([0.2, 0.12, 0.04], np.float32) * la * fl
    if silhouettes is not None:
        sa = smooth(lin(t, silhouettes, silhouettes + 1.0))
        if sa > 0:
            ms = np.zeros((H, W), np.float32)
            (x0, y0), (x1, y1) = wins[0]
            person(ms, x0 + 90, y1 + 2, 3.2, 1.0)
            person(ms, x0 + 200, y1 + 2, 2.1, 1.0)
            (x0, y0), (x1, y1) = wins[1]
            person(ms, x0 + 110, y1 + 2, 2.0, 1.0)
            ms = np.minimum(ms, 1)
            over_color(img, (0.05, 0.035, 0.025), ms * sa * 0.92)
    d.render(img, ease_io(lin(t, t_draw0, t_draw1), 1.3), glow=0.25)
    sa = smooth(lin(t, t_sign, t_sign + 1.0))
    if sa > 0:
        lay = np.zeros((H, W, 3), np.float32)
        draw_text(lay, "Julius", sign[0], sign[1] + 4, name="serif_it", size=64, weight=600, anchor="c",
                  color=WARM, alpha=1.0)
        fl = 0.96 + 0.04 * math.sin(t * 13) * (math.sin(t * 2.3) > 0.9)
        img += lay * sa * fl
        img += cv2.GaussianBlur(lay, (0, 0), 12) * 0.9 * sa * fl
        draw_text(img, "CAFÉ", sign[0], sign[1] + 40, name="sans_m", size=16, tracking=0.6, anchor="c",
                  alpha=sa * 0.8, color=INK)
    if chair is not None:
        ca = smooth(lin(t, chair, chair + 1.0))
        if ca > 0:
            cd = bistro_chair()
            cd.render(img, ease_io(lin(t, chair, chair + 1.6)), glow=0.4)
    if zoom != 1.0:
        M = cv2.getRotationMatrix2D(focus, 0, zoom)
        img = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    return img


@functools.lru_cache(maxsize=1)
def bistro_chair():
    d = D.Drawing()
    X = lambda p: np.asarray(p, float) * 1.1 + np.array([1410, 958])  # noqa: E731
    d.add(X(catmull([(-30, -190), (-34, -150), (-30, -100)], 6)), 2.0, WARM, 1.0, 0)
    d.add(X(catmull([(30, -190), (34, -150), (30, -100)], 6)), 2.0, WARM, 1.0, 0)
    d.add(X(catmull([(-30, -190), (0, -200), (30, -190)], 6)), 2.0, WARM, 1.0, 0)
    d.add(X(catmull([(-30, -160), (0, -168), (30, -160)], 6)), 1.4, WARM, 0.8, 0)
    d.add(X(D.line((-40, -100), (40, -100))), 2.2, WARM, 1.0, 0)
    d.add(X(D.line((-36, -100), (-44, 0))), 2.0, WARM, 1.0, 0)
    d.add(X(D.line((36, -100), (44, 0))), 2.0, WARM, 1.0, 0)
    d.add(X(D.line((-40, -50), (40, -50))), 1.2, WARM, 0.7, 0)
    return d


@shot("cafe", S("h1") - 1.2, S("h3") + 0.5)
def _(t, lt, sh):
    x = lin(t, sh.t0, sh.t1)
    return cafe_scene(t, sh.t0 + 0.2, sh.t0 + 3.4, sh.t0 + 2.6, Wt("h2", "Julius") - 0.2,
                      silhouettes=S("h2") + 2.2, zoom=1 + 0.06 * ease_io(x), focus=(960, 700))


@functools.lru_cache(maxsize=1)
def table():
    return art.table_top(960, 560, 1.05)


@shot("cups", S("h3") - 0.3, S("h4") + 0.6)
def _(t, lt, sh):
    img = paper(14, (0.045, 0.035, 0.03)).copy()
    d, cups = table()
    s3 = LINES["h3"]["sents"]
    gp = {0: ease_io(lin(t, sh.t0, sh.t0 + 1.5))}
    for i in range(6):
        gp[1 + i] = ease_io(lin(t, s3[0][0] + 0.2 + i * 0.25, s3[0][0] + 1.0 + i * 0.25))
    gp[6] = ease_io(lin(t, Wt("h3", "sött") - 0.4, Wt("h3", "sött") + 0.8))
    zz = 1 + 0.05 * ease_io(lin(t, sh.t0, sh.t1))
    d.render(img, 0.0, group_progress=gp, glow=0.3, scale=zz, offset=(960 * (1 - zz), 560 * (1 - zz)))
    # ånga
    m = np.zeros((H, W), np.float32)
    for i, ((cx, cy), r) in enumerate(cups):
        a = smooth(lin(t, s3[0][0] + 1.0 + i * 0.25, s3[0][0] + 2.0 + i * 0.25))
        if a <= 0:
            continue
        cx, cy = 960 + (cx - 960) * zz, 560 + (cy - 560) * zz
        for k in range(2):
            ys = np.linspace(0, 1, 30)
            pts = np.stack([cx + (k * 14 - 7) + 10 * np.sin(ys * 6 + t * 2 + i + k) * ys,
                            cy - 20 - ys * 110], 1)
            poly_lines(m, [pts], 2, value=a * 0.5)
    m = cv2.GaussianBlur(m, (0, 0), 2.0)
    over_color(img, INK, m * 0.7)
    return img


@shot("cafe_photo", S("h4") - 0.5, S("i1") - 0.2, fout=1.0)
def _(t, lt, sh):
    x = lin(t, sh.t0, sh.t1)
    img = photo_frame("cafe", x, (0.49, 0.405, 1.0), (0.47, 0.37, 1.2), par=(0.05, 0, 0))
    img = film_tone(img, 0.02, 0.9, 0.92)
    return img


# ==========================================================================
# EPILOG
# ==========================================================================
@overlay(S("i1") - 0.2, S("i1") + 4.2)
def _(img, t):
    t0 = S("i1") - 0.2
    a = fade(t, t0, t0 + 1.0, t0 + 3.3, t0 + 4.4)
    reveal_text(img, "EPILOG", 120, 146, t - t0 - 0.2, dur=1.0, stagger=0.05, name="sans_m", size=22,
                tracking=0.38, alpha=a, color=INK, rise=6)
    return img


@shot("epi_line", S("i1") - 1.0, S("i2") + 0.3)
def _(t, lt, sh):
    img = paper(8).copy()
    s1 = LINES["i1"]["sents"]
    sh_x = 520 * ease_io(lin(t, s1[1][0] - 0.2, sh.t1 + 0.5), 1.8)
    life_line(img, t, sh.t0 - 10, sh.t0 - 5, cont0=s1[1][0] - 0.1, cont1=s1[1][1] + 1.2, shift=sh_x)
    return img


@functools.lru_cache(maxsize=1)
def epi_violin():
    d = D.Drawing()
    art.violin(d, 440, 520, 0.44, group=0)
    return d


@shot("epi_trip", S("i2") - 0.3, S("i3") + 0.4)
def _(t, lt, sh):
    img = paper(15).copy()
    s2 = LINES["i2"]["sents"]
    epi_violin().render(img, 0.0, group_progress={0: ease_io(lin(t, s2[0][0] - 0.2, s2[0][0] + 1.6))}, glow=0.3)
    m = np.zeros((H, W), np.float32)
    a2 = smooth(lin(t, s2[1][0] - 0.1, s2[1][0] + 0.6))
    if a2 > 0:
        art.shoe_print(m, 930, 540, 2.2, -4, a2)
        art.shoe_print(m, 1010, 556, 2.2, 5, a2, flip=True)
    over_color(img, INK, m * 0.9)
    mp = np.zeros((H, W), np.float32)
    for k in range(4):
        tk = s2[2][0] + k * 0.35
        v = smooth(lin(t, tk, tk + 0.25))
        if v > 0:
            paw(mp, 1400 + (k % 2) * 60, 700 - k * 110, 1.7, 8, v)
    glow_layer(img, mp, WARM, 0.95, 0.5, 5)
    for x, lbl, tt in ((440, "FIOLEN", s2[0][0]), (970, "LÖPARSKORNA", s2[1][0]), (1430, "NAPSO", s2[2][0])):
        a = smooth(lin(t, tt + 0.4, tt + 1.2))
        draw_text(img, lbl, x, 900, name="sans_m", size=22, tracking=0.42, alpha=a, anchor="c")
    for x in (700, 1200):
        dm = np.zeros((H, W), np.float32)
        poly_lines(dm, [np.array([(x, 300), (x, 900)])], 1)
        over_color(img, INK_DIM, dm * 0.25)
    return img


@shot("epi_cafe", S("i3") - 0.3, S("i4") + 0.2)
def _(t, lt, sh):
    x = lin(t, sh.t0, sh.t1)
    return cafe_scene(t, -10, -9, -10, -10, silhouettes=-10, zoom=1 + 0.18 * ease_io(x, 1.5), focus=(1330, 860),
                      chair=Wt("i3", "stol") - 0.2)


@shot("finale", S("i4") - 0.4, TOTAL)
def _(t, lt, sh):
    img = portrait_frame(t, sh.t0, TOTAL - 5, push=0.07)
    s5 = LINES["i5"]["sents"]
    s6 = LINES["i6"]["sents"]
    end = E("i6") + 3.2
    a_out = 1 - smooth(lin(t, end, end + 1.6))
    img *= a_out * 1.0 + 0.0
    title_block(img, t, S("i4") + 0.6, sub=None, y=H / 2 - 60, a_out=a_out)
    x, y = 150, H / 2 + 40
    words = [("Make", s5[0][0]), ("Pappa", s5[1][0]), ("Morfar och farfar", s5[2][0])]
    cx = x
    for i, (w, tw) in enumerate(words):
        a = smooth(lin(t, tw - 0.05, tw + 0.5)) * a_out
        draw_text(img, w, cx, y, name="serif_it", size=40, weight=400, alpha=a, dy=6 * (1 - a))
        cx += text_width(w, "serif_it", 40, 0, 400) + 22
        if i < 2:
            dot(img, cx - 11, y - 12, 2.4, AMBER, alpha=a)
            cx += 6
    a6 = smooth(lin(t, s6[0][0], s6[0][0] + 0.8)) * a_out
    if a6 > 0:
        draw_text(img, "Ålänning.", x, y + 80, name="serif_it", size=40, weight=500, alpha=a6, color=AMBER)
        a7 = smooth(lin(t, s6[1][0], s6[1][0] + 0.8)) * a_out
        draw_text(img, "Rakt igenom.", x + text_width("Ålänning. ", "serif_it", 40, 0, 500) + 6, y + 80,
                  name="serif_it", size=40, weight=500, alpha=a7, color=AMBER)
    # slutkort
    ea = fade(t, end + 1.4, end + 2.8, TOTAL - 1.8, TOTAL - 0.2)
    if ea > 0:
        draw_text(img, "Till Dennis", W / 2, H / 2 + 6, name="serif_it", size=64, weight=400, anchor="c", alpha=ea)
        m = np.zeros((H, W), np.float32)
        ln = 60 * ease_out(lin(t, end + 1.8, end + 3.2))
        poly_lines(m, [np.array([(W / 2 - ln, H / 2 + 44), (W / 2 + ln, H / 2 + 44)])], 1)
        over_color(img, AMBER, m * ea)
        a2 = fade(t, end + 2.4, end + 3.6, TOTAL - 1.8, TOTAL - 0.2)
        draw_text(img, "FRÅN ADAM", W / 2, H / 2 + 100, name="sans_m", size=20, tracking=0.5, anchor="c",
                  alpha=a2 * 0.85)
    return img
