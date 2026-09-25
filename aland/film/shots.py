# -*- coding: utf-8 -*-
"""Alla tagningar, synkade mot berättarrösten (build/timeline.json)."""
import functools
import json
import math
import os
import re

import cv2
import numpy as np

from . import drawings as D
from . import fx, geo, sat, sea
from .common import (AMBER, BLUE_FI, BUILD, H, INK, INK_DIM, LAND, RED, SEA,
                     W, arc_between, blank, clamp01, dashed, dot, draw_text,
                     ease_in, ease_io, ease_out, fade, fill_polys, lin, mix,
                     over_color, partial_polyline, point_at, poly_lines,
                     reveal_text, ring, smooth, smoother, text_width)
from .geo import Camera, project, zoom_path

TL = json.load(open(os.path.join(BUILD, "timeline.json"), encoding="utf-8"))
LINES = TL["lines"]
TOTAL = TL["total"]


def S(lid, k=0):
    return LINES[lid]["sents"][k][0]


def E(lid, k=-1):
    return LINES[lid]["sents"][k][1]


def _plain(text):
    rep = {"{arton}": "artonhundra", "{femtiofyra}": "femtiofyra", "{femtiosex}": "femtiosex",
           "{sextioett}": "sextioett", "{trettioatta}": "trettioåtta", "{attioatta}": "åttioåtta",
           "{mariehamn}": "Mariehamn", "{geneve}": "Genève", "{viktoriakorset}": "Viktoriakorset",
           "{alanningar}": "ålänningar", "{alanningarna}": "ålänningarna",
           "{demilitariserat}": "demilitariserat", "{ofreden}": "ofreden",
           "{alandsexemplet}": "Ålandsexemplet"}
    for k, v in rep.items():
        text = text.replace(k, v)
    return text


def Wt(lid, word, occ=0):
    """Uppskattad tid då ordet börjar (teckenproportionellt inom meningen)."""
    text = _plain(LINES[lid]["text"])
    sents = [p for p in re.split(r"(?<=[.!?])\s+", text.strip()) if p]
    n = 0
    for k, s in enumerate(sents):
        i = -1
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


def eur(lon, lat):
    return project("eur", lon, lat)


# --------------------------------------------------------------------------
# Lager (latladdade)
# --------------------------------------------------------------------------
@functools.lru_cache(maxsize=None)
def L_baltic_wide():
    return geo.MapLayers("utm", (-8, 50, 48, 73), detail="50m")


@functools.lru_cache(maxsize=None)
def L_baltic():
    return geo.MapLayers("utm", (8, 53, 36, 70), detail="10m")


@functools.lru_cache(maxsize=None)
def L_europe():
    return geo.MapLayers("eur", (-20, 32, 62, 76), detail="50m")


def baltic_layers(mpp):
    return L_baltic_wide() if mpp > 650 else L_baltic()


# --------------------------------------------------------------------------
# Hjälpare: text, bildtexter, nålar
# --------------------------------------------------------------------------
def caption(img, t, t0, t1, text, sub=None, x=120, y=H - 250, size=26, align="l"):
    a = fade(t, t0, t0 + 0.9, t1 - 0.8, t1)
    if a <= 0:
        return img
    rise = 8 * (1 - ease_out(lin(t, t0, t0 + 1.2)))
    ln = 46 * ease_out(lin(t, t0, t0 + 1.0))
    if align == "l":
        m = np.zeros((H, W), np.float32)
        poly_lines(m, [np.array([(x, y - size - 14), (x + ln, y - size - 14)])], 1)
        over_color(img, AMBER, m * a * 0.9)
        draw_text(img, text, x, y + rise, name="sans_m", size=size, tracking=0.12, alpha=a, color=INK)
        if sub:
            draw_text(img, sub, x, y + size + 12 + rise, name="serif_it", size=int(size * 1.1), weight=400,
                      tracking=0.02, alpha=a * 0.8, color=INK)
    else:
        draw_text(img, text, x, y + rise, name="sans_m", size=size, tracking=0.12, alpha=a, color=INK, anchor="c")
        if sub:
            draw_text(img, sub, x, y + size + 12 + rise, name="serif_it", size=int(size * 1.1), weight=400,
                      alpha=a * 0.8, color=INK, anchor="c")
    return img


def pin(img, x, y, label, t, t0, t1=1e9, side="r", sub=None, color=AMBER):
    a = fade(t, t0, t0 + 0.6, t1 - 0.6, t1)
    if a <= 0:
        return img
    e = ease_out(lin(t, t0, t0 + 0.8))
    # puls
    pr = (t - t0) % 2.2 / 2.2
    ring(img, x, y, 6 + 26 * ease_out(pr), color, alpha=a * (1 - pr) * 0.7, width=1.4)
    dot(img, x, y, 4.2, color, alpha=a, glow=0.5)
    ring(img, x, y, 9, color, alpha=a * 0.8, width=1.2)
    dx = 70 if side == "r" else -70
    m = np.zeros((H, W), np.float32)
    p1 = (x + (12 if side == "r" else -12), y)
    p2 = (x + dx * e, y - 34 * e)
    poly_lines(m, [np.array([p1, p2, (p2[0] + (30 if side == 'r' else -30) * e, p2[1])])], 1)
    over_color(img, INK, m * a * 0.8)
    anc = "l" if side == "r" else "r"
    lx = p2[0] + (40 if side == "r" else -40)
    draw_text(img, label, lx, p2[1] + 9, name="sans_m", size=30, tracking=0.06, alpha=a * e, anchor=anc, shadow=0.6)
    if sub:
        draw_text(img, sub, lx, p2[1] + 42, name="serif_it", size=28, weight=400, alpha=a * e * 0.85,
                  anchor=anc, shadow=0.6)
    return img


def big_year(img, text, t, t0, t1, x=W / 2, y=H / 2 + 60, size=200, color=INK, alpha=1.0, anchor="c"):
    a = fade(t, t0, t0 + 1.0, t1 - 0.9, t1) * alpha
    if a <= 0:
        return img
    e = ease_out(lin(t, t0, t0 + 1.6))
    draw_text(img, text, x, y + 14 * (1 - e), name="serif", size=size, weight=450, tracking=0.04,
              alpha=a, color=color, anchor=anchor, blur=2.0 * (1 - e))
    return img


def year_tag(img, text, t, t0, t1, x=W - 120, y=190, size=84):
    """Årtal i övre högra hörnet på kartor."""
    a = fade(t, t0, t0 + 0.9, t1 - 0.8, t1)
    if a <= 0:
        return img
    e = ease_out(lin(t, t0, t0 + 1.2))
    draw_text(img, text, x, y + 10 * (1 - e), name="serif", size=size, weight=500, tracking=0.03,
              alpha=a, color=INK, shadow=0.5, anchor="r")
    m = np.zeros((H, W), np.float32)
    poly_lines(m, [np.array([(x - 2, y + 26), (x - 2 - 120 * e, y + 26)])], 1)
    over_color(img, AMBER, m * a)
    return img


def smoke_bg(t, tint=(0.05, 0.055, 0.06), seed=1, density=0.5, speed=(14, -4)):
    img = blank(tint)
    sm = fx.smoke(t, speed=speed, seed=seed, density=density)
    img += sm[..., None] * np.array([0.05, 0.05, 0.055], np.float32)
    return img


def _valid_mask(cam, raw):
    """1 där mosaiken har data, mjukad kant."""
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
    m = cv2.resize(small, (W, H), interpolation=cv2.INTER_LINEAR)
    return np.clip(m, 0, 1)


def sat_img(cam, s=0.85, gain=1.0, gamma=1.0, tint=(1, 1, 1), interp=cv2.INTER_LINEAR):
    raw = sat.render(cam, interp=interp)
    img = sat.look(raw, sat=s, gain=gain, gamma=gamma, tint=tint)
    if cam.mpp > 25:
        vm = _valid_mask(cam, raw)
        if vm.min() < 0.999:
            under, lmask = geo.render_map(cam, baltic_layers(cam.mpp), border_alpha=0.0, coast_alpha=0.3)
            # matcha kartans hav mot satellitens hav i bilden
            luma = img @ np.array([0.2126, 0.7152, 0.0722], np.float32)
            sel = (vm > 0.98) & (luma < 0.09)
            if sel.sum() > 500:
                target = np.median(img[sel], axis=0)
                seasel = (lmask < 0.02)
                cur = np.median(under[seasel], axis=0) if seasel.sum() > 500 else target
                under = under * (target / np.maximum(cur, 1e-3))
            img = under + (img - under) * vm[..., None]
    return img


def mask_screen(mask, cam):
    pass


def land_outline_glow(img, lm, color, alpha, width=1):
    """Kontur av mask (t.ex. Åland) med glöd."""
    e = cv2.morphologyEx((lm > 0.5).astype(np.uint8), cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8)).astype(np.float32)
    g = cv2.GaussianBlur(e, (0, 0), 6)
    img += g[..., None] * np.asarray(color, np.float32) * alpha * 0.9
    over_color(img, color, e * alpha * 0.9)
    return img


def fill_mask(img, m, color, alpha):
    img += (np.asarray(color, np.float32) - img) * (m * alpha)[..., None]
    return img


# --------------------------------------------------------------------------
# Shot-ramverk
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
        return blank((0, 0, 0))
    if len(act) == 1:
        img = act[0].render(t)
    else:
        a, b = act[0], act[-1]
        x = smooth(lin(t, b.t0, a.t1))
        ia = a.render(t) if x < 0.999 else None
        ib = b.render(t) if x > 0.001 else None
        if ia is None:
            img = ib
        elif ib is None:
            img = ia
        else:
            img = ia * (1 - x) + ib * x
    for t0, t1, fn in OVERLAYS:
        if t0 <= t < t1:
            img = fn(img, t)
    return img


def chapter(num, title, t0, dur=4.2):
    @overlay(t0, t0 + dur)
    def _(img, t):
        a = fade(t, t0, t0 + 1.0, t0 + dur - 1.1, t0 + dur)
        x, y = 120, 150
        draw_text(img, num, x, y, name="serif_it", size=44, weight=400, alpha=a * 0.9, color=AMBER, shadow=0.5)
        nw = text_width(num, "serif_it", 44, 0, 400)
        reveal_text(img, title.upper(), x + nw + 26, y - 4, t - t0 - 0.25, dur=1.0, stagger=0.035,
                    name="sans_m", size=22, tracking=0.38, alpha=a, color=INK, rise=6)
        return img


# ==========================================================================
# KALL ÖPPNING
# ==========================================================================
ALAND_C = utm(20.02, 60.19)


@shot("map_open", 0.0, S("o2") + 0.9, fin=2.2)
def _(t, lt, sh):
    t_end = S("o2") + 0.9
    x = ease_io(lin(t, 1.0, t_end), 2.4)
    a = Camera(*utm(21.0, 59.0), 1500)
    b = Camera(*ALAND_C, 160)
    cam = zoom_path(a, b, x)
    Ls = baltic_layers(cam.mpp)
    img, lm = geo.render_map(cam, Ls, coast_alpha=0.5, border_alpha=0.35)
    la = 1 - smooth(lin(t, 7.6, 9.4))
    geo.label(img, cam, utm(19.6, 57.6), "Östersjön", "sea", alpha=fade(t, 2.2, 3.6, 99, 100) * la)
    geo.label(img, cam, utm(15.6, 62.4), "Sverige", "country", alpha=smooth(lin(t, Wt("o1", "Sverige") - 0.2, Wt("o1", "Sverige") + 1.0)) * la)
    geo.label(img, cam, utm(26.2, 62.6), "Finland", "country", alpha=smooth(lin(t, Wt("o1", "Finland") - 0.2, Wt("o1", "Finland") + 1.0)) * la)
    geo.label(img, cam, utm(33.5, 60.8), "Ryssland", "country", alpha=smooth(lin(t, 5.0, 6.5)) * la * 0.7)
    geo.label(img, cam, utm(25.2, 58.75), "Estland", "country", alpha=fade(t, 4.6, 5.8, 6.2, 7.2) * 0.6)
    # Åland markeras
    ha = smooth(lin(t, Wt("o1", "land") - 0.3, Wt("o1", "land") + 1.2))
    if ha > 0:
        am = geo.polys_mask(cam, Ls.country("ALD"))
        fill_mask(img, am, AMBER, 0.35 * ha)
        land_outline_glow(img, am, AMBER, ha * 0.8)
        p = cam.to_screen(ALAND_C)
        draw_text(img, "Åland", p[0] + 60, p[1] - 40, name="serif_it", size=34, weight=500,
                  alpha=ha * (1 - smooth(lin(t, 9.0, 10.2))), color=INK, shadow=0.7)
    return img


def _cloud_layer(img, t, alpha, seed=3, speed=(22, 6)):
    if alpha <= 0:
        return img
    c = fx.smoke(t, speed=speed, seed=seed, density=1.0)
    c = cv2.GaussianBlur(c, (0, 0), 6)
    sh = np.roll(c, (40, 60), (0, 1))
    img *= (1 - sh * 0.35 * alpha)[..., None]
    img += (np.array([0.75, 0.78, 0.8], np.float32) - img) * (c * 0.55 * alpha)[..., None]
    return img


@shot("sat_open", S("o2") - 0.3, E("o4") + 1.3, fout=1.6)
def _(t, lt, sh):
    t0, t1 = sh.t0, sh.t1
    x1 = ease_io(lin(t, t0, S("o3") + 0.5), 2.0)
    a = Camera(*ALAND_C, 160)
    b = Camera(*utm(19.98, 60.17), 62)
    c = Camera(*utm(19.97, 60.12), 30)
    if t < S("o3") + 0.5:
        cam = zoom_path(a, b, x1)
    else:
        cam = zoom_path(b, c, ease_io(lin(t, S("o3") + 0.5, t1), 1.6))
    img = sat_img(cam, s=0.8, gain=0.95)
    img = _cloud_layer(img, t, 0.9 * (1 - smooth(lin(t, S("o2") + 1.5, S("o3") + 1.0))))
    # koordinater
    ca = fade(t, S("o2") + 1.2, S("o2") + 2.2, S("o3") + 2.5, S("o3") + 3.5)
    if ca > 0:
        draw_text(img, "60°12′ N   20°01′ E", 120, H - 250, name="mono", size=24, tracking=0.1,
                  alpha=ca * 0.8, color=INK)
        draw_text(img, "ÅLAND", 120, H - 290, name="sans_m", size=22, tracking=0.4, alpha=ca * 0.9, color=INK)
    return img


@shot("title", E("o4") + 0.9, S("a1") - 0.1, fin=0.0, fout=0.9)
def _(t, lt, sh):
    img = smoke_bg(t, seed=2, density=0.6)
    d = sh.t1 - sh.t0
    a = fade(lt, 0.3, 1.5, d, d + 1)
    e = ease_out(lin(lt, 0.3, 2.4))
    s = 1.0 + 0.02 * lt / d
    draw_text(img, "ÅLAND", W / 2, H / 2 + 30, name="serif", size=int(150), weight=500, tracking=0.42,
              alpha=a, color=INK, anchor="c", blur=3 * (1 - e))
    a2 = fade(lt, 1.1, 2.2, d, d + 1)
    draw_text(img, "Mellan två riken", W / 2, H / 2 + 110, name="serif_it", size=40, weight=400,
              tracking=0.06, alpha=a2 * 0.85, color=INK, anchor="c")
    m = np.zeros((H, W), np.float32)
    ln = 90 * ease_out(lin(lt, 1.2, 2.6))
    poly_lines(m, [np.array([(W / 2 - ln, H / 2 + 62), (W / 2 + ln, H / 2 + 62)])], 1)
    over_color(img, AMBER, m * a2)
    return img


# ==========================================================================
# I. UR HAVET
# ==========================================================================
chapter("I", "Ur havet", S("a1") + 0.4)

RISE_CAM = (utm(20.0, 60.17), 58, 50)


@functools.lru_cache(maxsize=4)
def _elev_view(cx, cy, mpp):
    cam = Camera(cx, cy, mpp)
    e = sat.render(cam, kind="elev")
    return e


@shot("ice_rise", S("a1") - 0.5, S("a3") + 0.6, fin=0.8)
def _(t, lt, sh):
    x = lin(t, sh.t0, sh.t1)
    c, m0, m1 = RISE_CAM
    cam = Camera(c[0], c[1], mix(m0, m1, ease_io(x, 2)))
    base = sat_img(cam, s=0.8, gain=0.95)
    land = sat.render(cam, kind="land").astype(np.float32) / 255.0 if False else None
    elev = sat.render(cam, kind="elev")
    emax = 55.0
    # landhöjning: tröskel sjunker
    rise = ease_io(lin(t, S("a2") + 1.4, E("a2") + 0.9), 1.6)
    thr = emax * (1 - rise) + 0.0
    if rise <= 0:
        thr = 1e9
    wet = np.clip((elev - thr) * 1.6 + 0.5, 0, 1)
    dry = wet * (elev > 0.2)
    deep = np.array([0.018, 0.035, 0.05], np.float32)
    shallow = np.array([0.05, 0.11, 0.12], np.float32)
    depth = np.clip(elev / max(thr, 1e-3), 0, 1) if thr < 1e8 else np.zeros_like(elev)
    water = deep[None, None, :] + (shallow - deep)[None, None, :] * (depth ** 2)[..., None] * rise
    img = water + (base - water) * dry[..., None]
    # strandlinje
    rim = np.clip(1 - np.abs(elev - thr) * 0.9, 0, 1) * (rise > 0) * (rise < 0.999)
    img += rim[..., None] * np.array([0.35, 0.45, 0.45], np.float32) * 0.5
    # is (med landskapet svagt genomlysande)
    cover = 1 - ease_io(lin(t, S("a2") - 0.1, S("a2") + 2.6), 1.5)
    if cover > 0:
        ghost = base.mean(2, keepdims=True)
        img = fx.ice_over(img, cover)
        img = img - (0.12 - ghost) * 0.25 * smooth(cover)
    
    # årtalsräknare
    a = fade(t, S("a1") + 0.8, S("a1") + 1.8, sh.t1 - 0.8, sh.t1)
    if a > 0:
        yrs = int(round((1 - rise) * 10000 / 100.0)) * 100
        num = "I dag" if rise >= 0.999 else f"{yrs:,}".replace(",", " ")
        draw_text(img, num, W - 120, H - 250, name="serif", size=64, weight=500, anchor="r", alpha=a, shadow=1.0)
        if rise < 0.999:
            draw_text(img, "ÅR SEDAN", W - 120, H - 208, name="sans_m", size=18, tracking=0.35, anchor="r",
                      alpha=a * 0.8, shadow=1.0)
    return img


SHORE_C = utm(19.595, 60.205)


@shot("shore", S("a3") - 0.2, E("a3") + 0.8)
def _(t, lt, sh):
    x = lin(t, sh.t0, sh.t1)
    cam = Camera(SHORE_C[0] + 400 * x, SHORE_C[1] - 150 * x, mix(11, 8.5, ease_io(x)))
    img = sat_img(cam, s=0.85, gain=1.0, interp=cv2.INTER_CUBIC)
    # strandlinjen kryper utåt (landhöjning)
    lm = sat.render(cam, kind="land", interp=cv2.INTER_LINEAR)
    lm = (lm > 0.5).astype(np.uint8)
    k = 1 + int(3 * ease_io(lin(t, S("a3", 1), E("a3"))))
    grown = cv2.dilate(lm, np.ones((2 * k + 1, 2 * k + 1), np.uint8))
    band = (grown - lm).astype(np.float32)
    band = cv2.GaussianBlur(band, (0, 0), 1.2)
    pa = smooth(lin(t, S("a3", 1) - 0.2, S("a3", 1) + 0.8)) * (0.6 + 0.4 * math.sin(t * 3))
    img += band[..., None] * np.array([0.45, 0.42, 0.34], np.float32) * pa * 0.5
    caption(img, t, S("a3", 1), sh.t1 + 0.4, "LANDHÖJNING", "några millimeter per år")
    return img


@shot("petro", S("a4") - 0.5, E("a4") + 0.5)
def _(t, lt, sh):
    img = fx.granite().copy()
    strokes = fx.petroglyphs()
    prog = {0: ease_io(lin(t, S("a4") + 0.3, S("a4", 1) + 0.6)),
            2: ease_io(lin(t, S("a4", 1) - 0.2, S("a4", 1) + 1.2)),
            1: ease_io(lin(t, Wt("a4", "sälen") - 0.9, E("a4") + 0.1))}
    fx.draw_petroglyphs(img, strokes, prog, t)
    # långsam kamera
    s = 1.0 + 0.05 * lin(t, sh.t0, sh.t1)
    M = cv2.getRotationMatrix2D((W / 2, H / 2), 0, s)
    img = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    caption(img, t, S("a4") + 0.6, sh.t1 + 0.4, "STENÅLDERN", "ca 5000 f.Kr.")
    return img


SEA_DUSK = sea.SeaStyle(sky_top=np.array([0.02, 0.035, 0.06]), sky_hor=np.array([0.18, 0.21, 0.25]),
                        water=np.array([0.008, 0.016, 0.024]), sun_dir=np.array([0.3, 0.02, 1.0]),
                        sun_col=np.array([0.35, 0.3, 0.3]), sun_size=0.0, sun_glow=0.15, spec_pow=200,
                        spec=0.25, fog=np.array([0.14, 0.16, 0.19]), fog_dist=900, clouds=0.0)
WAVES_CALM = sea.Waves(n=30, seed=3, amp=0.28, wl=(0.5, 26), wind=0.4, spread=0.7)
WAVES_ROUGH = sea.Waves(n=30, seed=3, amp=0.9, wl=(0.5, 26), wind=0.4, spread=0.6, chop=1.2)


def _sky_streaks(img, t, hy, color, alpha, seed=4, speed=6.0):
    """Horisontella molnband ovanför horisonten."""
    tex = fx._smoke_tex(seed)
    band = tex[100:100 + H, :W]
    band = cv2.resize(band[::4, :], (W, H), interpolation=cv2.INTER_LINEAR)
    ox = int(t * speed) % 400
    band = np.roll(band, ox, 1)
    yy = np.arange(H, dtype=np.float32)[:, None]
    fadev = np.clip((hy - yy) / 60, 0, 1) * np.clip((yy - 0) / 300, 0.2, 1)
    m = np.clip((band - 0.45) * 2.2, 0, 1) * fadev * alpha
    img += (np.asarray(color, np.float32) - img) * m[..., None]
    return img


@shot("sea_dusk", E("a4") + 0.1, E("a5") + 1.7, fout=1.5)
def _(t, lt, sh):
    k = smooth(lin(t, S("a5", 1) - 0.3, E("a5") + 1.0))
    wv = WAVES_CALM
    img1 = sea.render_sea(t, SEA_DUSK, wv, cam_h=4.0, fov=46, pitch=3.0)
    if k > 0.01:
        img2 = sea.render_sea(t, SEA_DUSK, WAVES_ROUGH, cam_h=4.0, fov=46, pitch=3.0)
        img = img1 * (1 - k) + img2 * k
    else:
        img = img1
    hy = sea.horizon_y(46, 3.0)
    img = _sky_streaks(img, t, hy, (0.06, 0.07, 0.085), 0.8)
    img *= (1 - 0.35 * k)
    return img


# ==========================================================================
# II. KORS OCH KRONA
# ==========================================================================
chapter("II", "Kors och krona", S("b1") + 0.3)


def _route(pts_ll, proj=utm, n=12):
    p = np.array([proj(lo, la) for lo, la in pts_ll])
    from .common import catmull
    return catmull(p, n)


VIKING = _route([(17.55, 59.33), (18.6, 59.75), (19.4, 60.05), (20.3, 60.12), (21.4, 60.18),
                 (22.2, 60.0), (23.6, 59.95), (25.0, 60.05), (27.0, 60.15), (28.7, 60.05),
                 (30.0, 59.95), (31.2, 60.4), (32.3, 60.05), (31.8, 59.3), (31.27, 58.6)])


@shot("viking", S("b1") - 0.7, E("b1") + 0.5, fin=0.9)
def _(t, lt, sh):
    x = lin(t, sh.t0, sh.t1)
    cam = Camera(*utm(24.5 + 0.8 * x, 59.4), mix(820, 760, x))
    img, lm = geo.render_map(cam, baltic_layers(cam.mpp), border_alpha=0.3)
    geo.label(img, cam, utm(15.8, 61.6), "Sverige", "country", alpha=0.7)
    geo.label(img, cam, utm(26.5, 62.3), "Finland", "country", alpha=0.7)
    pr = ease_io(lin(t, S("b1") + 0.2, E("b1") + 0.2), 1.6)
    scr = cam.to_screen(VIKING)
    m = np.zeros((H, W), np.float32)
    part = partial_polyline(scr, pr)
    for seg in dashed(part, 12, 8):
        poly_lines(m, [seg], 2)
    glow = cv2.GaussianBlur(m, (0, 0), 4)
    img += glow[..., None] * AMBER * 0.6
    over_color(img, AMBER, m)
    if 0 < pr < 1:
        p = part[-1]
        dot(img, p[0], p[1], 4, AMBER, glow=1.0)
    for nm, lo, la, tt, side in (("Birka", 17.545, 59.335, S("b1"), "l"), ("Novgorod", 31.27, 58.52, E("b1") - 0.4, "r")):
        p = cam.to_screen(utm(lo, la))
        a = smooth(lin(t, tt, tt + 0.8))
        dot(img, p[0], p[1], 4, INK, alpha=a)
        draw_text(img, nm, p[0] + (16 if side == "r" else -16), p[1] + 8, name="sans", size=24, anchor="l" if side == "r" else "r",
                  alpha=a * 0.9, shadow=0.5)
    pa = cam.to_screen(ALAND_C)
    dot(img, pa[0], pa[1], 5, AMBER, alpha=smooth(lin(t, S("b1") + 0.8, S("b1") + 1.5)), glow=0.8)
    op = cam.to_screen(utm(26.0, 59.55))
    draw_text(img, "Österled", op[0], op[1] + 50, name="serif_it", size=40, weight=400, tracking=0.08,
              anchor="c", alpha=smooth(lin(t, E("b1") - 1.3, E("b1") - 0.3)) * 0.9, color=INK)
    caption(img, t, S("b1") + 0.4, sh.t1 + 0.3, "VIKINGATIDEN", "ca 800–1050")
    return img


@functools.lru_cache(maxsize=1)
def _grave_points():
    """Punkter på land (UTM) inom huvudöns område."""
    rng = np.random.default_rng(12)
    lm = sat.level(2, "land")
    r = sat.RES[2]
    pts = []
    c = utm(19.98, 60.2)
    while len(pts) < 340:
        x = c[0] + rng.uniform(-30000, 30000)
        y = c[1] + rng.uniform(-22000, 20000)
        col, row = sat.world_to_px(x, y, 2)
        ci, ri = int(col), int(row)
        if 0 <= ri < lm.shape[0] and 0 <= ci < lm.shape[1] and lm[ri, ci] > 200:
            pts.append((x, y, rng.random()))
    return pts


@shot("graves", S("b2") - 0.5, E("b2") + 0.5)
def _(t, lt, sh):
    x = lin(t, sh.t0, sh.t1)
    cam = Camera(*utm(19.99, 60.2), mix(40, 34, ease_io(x)))
    img = sat_img(cam, s=0.35, gain=0.5)
    ta, tb = S("b2") + 0.3, E("b2") - 0.2
    for (px, py, r) in _grave_points():
        ts = ta + (tb - ta) * r
        if t < ts:
            continue
        p = cam.to_screen((px, py))
        if not (-10 < p[0] < W + 10 and -10 < p[1] < H + 10):
            continue
        e = ease_out(lin(t, ts, ts + 0.5))
        dot(img, p[0], p[1], 2.0 * e + 0.3, AMBER, alpha=0.9, glow=0.6)
        if e < 1:
            ring(img, p[0], p[1], 3 + 10 * e, AMBER, alpha=(1 - e) * 0.8, width=1.0)
    caption(img, t, S("b2") + 0.5, sh.t1 + 0.3, "GRAVFÄLT", "järnåldern, 500 f.Kr.–1050 e.Kr.")
    return img


@shot("church", S("b3") - 0.4, E("b3") + 0.4)
def _(t, lt, sh):
    img = D.ink_paper(seed=3)
    d = _church()
    p = ease_io(lin(t, S("b3") - 0.2, E("b3") - 0.2), 1.3)
    s = 1.0 + 0.04 * lin(t, sh.t0, sh.t1)
    d.render(img, p, glow=0.3)
    if s != 1.0:
        M = cv2.getRotationMatrix2D((W / 2, H / 2 + 100), 0, s)
        img = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    caption(img, t, S("b3") + 1.0, sh.t1 + 0.3, "JOMALA KYRKA", "en av Finlands äldsta stenkyrkor")
    return img


@functools.lru_cache(maxsize=1)
def _church():
    return D.church(1000, 880, 1.0)


@functools.lru_cache(maxsize=1)
def _castle():
    return D.castle(980, 760, 0.95)


@functools.lru_cache(maxsize=1)
def _crowns():
    return D.three_crowns(980, 170, 0.75)


@shot("kastelholm", S("b4") - 0.4, E("b4") + 1.1, fout=1.0)
def _(t, lt, sh):
    img = D.ink_paper(seed=4)
    p = ease_io(lin(t, S("b4") + 0.2, S("b4", 1) + 0.4), 1.3)
    _castle().render(img, p, glow=0.3)
    cp = ease_io(lin(t, S("b4", 1) + 0.2, E("b4") - 0.4))
    if cp > 0:
        _crowns().render(img, cp, glow=0.6)
    # årtal
    ya = fade(t, S("b4") - 0.1, S("b4") + 0.8, S("b4", 1) - 0.4, S("b4", 1) + 0.4)
    draw_text(img, "1388", 150, 300, name="serif", size=150, weight=450, tracking=0.03, alpha=ya,
              color=INK, blur=2 * (1 - ease_out(lin(t, S("b4"), S("b4") + 1.5))))
    caption(img, t, S("b4") + 1.2, sh.t1 + 0.3, "KASTELHOLMS SLOTT", "först omnämnt 1388")
    return img


# ==========================================================================
# III. POSTRODDEN
# ==========================================================================
chapter("III", "Postrodden", S("c1") + 0.3)

MAIL_LAND = [(18.07, 59.33), (18.35, 59.55), (18.62, 59.85), (18.817, 60.10)]
MAIL_SEA = [(18.817, 60.10), (19.05, 60.14), (19.3, 60.18), (19.572, 60.223)]
MAIL_REST = [(19.572, 60.223), (19.8, 60.2), (20.08, 60.23), (20.37, 60.24), (20.6, 60.25),
             (20.78, 60.26), (21.1, 60.3), (21.5, 60.36), (21.9, 60.42), (22.2666, 60.4518)]


def _land_detail(img, cam, color, alpha=1.0):
    """Lägg satellitens landmask (detalj för Åland och skärgården) över kartan."""
    if cam.mpp > 700:
        return img
    lm = sat.render(cam, kind="land")
    if lm.ndim == 3:
        lm = lm[..., 0]
    lm = np.clip((lm - 0.35) * 3.5, 0, 1)
    img += (np.asarray(color, np.float32)[None, None, :] + geo.land_texture() - img) * (lm * alpha)[..., None]
    return img


@shot("mail_map", S("c1") - 0.7, E("c1") + 0.5, fin=0.9)
def _(t, lt, sh):
    x = lin(t, sh.t0, sh.t1)
    cam = Camera(*utm(20.15, 59.95), mix(300, 270, ease_io(x)))
    img, lm = geo.render_map(cam, baltic_layers(cam.mpp), border_alpha=0.0)
    _land_detail(img, cam, LAND)
    year_tag(img, "1638", t, S("c1") - 0.1, sh.t1 + 0.5)
    r1 = cam.to_screen(_route(MAIL_LAND))
    r2 = cam.to_screen(_route(MAIL_SEA))
    r3 = cam.to_screen(_route(MAIL_REST))
    t0 = S("c1") + 0.8
    p1 = ease_io(lin(t, t0, t0 + 1.2))
    p2 = ease_io(lin(t, t0 + 1.2, t0 + 2.4))
    p3 = ease_io(lin(t, t0 + 2.4, S("c1", 1) - 0.1))
    m = np.zeros((H, W), np.float32)
    for seg in dashed(partial_polyline(r1, p1), 3, 5):
        poly_lines(m, [seg], 2)
    over_color(img, INK, m * 0.7)
    hi = smooth(lin(t, S("c1", 1), S("c1", 1) + 0.8))
    m = np.zeros((H, W), np.float32)
    for seg in dashed(partial_polyline(r2, p2), 10, 7, offset=-t * 18):
        poly_lines(m, [seg], 2 + int(hi))
    g = cv2.GaussianBlur(m, (0, 0), 5)
    img += g[..., None] * AMBER * (0.5 + 1.2 * hi)
    over_color(img, AMBER, m)
    m = np.zeros((H, W), np.float32)
    for seg in dashed(partial_polyline(r3, p3), 10, 7):
        poly_lines(m, [seg], 2)
    over_color(img, AMBER, m * 0.8)
    for nm, lo, la, tt, side, dy in (("Stockholm", 18.07, 59.33, t0 - 0.4, "l", 8), ("Grisslehamn", 18.817, 60.10, t0 + 1.0, "l", 8),
                                     ("Eckerö", 19.572, 60.223, t0 + 2.2, "r", -12), ("Åbo", 22.2666, 60.4518, S("c1", 1) - 0.8, "r", 8)):
        p = cam.to_screen(utm(lo, la))
        a = smooth(lin(t, tt, tt + 0.7))
        dot(img, p[0], p[1], 4, INK, alpha=a)
        draw_text(img, nm, p[0] + (14 if side == "r" else -14), p[1] + dy, name="sans", size=24,
                  anchor="l" if side == "r" else "r", alpha=a * 0.9, shadow=0.6)
    hp = cam.to_screen(utm(19.18, 59.93))
    draw_text(img, "Ålands hav", hp[0], hp[1], name="serif_it", size=36, weight=400, tracking=0.08,
              anchor="c", alpha=hi * 0.9, color=np.array([0.6, 0.72, 0.78], np.float32))
    return img


STORM = sea.SeaStyle(sky_top=np.array([0.03, 0.035, 0.045]), sky_hor=np.array([0.17, 0.19, 0.21]),
                     water=np.array([0.01, 0.016, 0.02]), sun_dir=np.array([-0.3, 0.25, 1.0]),
                     sun_col=np.array([0.1, 0.1, 0.11]), sun_glow=0.08, spec_pow=30, spec=0.05,
                     fog=np.array([0.14, 0.155, 0.17]), fog_dist=150, clouds=0.0, foam=0.5)
WAVES_STORM = sea.Waves(n=30, seed=5, amp=1.1, wl=(0.6, 24), wind=0.8, spread=0.45, chop=1.1)
SNOW = fx.Snow(n=700, seed=2, wind=(-260, 140))


@functools.lru_cache(maxsize=1)
def _ice_floes():
    rng = np.random.default_rng(8)
    fl = []
    for _ in range(26):
        x = rng.uniform(-70, 70)
        z = rng.uniform(14, 150)
        r = rng.uniform(0.8, 3.2)
        n = rng.integers(6, 10)
        ang = np.sort(rng.uniform(0, 2 * np.pi, n))
        rr = r * rng.uniform(0.6, 1.0, n)
        fl.append((x, z, np.stack([np.cos(ang) * rr, np.sin(ang) * rr], 1), rng.uniform(0, 6)))
    return fl


def _rowers(img, t, u, v, ppm, roll, alpha, stroke_ph):
    polys = sea.place_polys(sea.rowboat_polys(), u, v, ppm, roll)
    m = np.zeros((H, W), np.float32)
    fill_polys(m, polys)
    # åror
    lines = []
    for i, x in enumerate([-2.2, -0.7, 0.8, 2.1]):
        a = math.sin(stroke_ph + i * 0.2) * 0.5
        hx, hy = x + 0.1, 0.95
        tx, ty = x - 1.4 * math.cos(a) - 0.2, -0.5 + 0.35 * math.sin(a)
        c, s = math.cos(roll), math.sin(roll)
        lines.append(np.array([(u + (hx * c - hy * s) * ppm, v - (hx * s + hy * c) * ppm),
                               (u + (tx * c - ty * s) * ppm, v - (tx * s + ty * c) * ppm)]))
    poly_lines(m, lines, max(1, int(ppm * 0.08)))
    over_color(img, np.array([0.012, 0.013, 0.016], np.float32), np.clip(m, 0, 1) * alpha)
    return img


@shot("storm", S("c2") - 0.6, E("c3") + 2.3, fout=1.6)
def _(t, lt, sh):
    ch, fov = 4.2, 50
    pitch = 5.5 + 0.8 * math.sin(t * 0.7)
    img = sea.render_sea(t, STORM, WAVES_STORM, cam_h=ch, fov=fov, pitch=pitch)
    hy = sea.horizon_y(fov, pitch)
    img = _sky_streaks(img, t, hy, (0.07, 0.075, 0.085), 1.0, seed=6, speed=30)
    # drivis
    m = np.zeros((H, W), np.float32)
    for (fxp, fz, shape, ph) in _ice_floes():
        z = fz - lt * 1.5
        if z < 8:
            continue
        hgt = WAVES_STORM.height_at(fxp, z, t)
        pts = []
        for px, pz in shape:
            u, v, ppm = sea.project_point(fxp + px, hgt, z + pz, ch, fov, pitch)
            pts.append((u, v))
        fill_polys(m, [np.array(pts)])
    fog_k = np.exp(-0.0)
    over_color(img, np.array([0.34, 0.37, 0.4], np.float32), m * 0.75)
    # båten
    bz = 42
    bx = -6 + lt * 0.8
    hgt = WAVES_STORM.height_at(bx, bz, t)
    h2 = WAVES_STORM.height_at(bx + 2, bz, t)
    roll = math.atan2(h2 - hgt, 2.0) * 0.8
    u, v, ppm = sea.project_point(bx, hgt - 0.3, bz, ch, fov, pitch)
    ba = 1 - smooth(lin(t, S("c3") - 0.2, E("c3") + 1.2))
    if ba > 0:
        _rowers(img, t, u, v, ppm, roll, ba, t * 2.6)
    # dimma som sväljer båten
    fog = smooth(lin(t, S("c3") - 0.5, E("c3") + 1.5))
    img += (np.array([0.13, 0.145, 0.16], np.float32) - img) * (0.35 * fog)
    SNOW.draw(img, t, alpha=0.55)
    caption(img, t, S("c2") + 0.3, S("c3") - 0.6, "POSTRODDEN", "1638–1910")
    return img


# ==========================================================================
# IV. OFREDEN
# ==========================================================================
chapter("IV", "Ofreden", S("d1") + 0.3)


@shot("y1714", S("d1") - 0.6, S("d2") + 0.2, fin=0.5)
def _(t, lt, sh):
    img = smoke_bg(t, tint=(0.04, 0.03, 0.03), seed=3, density=0.8)
    img += fx.smoke(t * 0.7, speed=(10, -8), seed=8, density=0.5)[..., None] * np.array([0.08, 0.02, 0.01], np.float32)
    big_year(img, "1714", t, S("d1") - 0.3, sh.t1 + 0.6, size=210)
    a = fade(t, S("d1") + 0.8, S("d1") + 1.8, sh.t1, sh.t1 + 1)
    draw_text(img, "STORA NORDISKA KRIGET", W / 2, H / 2 + 150, name="sans_m", size=22, tracking=0.4,
              anchor="c", alpha=a * 0.85, color=RED * 1.4)
    return img


def _flee_paths():
    rng = np.random.default_rng(3)
    paths = []
    for i in range(260):
        a = utm(19.95 + rng.normal(0, 0.18), 60.18 + rng.normal(0, 0.07))
        b = utm(18.55 + rng.normal(0, 0.25), 59.9 + rng.normal(0, 0.3))
        paths.append((arc_between(a, b, rng.uniform(-0.15, 0.15), 40), rng.random(), rng.uniform(0.9, 1.3)))
    return paths


FLEE = _flee_paths()


@shot("flight", S("d2") - 0.2, E("d2") + 0.5)
def _(t, lt, sh):
    x = lin(t, sh.t0, sh.t1)
    cam = Camera(*utm(19.55, 60.0), mix(250, 235, x))
    img, lm = geo.render_map(cam, baltic_layers(cam.mpp), border_alpha=0.0)
    _land_detail(img, cam, LAND)
    # ryska anfallspilar från öster
    for k, (a_, b_) in enumerate((((21.6, 60.35), (20.45, 60.22)), ((21.4, 60.05), (20.35, 60.07)), ((21.8, 60.6), (20.6, 60.35)))):
        pa, pb = cam.to_screen(utm(*a_)), cam.to_screen(utm(*b_))
        path = arc_between(pa, pb, 0.12, 40)
        pr = ease_io(lin(t, S("d2") + 0.1 + k * 0.25, S("d2") + 1.6 + k * 0.25))
        part = partial_polyline(path, pr)
        m = np.zeros((H, W), np.float32)
        poly_lines(m, [part], 3)
        if pr > 0.05:
            tip = part[-1]
            d = part[-1] - part[max(0, len(part) - 3)]
            d = d / (np.linalg.norm(d) + 1e-6)
            nrm = np.array([-d[1], d[0]])
            tri = np.array([tip + d * 14, tip - d * 6 + nrm * 9, tip - d * 6 - nrm * 9])
            fill_polys(m, [tri])
        g = cv2.GaussianBlur(m, (0, 0), 4)
        img += g[..., None] * RED * 0.8
        over_color(img, RED * 1.3, m)
    # flykt västerut
    tf = Wt("d2", "flydde") - 0.5
    m = np.zeros((H, W), np.float32)
    for path, r, spd in FLEE:
        ts = tf + r * 1.8
        u = clamp01((t - ts) / (2.6 / spd))
        if u <= 0:
            continue
        sp = cam.to_screen(path)
        p = point_at(sp, ease_io(u, 1.5))
        q = point_at(sp, max(0, ease_io(u, 1.5) - 0.05))
        poly_lines(m, [np.array([q, p])], 1, value=0.6)
        cv2.circle(m, (int(p[0]), int(p[1])), 1, 1.0, -1, cv2.LINE_AA)
    over_color(img, INK, np.clip(m, 0, 1) * 0.9)
    geo.label(img, cam, utm(18.3, 60.35), "Sverige", "country", alpha=smooth(lin(t, tf + 0.5, tf + 1.5)) * 0.8)
    return img


@functools.lru_cache(maxsize=1)
def _fire_spots_world():
    pts = _grave_points()
    rng = np.random.default_rng(5)
    idx = rng.choice(len(pts), 70, replace=False)
    return [(pts[i][0], pts[i][1], rng.random(), rng.uniform(1.5, 3.5)) for i in idx]


@shot("fires", S("d3") - 0.4, E("d4") + 0.6, fout=0.5)
def _(t, lt, sh):
    x = lin(t, sh.t0, sh.t1)
    cam = Camera(*utm(19.98, 60.19), mix(46, 40, ease_io(x)))
    img = sat_img(cam, s=0.3, gain=0.42)
    spots = []
    ta, tb = S("d3") + 0.1, S("d3", 1) + 0.6
    for (wx, wy, r, sz) in _fire_spots_world():
        p = cam.to_screen((wx, wy))
        spots.append((p[0], p[1], ta + (tb - ta) * r, sz))
    fx.fire_spots(img, spots, t, strength=0.9)
    sm = fx.smoke(t, speed=(30, -10), seed=4, density=0.8)
    img += (np.array([0.10, 0.08, 0.07], np.float32) - img) * (sm * 0.35 * smooth(lin(t, ta, tb)))[..., None]
    # årsräknare
    ca = fade(t, S("d3", 1) - 0.1, S("d3", 1) + 0.6, S("d4") - 0.2, S("d4") + 0.4)
    if ca > 0:
        yr = 1714 + int(7 * ease_io(lin(t, S("d3", 1), E("d3") + 0.2)))
        draw_text(img, str(yr), W - 120, 190, name="serif", size=84, weight=500, anchor="r", alpha=ca, shadow=0.6)
    # STORA OFREDEN
    oa = fade(t, S("d4") - 0.1, S("d4") + 0.8, sh.t1 - 0.5, sh.t1 + 0.4)
    if oa > 0:
        img *= (1 - 0.55 * oa)
        reveal_text(img, "STORA OFREDEN", W / 2, H / 2 + 20, t - S("d4") + 0.1, dur=1.1, stagger=0.05,
                    name="serif", size=96, weight=500, tracking=0.25, anchor="c", color=INK, alpha=oa)
        draw_text(img, "1714 – 1721", W / 2, H / 2 + 100, name="sans_m", size=26, tracking=0.35, anchor="c",
                  alpha=oa * smooth(lin(t, S("d4") + 0.5, S("d4") + 1.3)) * 0.85, color=RED * 1.5)
    return img


RUS_CODES = ("RUS", "EST", "LVA", "LTU", "BLR", "UKR")


@shot("russia1809", S("d6") - 0.5, E("d6") + 0.7, fin=0.6, fout=0.9)
def _(t, lt, sh):
    x = lin(t, sh.t0, sh.t1)
    zx = ease_io(lin(t, S("d6", 1) - 0.4, E("d6") + 0.6))
    a = Camera(*utm(22.5, 62.0), 1250)
    b = Camera(*utm(20.3, 60.4), 560)
    cam = zoom_path(a, b, zx * 0.8)
    Ls = baltic_layers(cam.mpp)
    img, lm = geo.render_map(cam, Ls, border_alpha=0.25)
    rus = geo.polys_mask(cam, Ls.country(*RUS_CODES))
    fill_mask(img, rus, RED, 0.35)
    # Finland + Åland färgas från öster
    fin = geo.polys_mask(cam, Ls.country("FIN", "ALD"))
    wp = ease_io(lin(t, S("d6") + 0.8, S("d6") + 3.2), 1.4)
    xs = np.arange(W, dtype=np.float32)
    edge = cam.to_screen(utm(33, 62))[0] - (cam.to_screen(utm(33, 62))[0] - cam.to_screen(utm(17, 62))[0]) * wp
    wipe = np.clip((xs - edge) / 60, 0, 1)[None, :]
    fill_mask(img, fin * wipe, RED, 0.35)
    ald = geo.polys_mask(cam, Ls.country("ALD"))
    ha = smooth(lin(t, S("d6", 1) - 0.2, S("d6", 1) + 0.6))
    if ha > 0:
        pulse = 0.6 + 0.4 * math.sin((t - S("d6", 1)) * 4)
        land_outline_glow(img, ald, RED * 1.6, ha * pulse)
    year_tag(img, "1809", t, S("d6") - 0.2, sh.t1 + 0.4)
    geo.label(img, cam, utm(15.8, 62.0), "Sverige", "country", alpha=0.85)
    geo.label(img, cam, utm(30.5, 62.3), "Ryska kejsardömet", "country", alpha=smooth(lin(t, S("d6") + 1.5, S("d6") + 2.5)))
    return img


# ==========================================================================
# V. BOMARSUND
# ==========================================================================
chapter("V", "Bomarsund", S("e1") + 0.3)
BOMAR = utm(20.2358, 60.2117)


@shot("bomar_sat", S("e1") - 0.7, S("e2") + 0.7, fin=0.7)
def _(t, lt, sh):
    x = ease_io(lin(t, sh.t0, sh.t1), 2.2)
    cam = zoom_path(Camera(*utm(20.1, 60.2), 48), Camera(*BOMAR, 8), x)
    img = sat_img(cam, s=0.75, gain=0.9, interp=cv2.INTER_CUBIC)
    p = cam.to_screen(BOMAR)
    pin(img, p[0], p[1], "Bomarsund", t, S("e1") + 0.2, sh.t1 + 1)
    return img


@functools.lru_cache(maxsize=1)
def _fort():
    return D.fortress_plan(900, 560, 0.9)


def _water_band(img, cx, s, alpha=1.0):
    """Tonad vattenyta mellan strandlinjerna i planritningen."""
    m = np.zeros((H, W), np.float32)
    pts_l = [(420, -470), (380, -300), (400, -150), (370, 20), (390, 180), (350, 340), (380, 480)]
    pts_r = [(560, -470), (530, -250), (560, -60), (520, 140), (560, 330), (530, 480)]
    from .common import catmull
    a = catmull(np.array(pts_l, float), 8)
    b = catmull(np.array(pts_r, float), 8)
    poly = np.vstack([a, b[::-1]]) * s + np.array(cx)
    fill_polys(m, [poly])
    over_color(img, np.array([0.06, 0.10, 0.13], np.float32), m * 0.8 * alpha)
    return img


@shot("fort", S("e2") - 0.3, E("e3") + 0.6)
def _(t, lt, sh):
    img = D.ink_paper(seed=6, grid=1.0, tint=(0.03, 0.04, 0.05))
    d, towers, center = _fort()
    _water_band(img, (900, 560), 0.9, smooth(lin(t, S("e2"), S("e2") + 1)))
    gp = {0: ease_io(lin(t, S("e2") - 0.2, S("e2") + 1.4)),
          1: ease_io(lin(t, S("e2") + 0.4, S("e2", 1) + 0.6), 1.4),
          2: ease_io(lin(t, S("e2", 1) - 0.4, E("e2") + 0.4)),
          6: ease_io(lin(t, S("e3") - 0.1, E("e3") + 0.4))}
    s = 1.0 + 0.035 * lin(t, sh.t0, sh.t1)
    d.render(img, 0, group_progress=gp, glow=0.3)
    for (x, y, nm), tt in zip(towers, (S("e2", 1) - 0.4, S("e2", 1), S("e2", 1) + 0.4)):
        a = smooth(lin(t, tt, tt + 0.8))
        draw_text(img, nm.upper() + "S TORN" if nm != "Prästö" else "PRÄSTÖ TORN", x, y + 92, name="sans_m", size=17,
                  tracking=0.25, anchor="c", alpha=a * 0.8)
    a = smooth(lin(t, S("e2") + 1.4, S("e2") + 2.4))
    draw_text(img, "HUVUDFÄSTET", center[0] - 120, center[1] + 8, name="sans_m", size=18, tracking=0.3,
              anchor="c", alpha=a * 0.8)
    draw_text(img, "Bomarsunds fästning", 120, H - 330, name="serif", size=56, weight=500, alpha=smooth(lin(t, S("e2"), S("e2") + 1)))
    draw_text(img, "BYGGSTART 1832", 122, H - 288, name="sans_m", size=20, tracking=0.35, alpha=0.8 * smooth(lin(t, S("e2") + 0.4, S("e2") + 1.4)))
    ua = smooth(lin(t, S("e3") + 0.3, S("e3") + 1.2))
    draw_text(img, "- - -   aldrig byggt", 122, H - 248, name="sans", size=20, tracking=0.1, alpha=ua * 0.75, color=INK_DIM)
    if s != 1.0:
        M = cv2.getRotationMatrix2D((W / 2, H / 2), 0, s)
        img = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    return img


FLEET_ROUTE = [(-1.1, 50.75), (1.5, 51.3), (3.5, 53.5), (6.5, 56.5), (9.0, 57.9), (10.8, 57.5),
               (11.6, 56.6), (12.65, 55.9), (13.4, 55.2), (15.5, 55.4), (18.2, 56.8), (19.6, 58.4), (20.1, 59.6), (20.24, 60.15)]


@shot("fleet", S("e4") - 0.5, E("e4") + 0.4)
def _(t, lt, sh):
    x = lin(t, sh.t0, sh.t1)
    cam = zoom_path(Camera(*eur(10.5, 55.8), 1500), Camera(*eur(12.5, 56.8), 1300), ease_io(x))
    img, lm = geo.render_map(cam, L_europe(), border_alpha=0.3)
    route = cam.to_screen(_route(FLEET_ROUTE, eur, 10))
    pr = ease_io(lin(t, S("e4") + 1.0, E("e4") - 0.2), 1.3)
    m = np.zeros((H, W), np.float32)
    for seg in dashed(partial_polyline(route, pr), 9, 7):
        poly_lines(m, [seg], 2)
    img += cv2.GaussianBlur(m, (0, 0), 4)[..., None] * AMBER * 0.5
    over_color(img, AMBER, m * 0.9)
    # fartygsikoner
    for k in range(5):
        u = pr - k * 0.018
        if u <= 0:
            continue
        p = point_at(route, u)
        q = point_at(route, max(0, u - 0.01))
        d = p - q
        ang = math.atan2(d[1], d[0])
        c, s = math.cos(ang), math.sin(ang)
        hull = np.array([(9, 0), (3, 3.5), (-8, 3), (-8, -3), (3, -3.5)]) @ np.array([[c, s], [-s, c]]) + p
        mm = np.zeros((H, W), np.float32)
        fill_polys(mm, [hull])
        over_color(img, INK, mm)
    year_tag(img, "1854", t, S("e4") - 0.2, sh.t1 + 0.4)
    geo.label(img, cam, eur(-2.0, 53.0), "Storbritannien", "country", alpha=smooth(lin(t, Wt("e4", "brittisk") - 0.3, Wt("e4", "brittisk") + 0.6)))
    geo.label(img, cam, eur(2.5, 47.5), "Frankrike", "country", alpha=smooth(lin(t, Wt("e4", "fransk") - 0.3, Wt("e4", "fransk") + 0.6)))
    geo.label(img, cam, eur(30.0, 60.8), "Ryssland", "country", alpha=0.6)
    p = cam.to_screen(eur(20.24, 60.2))
    dot(img, p[0], p[1], 4, RED * 1.4, glow=0.8, alpha=smooth(lin(t, S("e4"), S("e4") + 1)))
    caption(img, t, S("e4") + 0.8, sh.t1 + 0.4, "KRIMKRIGET", "1853–1856")
    return img


@functools.lru_cache(maxsize=1)
def _vc():
    return D.victoria_cross(960, 600, 1.35)


@shot("vc", S("e5") - 0.4, E("e5") + 0.4)
def _(t, lt, sh):
    img = D.ink_paper(seed=7)
    p = ease_io(lin(t, S("e5") + 0.2, E("e5") - 1.8), 1.3)
    _vc().render(img, p, glow=0.55)
    caption(img, t, Wt("e5", "förste") - 0.5, sh.t1 + 0.3, "VIKTORIAKORSET", "Bomarsund, 21 juni 1854")
    return img


@functools.lru_cache(maxsize=1)
def _bombard_events():
    rng = np.random.default_rng(21)
    ships = [(1250, 260), (1300, 420), (1330, 600), (1280, 760), (1360, 880)]
    ev = []
    t = S("e6") - 0.3
    while t < S("e7") - 0.2:
        si = rng.integers(len(ships))
        tx = 900 + 180 * 0.9 + rng.uniform(-240, 40)
        ty = 560 + rng.uniform(-200, 200)
        ev.append((t, ships[si], (tx, ty), rng.uniform(0.6, 1.0)))
        t += rng.uniform(0.18, 0.5)
    return ships, ev


@shot("bombard", S("e6") - 0.4, E("e7") + 0.9, fout=0.8)
def _(t, lt, sh):
    img = D.ink_paper(seed=6, grid=1.0, tint=(0.03, 0.04, 0.05))
    d, towers, center = _fort()
    _water_band(img, (900, 560), 0.9)
    boom = S("e7", 1) + 0.25
    br = smooth(lin(t, boom, boom + 1.4))
    # fästningen "brinner bort" vid sprängningen
    d.render(img, 1.0, group_progress={6: 0.0}, glow=0.25, tip=False, alpha=1 - 0.85 * br)
    ships, ev = _bombard_events()
    m = np.zeros((H, W), np.float32)
    for sx, sy in ships:
        hull = np.array([(-26, 0), (-14, -8), (26, -6), (30, 0), (26, 6), (-14, 8)]) + np.array([sx, sy])
        fill_polys(m, [hull])
    over_color(img, INK, m * 0.85)
    flash = np.zeros((H, W), np.float32)
    shake = 0.0
    for (te, (sx, sy), (tx, ty), k) in ev:
        dt = t - te
        if dt < -0.01 or dt > 2.5:
            continue
        if dt < 0.12:
            cv2.circle(flash, (int(sx - 30), int(sy)), 26, 1.0 - dt / 0.12, -1, cv2.LINE_AA)
        fl = 0.7
        if 0 <= dt < fl:
            path = arc_between((sx - 30, sy), (tx, ty), -0.25, 30)
            u = dt / fl
            p = point_at(path, u)
            q = point_at(path, max(0, u - 0.12))
            mm = np.zeros((H, W), np.float32)
            poly_lines(mm, [np.array([q, p])], 1)
            over_color(img, np.array([1.0, 0.8, 0.5], np.float32), mm * 0.9)
        if fl <= dt < fl + 0.5:
            e = (dt - fl) / 0.5
            cv2.circle(flash, (int(tx), int(ty)), int(10 + 60 * e * k), (1 - e) * 1.2, -1, cv2.LINE_AA)
            ring(img, tx, ty, 10 + 90 * e, np.array([1.0, 0.7, 0.4], np.float32), alpha=(1 - e) * 0.6, width=1.5)
            shake = max(shake, (1 - e) * 5 * k)
        if dt >= fl:
            e = clamp01((dt - fl) / 1.8)
            cv2.circle(flash, (int(tx + 30 * e), int(ty - 20 * e)), int(18 + 50 * e), -0.35 * (1 - e), -1, cv2.LINE_AA)
    flash = cv2.GaussianBlur(flash, (0, 0), 9)
    img += np.clip(flash, 0, None)[..., None] * np.array([1.0, 0.55, 0.2], np.float32)
    img += np.clip(flash, None, 0)[..., None] * 0.15
    # kapitulation och sprängning
    da = fade(t, S("e7") - 0.1, S("e7") + 0.8, sh.t1 - 0.8, sh.t1 + 0.5)
    draw_text(img, "16 augusti 1854", 120, 190, name="serif", size=64, weight=500, alpha=da)
    if t > boom - 0.05:
        e = clamp01((t - boom) / 2.2)
        big = np.zeros((H, W), np.float32)
        cv2.circle(big, (int(center[0] - 100), int(center[1])), int(60 + 700 * ease_out(e, 2)), 1.0, -1, cv2.LINE_AA)
        big = cv2.GaussianBlur(big, (0, 0), 50)
        img += big[..., None] * np.array([1.0, 0.6, 0.25], np.float32) * (1 - e) ** 2 * 2.2
        sm = fx.smoke(t, speed=(20, -30), seed=11, density=1.0)
        img += (np.array([0.09, 0.085, 0.08], np.float32) - img) * (sm * 0.8 * smooth(lin(t, boom, boom + 1.5)))[..., None]
        shake = max(shake, 16 * (1 - e) ** 2)
    if shake > 0.3:
        rng = np.random.default_rng(int(t * 25))
        M = np.float32([[1, 0, rng.uniform(-shake, shake)], [0, 1, rng.uniform(-shake, shake)]])
        img = cv2.warpAffine(img, M, (W, H), borderMode=cv2.BORDER_REFLECT)
    return img


@functools.lru_cache(maxsize=1)
def _treaty():
    return D.document("treaty", seed=3, cx=960, cy=560, w=720, h=900)


@shot("treaty", S("e8") - 0.5, E("e8") + 0.5)
def _(t, lt, sh):
    img = smoke_bg(t, tint=(0.035, 0.035, 0.04), seed=5, density=0.4)
    d, r = _treaty()
    e = ease_out(lin(t, sh.t0, sh.t0 + 1.4))
    oy = 70 * (1 - e)
    rr = (r[0], r[1] + oy, r[2], r[3])
    D.paper_sheet(img, rr, alpha=e, rot=0.0)
    ink = np.array([0.16, 0.12, 0.09], np.float32)
    draw_text(img, "Convention", 960, r[1] + oy + 90, name="garamond_it", size=46, anchor="c", color=ink, alpha=e)
    draw_text(img, "relative aux Îles d'Aland", 960, r[1] + oy + 132, name="garamond_it", size=30, anchor="c", color=ink, alpha=e * 0.9)
    p1 = ease_io(lin(t, S("e8") + 0.3, E("e8") - 1.6))
    p2 = ease_io(lin(t, E("e8") - 1.8, E("e8") - 0.5))
    d.render(img, 0, group_progress={1: p1, 2: p2}, glow=0.0, tip=False, offset=(0, oy), sketch=False)
    st = E("e8") - 0.5
    if t > st:
        k = ease_out(lin(t, st, st + 0.35))
        D.wax_seal(img, 1170, r[1] + oy + r[3] - 120, 52 * (1.25 - 0.25 * k), alpha=k)
    caption(img, t, S("e8") + 0.4, sh.t1 + 0.3, "FREDEN I PARIS", "30 mars 1856")
    return img


@shot("calm", S("e9") - 0.4, E("e9") + 1.9, fout=1.7)
def _(t, lt, sh):
    x = lin(t, sh.t0, sh.t1)
    cam = zoom_path(Camera(*utm(20.03, 60.2), 42), Camera(*utm(20.05, 60.19), 70), ease_io(x))
    warm = smooth(lin(t, S("e9", 1) - 0.5, sh.t1))
    img = sat_img(cam, s=0.8, gain=0.8 + 0.2 * warm, tint=(1 + 0.08 * warm, 1.0, 1 - 0.06 * warm))
    img = _cloud_layer(img, t, 0.35, seed=5, speed=(10, 3))
    return img


# ==========================================================================
# VI. SEGEL
# ==========================================================================
chapter("VI", "Segel", S("f1") + 0.3)
MHAMN = utm(19.9348, 60.0990)


@shot("mariehamn", S("f1") - 0.6, E("f1") + 0.5, fin=0.6)
def _(t, lt, sh):
    x = ease_io(lin(t, sh.t0, sh.t1), 2.0)
    cam = zoom_path(Camera(*utm(19.98, 60.15), 55), Camera(*MHAMN, 7.5), x)
    img = sat_img(cam, s=0.8, gain=0.95, interp=cv2.INTER_CUBIC)
    p = cam.to_screen(MHAMN)
    pin(img, p[0], p[1], "Mariehamn", t, S("f1") + 0.8, sh.t1 + 1, sub="grundad 1861")
    ka = fade(t, Wt("f1", "kejsarinnan") - 0.2, Wt("f1", "kejsarinnan") + 0.8, sh.t1, sh.t1 + 1)
    if ka > 0:
        draw_text(img, "Uppkallad efter kejsarinnan", 120, H - 290, name="sans_m", size=22, tracking=0.12, alpha=ka * 0.85, shadow=0.6)
        draw_text(img, "Maria Aleksandrovna", 120, H - 248, name="serif_it", size=36, weight=450, alpha=ka, shadow=0.6)
    return img


SUNSET = sea.SeaStyle(sky_top=np.array([0.012, 0.025, 0.06]), sky_hor=np.array([0.60, 0.31, 0.14]),
                      water=np.array([0.006, 0.012, 0.022]), sun_dir=np.array([0.24, 0.012, 1.0]),
                      sun_col=np.array([1.0, 0.52, 0.22]), sun_size=0.016, sun_glow=0.45, spec_pow=900, spec=2.5,
                      fog=np.array([0.30, 0.17, 0.10]), fog_dist=2500, clouds=0.0)
WAVES_SUN = sea.Waves(n=30, seed=2, amp=0.35, wl=(0.5, 30), wind=0.3, spread=0.8)


def _sunset_frame(t, ship_x, ship_z, fov=42, pitch=1.4, cam_h=7.0, ships=True, boats=None):
    pitch = pitch + 0.15 * math.sin(t * 0.5)
    img = sea.render_sea(t, SUNSET, WAVES_SUN, cam_h=cam_h, fov=fov, pitch=pitch)
    hy = sea.horizon_y(fov, pitch)
    # himmelsgradient: djupare blå högre upp
    yy = np.arange(H, dtype=np.float32)[:, None, None]
    k = np.clip((hy - yy) / hy, 0, 1) ** 0.7
    img = img * (1 - 0.65 * k) + np.array([0.02, 0.03, 0.07], np.float32) * 0.65 * k * (yy < hy)
    img = _sky_streaks(img, t, hy, (0.08, 0.045, 0.05), 0.75, seed=9, speed=4)
    m = np.zeros((H, W), np.float32)
    if ships:
        u, v, ppm = sea.project_point(ship_x, 0, ship_z, cam_h, fov, pitch)
        roll = 0.015 * math.sin(t * 0.8)
        fill_polys(m, sea.place_polys(sea.barque_polys(), u, v, ppm, roll=roll))
        poly_lines(m, sea.place_polys(sea.barque_rigging(), u, v, ppm, roll=roll), 1)
    if boats:
        for bx, bz, kind in boats:
            u, v, ppm = sea.project_point(bx, 0, bz, cam_h, fov, pitch)
            if kind == "sail":
                tri = [np.array([(-3, 1), (4, 1), (3, -0.8), (-3.5, -0.6)]), np.array([(0, 1), (0, 10), (3.5, 1.5)]),
                       np.array([(-0.3, 1.2), (-0.3, 9), (-3.2, 1.6)])]
                fill_polys(m, sea.place_polys(tri, u, v, ppm, roll=0.02 * math.sin(t + bx)))
            else:  # färja
                ferry = [np.array([(-80, 0), (80, 0), (86, 8), (-78, 9)]), np.array([(-60, 9), (55, 9), (48, 18), (-50, 18)]),
                         np.array([(-35, 18), (30, 18), (26, 24), (-30, 24)]), np.array([(-6, 24), (6, 24), (5, 31), (-5, 31)])]
                fill_polys(m, sea.place_polys(ferry, u, v, ppm))
    over_color(img, np.array([0.02, 0.014, 0.018], np.float32), np.clip(m, 0, 1) * 0.96)
    return img


@shot("sunset_ship", S("f2") - 0.5, E("f3") + 0.5)
def _(t, lt, sh):
    img = _sunset_frame(t, -260 + lt * 5.5, 1500)
    la = fade(t, S("f3") + 1.4, S("f3") + 2.4, sh.t1 - 0.8, sh.t1 + 0.4)
    if la > 0:
        x, y = 120, H - 290
        m = np.zeros((H, W), np.float32)
        poly_lines(m, [np.array([(x, y - 60), (x + 46 * la, y - 60)])], 1)
        over_color(img, AMBER, m * la)
        draw_text(img, "Gustaf Erikson", x, y, name="serif", size=54, weight=500, alpha=la, shadow=0.6)
        draw_text(img, "REDARE  ·  1872 – 1947", x + 2, y + 40, name="sans_m", size=20, tracking=0.3, alpha=la * 0.85, shadow=0.6)
    return img


GRAIN = [(137.5, -34.5), (145, -42), (160, -50), (180, -54), (-160, -56), (-130, -57), (-100, -57.5),
         (-80, -57.2), (-67.3, -56.2), (-58, -52), (-45, -40), (-34, -25), (-28, -8), (-26, 5), (-30, 20),
         (-26, 35), (-16, 44), (-8, 48.5), (-5.07, 50.15)]


@functools.lru_cache(maxsize=1)
def _grain_route():
    pts = []
    for a, b in zip(GRAIN[:-1], GRAIN[1:]):
        pts.append(fx.great_circle(a, b, 30)[:-1])
    pts.append(np.array([GRAIN[-1]]))
    return np.vstack(pts)


@shot("globe", S("f4") - 0.5, E("f4") + 0.5)
def _(t, lt, sh):
    route = _grain_route()
    u = ease_io(lin(t, S("f4") + 0.1, E("f4") + 0.2), 1.5)
    idx = u * (len(route) - 1)
    i0 = int(idx)
    i1 = min(i0 + 1, len(route) - 1)
    f = idx - i0
    # interpolera i xyz för att undvika problem vid datumlinjen
    def xyz(p):
        lo, la = map(math.radians, p)
        return np.array([math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la)])
    v = xyz(route[i0]) * (1 - f) + xyz(route[i1]) * f
    v /= np.linalg.norm(v)
    lon = math.degrees(math.atan2(v[1], v[0]))
    lat = math.degrees(math.asin(v[2]))
    # kameran följer skeppet med mjuk lag, lite högre latitud
    lat0 = lat * 0.7 + 10
    R = 470
    col, a, glow = fx.globe(lon, lat0, R, sun=(-0.6, 0.4, 0.7))
    img = blank((0.008, 0.01, 0.016))
    img = img * (1 - a[..., None]) + col * a[..., None] + glow
    scr, vis = fx.globe_project(route[:, 0], route[:, 1], lon, lat0, R)
    n = int(idx) + 1
    m = np.zeros((H, W), np.float32)
    seg = []
    for k in range(n):
        if vis[k]:
            seg.append(scr[k])
        else:
            if len(seg) > 1:
                poly_lines(m, [np.array(seg)], 2)
            seg = []
    seg.append(fx.globe_project([lon], [lat], lon, lat0, R)[0][0])
    if len(seg) > 1:
        poly_lines(m, [np.array(seg)], 2)
    img += cv2.GaussianBlur(m, (0, 0), 4)[..., None] * AMBER * 0.6
    over_color(img, AMBER, m)
    sp = fx.globe_project([lon], [lat], lon, lat0, R)[0][0]
    dot(img, sp[0], sp[1], 5, INK, glow=1.0)
    for nm, lo, la, tt in (("Australien", 134, -26, S("f4")), ("Kap Horn", -67.3, -56.2, Wt("f4", "Kap") - 0.3),
                          ("Europa", 10, 50, E("f4") - 0.6)):
        pp, vv = fx.globe_project([lo], [la], lon, lat0, R)
        if vv[0]:
            aa = fade(t, tt, tt + 0.6, tt + 2.6, tt + 3.4)
            draw_text(img, nm, pp[0][0] + 14, pp[0][1] - 10, name="sans_m", size=26, tracking=0.08, alpha=aa, shadow=0.7)
    caption(img, t, S("f4") + 0.5, sh.t1 + 0.3, "VETESEGLINGARNA", "Australien – Europa, runt Kap Horn")
    return img


HARBOUR = utm(19.9255, 60.0975)


@shot("harbour", S("f5") - 0.4, E("f5") + 0.4)
def _(t, lt, sh):
    x = lin(t, sh.t0, sh.t1)
    cam = Camera(HARBOUR[0] - 120 + 240 * x, HARBOUR[1] + 60 * x, mix(8.5, 6.0, ease_io(x)), rot=4 - 4 * x)
    img = sat_img(cam, s=0.8, gain=0.95, interp=cv2.INTER_CUBIC)
    caption(img, t, S("f5") + 0.4, sh.t1 + 0.3, "VÄSTRA HAMNEN", "Mariehamn")
    return img


@functools.lru_cache(maxsize=1)
def _pommern():
    return D.barque_profile(930, 830, 1.05)


@shot("pommern", S("f6") - 0.4, E("f6") + 1.5, fout=1.2)
def _(t, lt, sh):
    img = D.ink_paper(seed=8)
    p = ease_io(lin(t, S("f6") - 0.3, E("f6") + 0.4), 1.2)
    _pommern().render(img, p, glow=0.3)
    caption(img, t, S("f6") + 0.3, sh.t1 + 0.3, "POMMERN", "fyrmastad bark, byggd 1903 i Glasgow")
    return img


# ==========================================================================
# VII. ÅLANDSFRÅGAN
# ==========================================================================
chapter("VII", "Ålandsfrågan", S("g1") + 0.3)


@shot("y1917", S("g1") - 0.5, E("g1") + 0.4, fin=0.6)
def _(t, lt, sh):
    x = lin(t, sh.t0, sh.t1)
    cam = Camera(*utm(24.0, 62.0), mix(1250, 1180, x))
    Ls = baltic_layers(cam.mpp)
    img, lm = geo.render_map(cam, Ls, border_alpha=0.25)
    rus = geo.polys_mask(cam, Ls.country(*RUS_CODES))
    fin = geo.polys_mask(cam, Ls.country("FIN", "ALD"))
    fall = smooth(lin(t, Wt("g1", "föll") - 0.2, Wt("g1", "föll") + 0.8))
    flick = 1.0 if fall <= 0 or fall >= 1 else (0.6 + 0.4 * math.sin(t * 40))
    fill_mask(img, rus, RED, 0.35 * (1 - 0.55 * fall) * flick)
    finr = 1 - smooth(lin(t, S("g1", 1) - 0.1, S("g1", 1) + 0.9))
    fill_mask(img, fin, RED, 0.35 * finr * (1 - 0.55 * fall) * flick)
    fb = smooth(lin(t, S("g1", 1), S("g1", 1) + 1.2))
    fill_mask(img, fin, BLUE_FI, 0.55 * fb)
    if fb > 0:
        land_outline_glow(img, fin, BLUE_FI * 1.6, fb * 0.6)
    year_tag(img, "1917", t, S("g1") - 0.2, sh.t1 + 0.4)
    geo.label(img, cam, utm(26.3, 63.0), "Finland", "big", alpha=fb)
    draw_text(img, "6 december 1917", cam.to_screen(utm(26.3, 63.0))[0], cam.to_screen(utm(26.3, 63.0))[1] + 40,
              name="serif_it", size=30, weight=400, anchor="c", alpha=fb * 0.85, shadow=0.5)
    geo.label(img, cam, utm(33.0, 61.0), "Ryssland", "country", alpha=0.8)
    geo.label(img, cam, utm(15.8, 62.0), "Sverige", "country", alpha=0.8)
    return img


@functools.lru_cache(maxsize=1)
def _petition():
    return D.document("petition", seed=5, cx=960, cy=560, w=760, h=920)


@shot("petition", S("g2") - 0.4, E("g2") + 0.4)
def _(t, lt, sh):
    img = smoke_bg(t, tint=(0.035, 0.035, 0.04), seed=6, density=0.4)
    d, r = _petition()
    e = ease_out(lin(t, sh.t0, sh.t0 + 1.2))
    oy = 60 * (1 - e)
    D.paper_sheet(img, (r[0], r[1] + oy, r[2], r[3]), alpha=e, tone=(0.80, 0.76, 0.66))
    ink = np.array([0.14, 0.12, 0.1], np.float32)
    draw_text(img, "Vi undertecknade, bosatta på Åland,", r[0] + 60, r[1] + oy + 100, name="garamond_it", size=30, color=ink, alpha=e)
    draw_text(img, "uttala härmed vår önskan …", r[0] + 60, r[1] + oy + 138, name="garamond_it", size=30, color=ink, alpha=e * 0.9)
    p = ease_io(lin(t, S("g2", 1) - 0.3, E("g2") + 0.2), 1.1)
    d.render(img, p, glow=0.0, tip=False, offset=(0, oy), sketch=False)
    # långsam inzoomning
    s = 1.0 + 0.06 * ease_io(lin(t, sh.t0, sh.t1))
    M = cv2.getRotationMatrix2D((W / 2, H / 2), 0.6, s)
    img = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    caption(img, t, S("g2", 1), sh.t1 + 0.3, "ÅLANDSRÖRELSEN", "1917")
    return img


@shot("geneva", S("g3") - 0.4, E("g3") + 0.4)
def _(t, lt, sh):
    x = lin(t, sh.t0, sh.t1)
    cam = zoom_path(Camera(*eur(17.0, 55.5), 1650), Camera(*eur(13.5, 52.0), 2300), ease_io(lin(t, S("g3", 2) - 0.3, E("g3"))))
    img, lm = geo.render_map(cam, L_europe(), border_alpha=0.3)
    hel = cam.to_screen(eur(24.9384, 60.1699))
    sto = cam.to_screen(eur(18.0686, 59.3293))
    ald = cam.to_screen(eur(20.0, 60.2))
    gen = cam.to_screen(eur(6.1432, 46.2044))
    a1 = smooth(lin(t, S("g3") - 0.1, S("g3") + 0.5))
    a2 = smooth(lin(t, S("g3", 1) - 0.1, S("g3", 1) + 0.5))
    dot(img, hel[0], hel[1], 4, INK, alpha=a1)
    draw_text(img, "Helsingfors", hel[0] + 14, hel[1] + 8, name="sans", size=22, alpha=a1 * 0.85, shadow=0.5)
    draw_text(img, "NEJ", hel[0] + 14, hel[1] - 26, name="sans_sb", size=34, tracking=0.1, alpha=a1, color=RED * 1.6, shadow=0.5)
    dot(img, sto[0], sto[1], 4, INK, alpha=a2)
    draw_text(img, "Stockholm", sto[0] - 14, sto[1] + 8, name="sans", size=22, alpha=a2 * 0.85, anchor="r", shadow=0.5)
    draw_text(img, "JA", sto[0] - 14, sto[1] - 26, name="sans_sb", size=34, tracking=0.1, alpha=a2, anchor="r", color=AMBER * 1.2, shadow=0.5)
    dot(img, ald[0], ald[1], 5, AMBER, alpha=max(a1, a2), glow=0.8)
    pr = ease_io(lin(t, S("g3", 2) + 0.3, Wt("g3", "Genève") + 0.2), 1.4)
    path = arc_between(ald, gen, -0.2, 80)
    m = np.zeros((H, W), np.float32)
    for seg in dashed(partial_polyline(path, pr), 10, 7):
        poly_lines(m, [seg], 2)
    img += cv2.GaussianBlur(m, (0, 0), 4)[..., None] * AMBER * 0.5
    over_color(img, AMBER, m)
    ga = smooth(lin(t, Wt("g3", "Nationernas") - 0.1, Wt("g3", "Nationernas") + 0.7))
    dot(img, gen[0], gen[1], 5, INK, alpha=ga, glow=0.6)
    draw_text(img, "Nationernas förbund", gen[0] + 18, gen[1] - 4, name="serif_it", size=36, weight=500, alpha=ga, shadow=0.6)
    draw_text(img, "GENÈVE", gen[0] + 20, gen[1] + 30, name="sans_m", size=20, tracking=0.35, alpha=ga * 0.8, shadow=0.6)
    return img


@shot("date1921", S("g4") - 0.4, E("g4") + 0.4)
def _(t, lt, sh):
    img = smoke_bg(t, seed=7, density=0.5)
    reveal_text(img, "24 juni 1921", W / 2, H / 2 + 40, t - S("g4") + 0.2, dur=1.0, stagger=0.06,
                name="serif", size=150, weight=450, tracking=0.03, anchor="c")
    a = smooth(lin(t, S("g4") + 1.4, S("g4") + 2.4))
    draw_text(img, "NATIONERNAS FÖRBUNDS RÅD", W / 2, H / 2 + 130, name="sans_m", size=22, tracking=0.4,
              anchor="c", alpha=a * 0.8)
    return img


@shot("aland_fi", S("g5") - 0.4, E("g5") + 0.7)
def _(t, lt, sh):
    x = lin(t, sh.t0, sh.t1)
    cam = Camera(*utm(20.4, 60.3), mix(470, 430, x))
    Ls = baltic_layers(cam.mpp)
    img, lm = geo.render_map(cam, Ls, border_alpha=0.0)
    _land_detail(img, cam, LAND)
    fin = geo.polys_mask(cam, Ls.country("FIN"))
    fill_mask(img, fin, BLUE_FI, 0.5)
    # Ålands landyta från satellitmasken inom Åland-området
    lmd = sat.render(cam, kind="land")
    xs, ys = np.meshgrid(np.arange(W), np.arange(H))
    west = cam.to_screen(utm(19.2, 60.2))[0]
    east = cam.to_screen(utm(21.25, 60.2))[0]
    region = ((xs > west) & (xs < east)).astype(np.float32)
    ald = lmd * region
    k = smooth(lin(t, S("g5") + 0.4, S("g5") + 1.6))
    fill_mask(img, ald, BLUE_FI, 0.55 * k)
    fill_mask(img, geo.polys_mask(cam, Ls.country("ALD")), BLUE_FI, 0.55 * k)
    # gräns i Ålands hav
    b = [cam.to_screen(utm(19.05, 60.9)), cam.to_screen(utm(19.2, 60.3)), cam.to_screen(utm(19.12, 59.9)),
         cam.to_screen(utm(19.35, 59.55))]
    from .common import catmull
    bl = catmull(np.array(b), 12)
    pr = ease_io(lin(t, S("g5") + 0.2, E("g5")))
    m = np.zeros((H, W), np.float32)
    for seg in dashed(partial_polyline(bl, pr), 12, 8):
        poly_lines(m, [seg], 2)
    over_color(img, INK, m * 0.9)
    geo.label(img, cam, utm(17.9, 60.5), "Sverige", "country", alpha=0.85)
    geo.label(img, cam, utm(23.0, 61.0), "Finland", "country", alpha=0.85)
    p = cam.to_screen(utm(19.95, 60.22))
    draw_text(img, "Åland", p[0], p[1] - 70, name="serif_it", size=40, weight=500, anchor="c", alpha=k, shadow=0.7)
    return img


@shot("villkor", S("g6") - 0.4, E("g6") + 0.4)
def _(t, lt, sh):
    img = smoke_bg(t, seed=8, density=0.45)
    a0 = smooth(lin(t, S("g6") - 0.1, S("g6") + 0.7))
    draw_text(img, "MED VILLKOR", 560, 330, name="sans_m", size=22, tracking=0.45, alpha=a0 * 0.8, color=AMBER)
    items = [("Språket", Wt("g6", "Språket")), ("Kulturen", Wt("g6", "kulturen")), ("Självstyrelse", Wt("g6", "styra") - 0.3)]
    for i, (txt, tt) in enumerate(items):
        y = 460 + i * 130
        a = smooth(lin(t, tt - 0.15, tt + 0.6))
        e = ease_out(lin(t, tt - 0.15, tt + 0.9))
        m = np.zeros((H, W), np.float32)
        poly_lines(m, [np.array([(560, y + 26), (560 + 800 * e, y + 26)])], 1)
        over_color(img, INK_DIM, m * a * 0.6)
        draw_text(img, f"0{i + 1}", 560, y - 6, name="mono", size=22, alpha=a * 0.7, color=AMBER)
        draw_text(img, txt, 640, y + 4 + 10 * (1 - e), name="serif", size=78, weight=450, alpha=a)
    return img


SIGNERS = ("DEU", "DNK", "EST", "FIN", "FRA", "GBR", "ITA", "LVA", "POL", "SWE")
SIGN_NAMES = {"DEU": "Tyskland", "DNK": "Danmark", "EST": "Estland", "FIN": "Finland", "FRA": "Frankrike",
              "GBR": "Storbritannien", "ITA": "Italien", "LVA": "Lettland", "POL": "Polen", "SWE": "Sverige"}


@shot("ten_states", S("g7") - 0.4, S("g7", 2) - 0.25)
def _(t, lt, sh):
    x = lin(t, sh.t0, sh.t1)
    zx = ease_io(lin(t, S("g7", 1) - 0.2, S("g7", 2) - 0.3))
    cam = zoom_path(Camera(*eur(12.0, 53.5), 2150), Camera(*eur(19.5, 59.6), 520), zx)
    Ls = L_europe()
    img, lm = geo.render_map(cam, Ls, border_alpha=0.25)
    ta = S("g7") + 0.4
    order = ("SWE", "FIN", "DNK", "DEU", "EST", "LVA", "POL", "GBR", "FRA", "ITA")
    shown = 0
    for i, code in enumerate(order):
        tt = ta + i * 0.3
        a = smooth(lin(t, tt, tt + 0.5))
        if a <= 0:
            continue
        shown = i + 1
        mm = geo.polys_mask(cam, Ls.country(code) + (Ls.country("ALD") if code == "FIN" else []))
        fill_mask(img, mm, AMBER, 0.22 * a * (1 - zx * 0.6))
        e = cv2.morphologyEx((mm > 0.5).astype(np.uint8), cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8)).astype(np.float32)
        over_color(img, AMBER, e * a * 0.7 * (1 - zx))
    ca = fade(t, ta - 0.2, ta + 0.4, S("g7", 1) - 0.2, S("g7", 1) + 0.5)
    if ca > 0:
        draw_text(img, f"{shown:>2}", W - 250, 210, name="serif", size=110, weight=500, anchor="r", alpha=ca, shadow=0.5)
        draw_text(img, "STATER", W - 236, 200, name="sans_m", size=22, tracking=0.4, alpha=ca * 0.85, shadow=0.5)
        draw_text(img, "Genève, 20 oktober 1921", W - 120, 262, name="serif_it", size=32, weight=400, anchor="r", alpha=ca * 0.85, shadow=0.5)
    # Åland markeras vid inzoomningen
    if zx > 0:
        p = cam.to_screen(eur(20.0, 60.2))
        ring(img, p[0], p[1], 60 + 30 * (1 - zx), AMBER, alpha=zx, width=1.6)
        draw_text(img, "DEMILITARISERAT", p[0] + 90, p[1] - 8, name="sans_m", size=22, tracking=0.35, alpha=zx, shadow=0.6)
        draw_text(img, "NEUTRALISERAT", p[0] + 90, p[1] + 26, name="sans_m", size=22, tracking=0.35,
                  alpha=smooth(lin(t, Wt("g7", "neutralt") - 0.2, Wt("g7", "neutralt") + 0.4)), shadow=0.6)
    return img


@shot("no_arms", S("g7", 2) - 0.25, E("g7") + 0.7)
def _(t, lt, sh):
    img = blank((0.01, 0.011, 0.013))
    lines = [("Inga soldater.", S("g7", 2)), ("Inga fästningar.", S("g7", 3)), ("Inte ens i krig.", S("g7", 4))]
    for i, (txt, tt) in enumerate(lines):
        a = smooth(lin(t, tt - 0.1, tt + 0.5))
        e = ease_out(lin(t, tt - 0.1, tt + 0.9))
        y = H / 2 - 110 + i * 110
        dim = 1.0 if i == 2 or t < lines[min(i + 1, 2)][1] else 0.45
        draw_text(img, txt, W / 2, y + 12 * (1 - e), name="serif", size=78, weight=450, anchor="c",
                  alpha=a * dim, blur=1.5 * (1 - e))
    return img


@shot("landsting", S("g8") - 0.3, E("g8") + 1.3, fout=1.1)
def _(t, lt, sh):
    img = smoke_bg(t, seed=9, density=0.4)
    big_year(img, "9 juni 1922", t, S("g8") - 0.2, sh.t1 + 1, y=260, size=96)
    seats = D.hemicycle_seats(30, 960, 800, 170, 330, 4)
    ta, tb = S("g8") + 0.8, E("g8") - 0.2
    for i, (x, y) in enumerate(seats):
        tt = ta + (tb - ta) * i / len(seats)
        a = ease_out(lin(t, tt, tt + 0.4))
        if a > 0:
            dot(img, x, y, 9 * a + 0.5, INK, alpha=0.9, glow=0.2)
    a = smooth(lin(t, S("g8") + 1.0, S("g8") + 2.0))
    draw_text(img, "ÅLANDS LANDSTING", 960, 860, name="sans_m", size=24, tracking=0.45, anchor="c", alpha=a * 0.85)
    draw_text(img, "30 ledamöter", 960, 900, name="serif_it", size=30, weight=400, anchor="c", alpha=a * 0.7)
    return img


# ==========================================================================
# VIII. I DAG
# ==========================================================================
chapter("VIII", "I dag", S("h1") + 0.3)


@shot("flag", S("h1") - 0.5, Wt("h1", "frimärken") + 0.1, fin=0.8)
def _(t, lt, sh):
    img = fx.flag_frame(t * 0.9, zoom=1.12)
    luma = img @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    img = (luma[..., None] + (img - luma[..., None]) * 0.82) * 0.72
    return img


def _stamp(img, t, cx, cy, w, h, alpha):
    """Frimärke med perforering och liten motivbild (barken i solnedgång)."""
    m = np.zeros((H, W), np.float32)
    fill_polys(m, [np.array([(cx - w / 2, cy - h / 2), (cx + w / 2, cy - h / 2), (cx + w / 2, cy + h / 2), (cx - w / 2, cy + h / 2)])])
    r = 9
    for x in np.arange(cx - w / 2, cx + w / 2 + 1, 2.4 * r):
        cv2.circle(m, (int(x), int(cy - h / 2)), r, 0, -1, cv2.LINE_AA)
        cv2.circle(m, (int(x), int(cy + h / 2)), r, 0, -1, cv2.LINE_AA)
    for y in np.arange(cy - h / 2, cy + h / 2 + 1, 2.4 * r):
        cv2.circle(m, (int(cx - w / 2), int(y)), r, 0, -1, cv2.LINE_AA)
        cv2.circle(m, (int(cx + w / 2), int(y)), r, 0, -1, cv2.LINE_AA)
    sh = cv2.GaussianBlur(m, (0, 0), 16)
    over_color(img, (0, 0, 0), np.roll(sh, (16, 12), (0, 1)) * 0.7 * alpha)
    over_color(img, np.array([0.9, 0.88, 0.82], np.float32), m * alpha)
    # motiv
    iw, ih = int(w - 70), int(h - 170)
    ix, iy = int(cx - iw / 2), int(cy - h / 2 + 40)
    scene = _sunset_frame(t, 0, 700, fov=34, pitch=1.2)
    cw = int(H * iw / ih)
    sc = cv2.resize(scene[:, W // 2 - cw // 2:W // 2 - cw // 2 + cw], (iw, ih), interpolation=cv2.INTER_AREA)
    from .common import over
    over(img, sc, np.full((ih, iw), alpha, np.float32), ix, iy)
    ink = np.array([0.12, 0.2, 0.36], np.float32)
    draw_text(img, "ÅLAND", cx - w / 2 + 36, cy + h / 2 - 60, name="sans_sb", size=46, tracking=0.2, color=ink, alpha=alpha)
    draw_text(img, "POMMERN · 1903", cx - w / 2 + 38, cy + h / 2 - 28, name="sans_m", size=16, tracking=0.25, color=ink, alpha=alpha * 0.8)
    draw_text(img, "1,90", cx + w / 2 - 36, cy + h / 2 - 58, name="serif", size=48, weight=600, anchor="r", color=ink, alpha=alpha)
    return img


@shot("stamp", Wt("h1", "frimärken") - 0.1, E("h1") + 0.4)
def _(t, lt, sh):
    img = D.ink_paper(seed=10, tint=(0.05, 0.05, 0.055))
    e = ease_out(lin(t, sh.t0, sh.t0 + 0.9))
    _stamp(img, t, 960, 540 + 40 * (1 - e), 520, 640, e)
    pa = smooth(lin(t, Wt("h1", "parlament") - 0.2, Wt("h1", "parlament") + 0.5))
    if pa > 0:
        seats = D.hemicycle_seats(30, 1560, 700, 90, 170, 3)
        for i, (x, y) in enumerate(seats):
            a = ease_out(lin(t, Wt("h1", "parlament") + i * 0.02, Wt("h1", "parlament") + 0.4 + i * 0.02))
            dot(img, x, y, 5 * a + 0.3, INK, alpha=0.9 * pa)
        draw_text(img, "LAGTINGET", 1560, 745, name="sans_m", size=18, tracking=0.4, anchor="c", alpha=pa * 0.8)
    return img


@shot("archipelago", S("h2") - 0.4, S("h3", 1) - 0.1)
def _(t, lt, sh):
    x = lin(t, sh.t0, sh.t1)
    cam = Camera(*utm(20.38 + 0.07 * x, 60.03 + 0.01 * x), mix(26, 22, x), rot=-3 + 3 * x)
    img = sat_img(cam, s=0.85, gain=0.95)
    a1 = fade(t, S("h2") + 0.1, S("h2") + 0.8, sh.t1 - 0.6, sh.t1)
    a2 = fade(t, S("h2", 1) + 0.1, S("h2", 1) + 0.8, sh.t1 - 0.6, sh.t1)
    a3 = fade(t, S("h3") + 0.2, S("h3") + 0.9, sh.t1 - 0.6, sh.t1)
    for i, (txt, a) in enumerate((("SPRÅK", a1), ("VÄRNPLIKT", a2), ("ÖRLOGSFARTYG", a3))):
        y = H - 420 + i * 64
        val = ("Svenska", "Nej", "Inga")[i]
        draw_text(img, txt, 120, y, name="sans_m", size=20, tracking=0.35, alpha=a * 0.8, shadow=0.7)
        draw_text(img, val, 420, y + 4, name="serif", size=40, weight=500, alpha=a, shadow=0.7)
    return img


@shot("sails", S("h3", 1) - 0.4, E("h3") + 0.6)
def _(t, lt, sh):
    boats = [(-90 + lt * 1.2, 380, "sail"), (40 + lt * 0.8, 520, "sail"), (160 - lt * 1.5, 1500, "ferry"),
             (-20, 260, "sail")]
    img = _sunset_frame(t, 0, 0, fov=44, pitch=1.6, ships=False, boats=boats)
    return img


@functools.lru_cache(maxsize=1)
def _table():
    return D.table_topdown(960, 560, 1.0)


@shot("table", S("h4") - 0.4, E("h4") + 0.4)
def _(t, lt, sh):
    img = D.ink_paper(seed=11)
    p = ease_io(lin(t, S("h4") - 0.3, E("h4")), 1.2)
    _table().render(img, p, glow=0.3)
    return img


@shot("exemplet", S("h5") - 0.3, E("h5") + 1.3, fout=1.0)
def _(t, lt, sh):
    img = smoke_bg(t, seed=12, density=0.5)
    reveal_text(img, "Ålandsexemplet", W / 2, H / 2 + 30, t - Wt("h5", "Ålandsexemplet") + 0.3, dur=1.0,
                stagger=0.04, name="serif", size=130, weight=450, tracking=0.02, anchor="c")
    e = ease_out(lin(t, Wt("h5", "Ålandsexemplet") + 0.6, Wt("h5", "Ålandsexemplet") + 1.8))
    m = np.zeros((H, W), np.float32)
    poly_lines(m, [np.array([(W / 2 - 200 * e, H / 2 + 80), (W / 2 + 200 * e, H / 2 + 80)])], 1)
    over_color(img, AMBER, m)
    return img


@shot("final", S("h6") - 0.6, E("h7") + 2.6, fin=0.8, fout=2.0)
def _(t, lt, sh):
    x = ease_io(lin(t, sh.t0, E("h6") + 0.6), 1.7)
    a = Camera(*utm(19.97, 60.15), 28)
    b = Camera(*utm(19.9, 60.1), 230)
    cam = zoom_path(a, b, x)
    if t > E("h6") + 0.6:
        y = ease_io(lin(t, E("h6") + 0.6, sh.t1), 1.5)
        cam = zoom_path(b, Camera(*utm(20.0, 60.2), 560), y)
    img_s = sat_img(cam, s=0.8, gain=0.95)
    mx = smooth(lin(t, S("h6", 2) - 1.2, S("h6", 2) + 0.4))
    if mx > 0:
        img_m, lm = geo.render_map(cam, baltic_layers(cam.mpp), border_alpha=0.2)
        _land_detail(img_m, cam, LAND)
        img = img_s * (1 - mx) + img_m * mx
        geo.label(img, cam, utm(17.0, 60.5), "Sverige", "big", alpha=smooth(lin(t, S("h6", 2) - 0.1, S("h6", 2) + 0.8)))
        geo.label(img, cam, utm(23.3, 60.9), "Finland", "big", alpha=smooth(lin(t, S("h6", 2) + 0.4, S("h6", 2) + 1.3)))
        p = cam.to_screen(ALAND_C)
        dot(img, p[0], p[1], 5, AMBER, alpha=mx, glow=1.0)
    else:
        img = img_s
    return img


@shot("end_title", E("h7") + 2.7, TOTAL, fout=1.4)
def _(t, lt, sh):
    img = smoke_bg(t, seed=2, density=0.5)
    a = smooth(lin(lt, 0.2, 1.6))
    draw_text(img, "ÅLAND", W / 2, H / 2 + 30, name="serif", size=120, weight=500, tracking=0.42, anchor="c", alpha=a)
    a2 = smooth(lin(lt, 0.9, 2.0))
    draw_text(img, "Mellan två riken", W / 2, H / 2 + 100, name="serif_it", size=34, weight=400,
              tracking=0.06, alpha=a2 * 0.8, anchor="c")
    return img
