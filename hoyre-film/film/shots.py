# -*- coding: utf-8 -*-
"""The 34 shots of 02-shotliste.md, each anchored to the narration (build/timeline.json).
A shot is a function (t, u, d) -> Frame; t = film time, u = time into the shot, d = length."""
import functools
import json
import math
import os

import cv2
import numpy as np

import config
from manus import sentences, spoken

from . import kit as K
from . import mesh as M
from . import overlay as O
from . import rooms as Rm
from . import sets as S
from . import world as Wd
from .common import (BLUE, BUILD, H, INK, INK_DIM, W, catmull, clamp01, draw_text, ease_io, ease_out, fade,
                     lin, over_color, partial_polyline, poly_lines, smooth)
from .raster import Camera, Decal, Light

TL = json.load(open(os.path.join(BUILD, "timeline.json"), encoding="utf-8"))
LINES = TL["lines"]
TOTAL = TL["total"]


def S_(lid, k=0):
    return LINES[lid]["sents"][k][0]


def E_(lid, k=-1):
    return LINES[lid]["sents"][k][1]


def Wt(lid, word, occ=0):
    """Estimated start time of a word (proportional to the spoken characters of its sentence)."""
    sents = sentences(LINES[lid]["text"])
    w = spoken(word)
    n = 0
    for k, s in enumerate(sents):
        sp = spoken(s)
        start = 0
        while True:
            i = sp.find(w, start)
            if i < 0:
                break
            if n == occ:
                a, b = LINES[lid]["sents"][k]
                return a + (b - a) * (i / max(1, len(sp)))
            n += 1
            start = i + 1
    raise KeyError(f"{word!r} not in {lid}")


class Frame:
    def __init__(self, parts, cam, env, focus=None, aperture=0.8, decals=(), pre=None, post=None,
                 illus=False, tilt=None, exposure=1.0, warm=0.0, bloom=0.35):
        self.parts, self.cam, self.env = parts, cam, env
        self.focus, self.aperture, self.decals = focus, aperture, decals
        self.pre, self.post, self.illus, self.tilt = pre, post, illus, tilt
        self.exposure, self.warm, self.bloom = exposure, warm, bloom


class Card:
    """A 2D frame (end card) – no 3D render."""
    def __init__(self, draw):
        self.draw = draw


def path_cam(u, keys, ease=ease_io):
    """keys: [(u, eye, target, fov)] -> Camera, eased between keys."""
    if u <= keys[0][0]:
        k = keys[0]
        return Camera(k[1], k[2], k[3])
    for a, b in zip(keys[:-1], keys[1:]):
        if u <= b[0]:
            x = ease((u - a[0]) / max(1e-6, b[0] - a[0]))
            e = np.asarray(a[1]) + (np.asarray(b[1]) - np.asarray(a[1])) * x
            tg = np.asarray(a[2]) + (np.asarray(b[2]) - np.asarray(a[2])) * x
            return Camera(e, tg, a[3] + (b[3] - a[3]) * x)
    k = keys[-1]
    return Camera(k[1], k[2], k[3])


def orbit(center, radius, height, ang_deg, fov=35, ty=0.0):
    a = math.radians(ang_deg)
    c = np.asarray(center, float)
    return Camera(c + [radius * math.sin(a), height, radius * math.cos(a)], c + [0, ty, 0], fov)


def dist(cam, P):
    return float(np.linalg.norm(cam.eye - np.asarray(P, float)))


def lines3d(img, cam, polys, color, width=1.5, alpha=1.0, intensity=1.0):
    """Draw world-space polylines into the HDR image (before post, so they get DOF/grade)."""
    if alpha <= 0:
        return img
    h, w = img.shape[:2]
    m = np.zeros((h, w), np.float32)
    pl = []
    for p in polys:
        if len(p) < 2:
            continue
        q = cam.project(np.asarray(p, float), w, h)
        if np.any(q[:, 2] <= 0.05):
            continue
        pl.append(q[:, :2])
    if pl:
        poly_lines(m, pl, width)
        col = np.asarray(color, np.float32) * intensity
        img += (col - img) * (m * alpha)[..., None] if intensity <= 1 else col * (m * alpha)[..., None]
    return img


def sag(a, b, amount=0.3, n=24):
    a, b = np.asarray(a, float), np.asarray(b, float)
    t = np.linspace(0, 1, n)[:, None]
    p = a + (b - a) * t
    p[:, 1] -= amount * np.sin(np.pi * t[:, 0])
    return p


TWINE = (0.78, 0.74, 0.62)


def dashed3d(pts, dash=0.6, gap=0.4):
    p = np.asarray(pts, float)
    if len(p) < 2:
        return []
    seg = np.sqrt(((p[1:] - p[:-1]) ** 2).sum(1))
    cum = np.concatenate([[0], np.cumsum(seg)])
    out, s = [], 0.0
    while s < cum[-1]:
        a, b = s, min(cum[-1], s + dash)
        ts = np.linspace(a, b, 4)
        out.append(np.stack([np.interp(ts, cum, p[:, k]) for k in range(3)], 1))
        s += dash + gap
    return out


# ==========================================================================
# KALD ÅPNING
# ==========================================================================
STREET_C = np.array([-0.8, 1.8, -2.0])


def s01(t, u, d):
    x = ease_io(u / d)
    cam = Camera([-0.8, 5.4 - 1.4 * x, 23.5 - 6.0 * x], STREET_C, 31 - 2 * x)
    return Frame(Wd.street_only(), cam, Wd.night_env(), focus=dist(cam, [0, 1.5, -0.6]), aperture=0.7, illus=True)


def s02(t, u, d):
    x = ease_io(clamp01(u / (d * 0.55)))
    y = ease_io(clamp01((u - d * 0.45) / (d * 0.55)))
    eye = np.array([0.1, 1.42, 2.8]) + (np.array([0.05, 1.32, -0.05]) - [0.1, 1.42, 2.8]) * x
    eye = eye + (np.array([-0.02, 1.15, -0.55]) - [0.05, 1.32, -0.05]) * y
    tg = np.array([0.0, 1.2, -1.2]) + (np.array([-0.05, 0.75, -1.25]) - [0.0, 1.2, -1.2]) * y
    cam = Camera(eye, tg, 38)
    parts = [Rm.kitchen()] + Rm.kitchen_dyn(0.35)
    return Frame(parts, cam, Rm.kitchen_env(glow=0.35), focus=dist(cam, [-0.05, 0.75, -1.25]), aperture=0.6, illus=True)


def s03(t, u, d):
    x = ease_io(u / d)
    eye = [-0.95 + 1.9 * x, 1.8, -0.3]
    cam = Camera(eye, [-0.3 + 0.6 * x, 0.8, -1.6], 48)
    return Frame([Rm.study()] + Rm.study_dyn(), cam, Rm.study_env(), focus=dist(cam, [0, 0.8, -1.4]), aperture=0.6, illus=True)


def s04(t, u, d):
    t_msg = S_("o4", 1)
    glow = smooth(lin(t, S_("o4") + 0.6, S_("o4") + 1.2))
    pulse = 1.0 + 0.25 * fade(t, t_msg - 0.3, t_msg - 0.2, t_msg, t_msg + 0.4)
    x = ease_io(clamp01((u - 3.0) / (d - 3.0)))
    eye = np.array([1.25, 1.45, -0.15]) + (np.array([0.8, 1.28, -0.45]) - [1.25, 1.45, -0.15]) * x
    tg = np.array([-0.45, 0.8, -1.2]) + (np.array([-0.1, 0.65, -1.0]) - [-0.45, 0.8, -1.2]) * x
    cam = Camera(eye, tg, 40)
    parts = [Rm.bedroom()] + Rm.bedroom_dyn(glow * pulse)

    def post(img, cam_):
        O.bubble(img, t, t_msg, 1080, 330, "Ukjent", "Rask cash. Ett oppdrag.", t1=S_("o5") - 0.2)
    return Frame(parts, cam, Rm.bedroom_env(glow=glow * pulse), focus=dist(cam, [-0.1, 0.65, -1.0]), aperture=0.6,
                 post=post, illus=True)


def s05(t, u, d):
    x = ease_io(u / d)
    cam = Camera([-0.8, 3.4 + 5.0 * x, 15.5 + 9.0 * x], [-0.8, 1.6 - 0.3 * x, -2.0], 31)
    return Frame(Wd.street_only(), cam, Wd.night_env(Wd.street_lights(1.3)), focus=dist(cam, [0, 1, 0]), aperture=0.6, illus=True)


@functools.lru_cache(maxsize=None)
def _letters():
    out = []
    x = 0.0
    for ch in "TRE VINDUER":
        if ch == " ":
            x += 0.55
            continue
        m, adv = S.letter_mesh(ch, 1.0, 0.2, (0.92, 0.90, 0.86), K.BLUE_S if ch == "V" else (0.80, 0.78, 0.74))
        out.append((m, x, adv))
        x += adv + 0.06
    return out, x


def s06(t, u, d):
    letters, total = _letters()
    parts = list(Wd.street_only())
    for i, (m, x, adv) in enumerate(letters):
        k = ease_out(clamp01((u - 0.25 - i * 0.12) / 0.9), 3)
        mm = m.copy().rotx(-(1 - k) * math.pi / 2, about=(0, 0, 0)).move(x - total / 2 - 0.8, 0.0, 1.9)
        parts.append(mm)
    x = u / d
    cam = Camera([-0.8 + 0.5 * x, 2.6 - 0.15 * x, 10.6 - 0.4 * x], [-0.8, 1.0, 1.4], 36)

    def post(img, cam_):
        O.line_text(img, t, t - u + 1.6, t - u + d - 0.3, "Om rus, integrering og trygghet i Norge", W / 2, H - 230,
                    size=40, anchor="c", panel=True)
        O.line_text(img, t, t - u + 2.3, t - u + d - 0.3, "En dokumentar fra Høyre", W / 2, H - 170, size=30,
                    color=INK_DIM, anchor="c")
        O.fade_black(img, smooth(lin(u, d - 0.5, d)))
    env = Wd.night_env(Wd.street_lights(0.8) + [Light((-0.8, 3.0, 5.0), (0.9, 0.9, 1.0), 4.0, 1.2)])
    return Frame(parts, cam, env, focus=dist(cam, [-0.8, 0.7, 1.9]), aperture=0.7, post=post)


# ==========================================================================
# RAMME
# ==========================================================================
def map_parts(unfold=1.0, rise=1.0, colour=1.0):
    parts = [S.table_top()]
    if rise < 1.0 or colour < 1.0:
        parts.append(S.paper_sheet(unfold))
    if unfold >= 0.999:
        parts.append(S.terrain_mesh(rise, colour, y0=0.02).move(0, 0.0, 0))
    return parts


def s07(t, u, d):
    unfold = ease_io(clamp01(u / 3.5))
    rise = ease_io(clamp01((u - 3.2) / 3.0))
    colour = smooth(clamp01((u - 3.4) / 2.6))
    ang = -20 + 40 * ease_io(u / d)
    cam = orbit([0.5, 0, -0.5], 15.5 - 2.0 * ease_io(u / d), 13.0, ang, 34, ty=0.3)
    env = S.studio_env(0.9, warm=0.0)
    return Frame(map_parts(unfold, rise, colour), cam, env, focus=dist(cam, [0.5, 0, -0.5]), aperture=0.5)


def s08(t, u, d):
    x = ease_io(u / d)
    cam = Camera([0.0, 1.85, 8.0 - 3.0 * x], [0.0, 1.8, 0.0], 38)
    pins = [S.pin(-1.6, 2.6), S.pin(0.2, 2.85), S.pin(1.8, 2.45)]

    def pre(img, cam_):
        for a, b in (((-1.6, 2.6), (-1.4, 1.6)), ((0.2, 2.85), (0.45, 1.7)), ((1.8, 2.45), (1.65, 1.5))):
            lines3d(img, cam_, [sag((a[0], a[1], -0.05), (b[0], b[1], -0.1), 0.05)], np.asarray(TWINE) ** 2.2 * 0.5, 2.0)

    def post(img, cam_):
        O.line_text(img, t, Wt("r2", "Vi har sett"), t - u + d, "Vi har sett på tallene.", W / 2, H - 140, size=36,
                    anchor="c", panel=True)
    return Frame([S.board_set()] + pins, cam, S.studio_env(0.75), focus=dist(cam, [0, 1.8, -0.15]), aperture=0.6,
                 pre=pre, post=post)


# ==========================================================================
# KAPITTEL 1 – RUS
# ==========================================================================
def chapter_shot(k, num, title):
    def fn(t, u, d):
        c = Wd.win_center(k)
        x = ease_io(u / d)
        cam = Camera(c + [0.3, 0.4 - 0.1 * x, 7.0 - 1.4 * x], c + [0, -0.1, 0], 30)

        def post(img, cam_):
            O.chapter(img, t, t - u + 0.2, t - u + d - 0.1, num, title)
        return Frame(Wd.street_only(), cam, Wd.night_env(), focus=dist(cam, c), aperture=0.9, post=post)
    return fn


def s10(t, u, d):
    h23 = 391 / 391 * 3.0
    h24 = 342 / 391 * 3.0
    g1 = ease_out(clamp01((u - 0.2) / 1.6))
    g2 = ease_out(clamp01((u - 0.6) / 1.6))
    parts = list(Wd.street_only()) + [K.bar(-2.2, 1.7, 1.0, 1.0, h23 * g1, K.PLINTH),
                                      K.bar(-0.6, 1.7, 1.0, 1.0, h24 * g2, K.BLUE_S, 0.15)]
    x = ease_io(u / d)
    cam = Camera([-0.6, 0.5 + 1.0 * x, 8.5], [-1.4, 0.9 + 1.4 * x, 1.7], 38)
    t342 = Wt("a1", "342")

    def post(img, cam_):
        val = 342 * ease_out(clamp01((t - t342 + 0.3) / 1.8), 2)
        O.counter(img, val, 1420, 300, fade(t, t342 - 0.5, t342, t - u + d - 0.6, t - u + d), 3, 100)
        O.label_at(img, cam_, [-2.2, h23 * g1 + 0.1, 1.7], "2023", fade(u, 1.2, 1.8, d - 0.6, d), 30, -20)
        O.label_at(img, cam_, [-0.6, h24 * g2 + 0.1, 1.7], "2024", fade(u, 1.5, 2.1, d - 0.6, d), 30, -20, color=O.BLUE_TEXT)
        O.stat(img, t, t342, t - u + d, "342", "narkotikautløste dødsfall i 2024", y=H - 270)
        O.line_text(img, t, S_("a1", 1), t - u + d, "2023: 391 – høyeste på over 20 år", O.MARGIN, H - 130, 30, INK_DIM)
        O.source(img, t, t - u + 0.5, t - u + d, "Kilde: Helsedirektoratet (2025), FHI (2024)")
    return Frame(parts, cam, Wd.night_env(Wd.street_lights() + [Light((-1.4, 4.5, 5.0), (0.85, 0.88, 1.0), 4, 2.0)]),
                 focus=dist(cam, [-1.4, 1.5, 1.7]), aperture=0.7, post=post)


def s11(t, u, d):
    t2 = S_("a2", 1)
    nb = 6 * smooth(lin(t, S_("a2") + 0.8, S_("a2") + 2.0)) + 9 * smooth(lin(t, t2 + 0.6, t2 + 1.8))
    gx, gz = Wd.SCHOOL[0] - 2.5, Wd.SCHOOL[2] + 4.2
    parts = list(Wd.town(lit=False, day=True)) + [K.figure_grid(gx, gz, 10, 10, 0.6, 0.55, nb)]
    c = np.array([gx + 2.7, 0, gz + 2.7])
    x = ease_io(clamp01((t - t2 + 0.8) / 3.0))
    eye = c + np.array([0, 9.0, 4.5]) + (np.array([4.5, 4.0, 10.0]) - [0, 9.0, 4.5]) * x
    tg = c + (np.array([0, 0.6, -3.5]) * x)
    cam = Camera(eye, tg, 40 - 4 * x)

    def post(img, cam_):
        O.stat(img, t, S_("a2") + 0.8, t2 - 0.1, "5,8 %", "av voksne 16–64 år har brukt cannabis siste år (2025)")
        O.stat(img, t, t2 + 0.5, t - u + d, "ca. 15 %", "av elever i videregående (2025)")
        O.source(img, t, t - u + 0.5, t - u + d, "Kilde: Helsedirektoratet (2026)")
    return Frame(parts, cam, Wd.day_env(), focus=dist(cam, c), aperture=0.7, post=post, illus=True)


def _container_outline(on):
    if on <= 0:
        return []
    sx, sz = Wd.HARBOUR_X + 6.0, -2.0
    x0, x1 = sx - 0.5, sx + 0.45
    y0, y1 = 2.1, 2.96
    z0, z1 = sz - 0.5, sz + 1.9
    e = K.blue_emit(3.0 * on)
    t = 0.035
    out = []
    for (a, b, c_, dd, e_, f) in ((x0, y1, z0, x1, y1 + t, z0 + t), (x0, y1, z1 - t, x1, y1 + t, z1),
                                  (x0, y1, z0, x0 + t, y1 + t, z1), (x1 - t, y1, z0, x1, y1 + t, z1),
                                  (x0, y0, z1, x1, y0 + t, z1 + t), (x0, y0, z1, x0 + t, y1, z1 + t),
                                  (x1 - t, y0, z1, x1, y1, z1 + t), (x1 - t, y0, z0, x1, y1, z0 + t)):
        out.append(M.box(a, b, c_, dd, e_, f, K.BLUE_S, emit=e, flags=M.UNLIT | M.NOSHADOW))
    return out


def s12(t, u, d):
    on = smooth(lin(u, 1.0, 2.0))
    parts = list(Wd.town()) + _container_outline(on)
    ang = 65 + 55 * ease_io(u / d)
    cam = orbit([Wd.HARBOUR_X + 1.0, 0, -2.0], 21.0, 10.0, ang, 36, ty=1.0)
    sx = Wd.HARBOUR_X + 6.0
    route_in = catmull([(46, -0.3, -24), (40, -0.3, -14), (33, -0.3, -6), (sx + 2.2, -0.3, -1.0)], 10)
    route_out = catmull([(sx + 2.2, -0.3, 1.0), (34, -0.3, 8), (40, -0.3, 14), (46, -0.3, 19)], 10)
    t_tr = Wt("a3", "transittland")

    def pre(img, cam_):
        f1 = ease_io(clamp01((u - 0.6) / 3.0))
        f2 = ease_io(clamp01((t - t_tr + 0.5) / 2.5))
        segs = dashed3d(partial_polyline(route_in, f1)) if f1 > 0 else []
        if f2 > 0:
            segs += dashed3d(partial_polyline(route_out, f2))
        lines3d(img, cam_, segs, (0.9, 0.9, 0.85), 2.0, 0.85)

    def post(img, cam_):
        O.stat(img, t, Wt("a3", "Kripos"), t - u + d, "Transittland",
               "Kripos: Norge brukes i flere saker som transittland for kokain", blue=False, size=72)
        O.source(img, t, t - u + 0.5, t - u + d, "Kilde: Kripos, Nasjonal trusselvurdering (2024)")
    env = Wd.night_env(Wd.street_lights() + [K.lamp_light(Wd.HARBOUR_X - 0.8, -10, side=1, power=6),
                                             K.lamp_light(Wd.HARBOUR_X - 0.8, 10, side=1, power=6),
                                             Light((sx, 3.2, -1.0), K.blue_emit(1.0), 1.0, 1.5 * on)])
    return Frame(parts, cam, env, focus=dist(cam, [sx, 2, -2]), aperture=0.8, pre=pre, post=post)


def s13(t, u, d):
    cx, cz = Wd.CLINIC[0], Wd.CLINIC[2] + 1.8
    door = np.array([cx - 1.6, 0, cz + 0.4])
    n = 8
    parts = list(Wd.town(lit=False, day=True))
    for i in range(n):
        # the queue moves forward; the first figures go in through the door
        adv = u * 0.55
        k = i - adv
        if k < -1.0:
            continue
        s = max(k, 0.0)
        x = door[0] + 0.7 + s * 0.75
        z = door[2] + 0.6
        if k < 0:
            x = door[0] + 0.7 * (1 + k)
            z = door[2] + 0.6 * (1 + k)
        bob = 0.02 * abs(math.sin(u * 6 + i)) if k < 0 or (adv % 1) < 0.5 else 0.0
        parts.append(K.figure(x, z, 0.85, [K.FIG, (0.72, 0.74, 0.76), (0.80, 0.76, 0.70)][i % 3],
                              face=-math.pi / 2, bob=bob))
    x = ease_io(u / d)
    cam = Camera([cx + 0.5 + 3.0 * x, 3.4, cz + 6.0], [cx + 0.6 + 2.5 * x, 0.8, cz - 0.5], 40)
    t26 = Wt("a4", "26")

    def post(img, cam_):
        day = int(round(30 - 4 * smooth(lin(t, t26 - 0.2, t26 + 1.2))))
        a = fade(t, t26 - 0.8, t26 - 0.2, t - u + d - 0.5, t - u + d)
        _calendar(img, 1530, 210, day, a)
        O.stat(img, t, t26, t - u + d, "26 dager", "gjennomsnittlig ventetid i rusbehandling (TSB), 2025")
        O.source(img, t, t - u + 0.5, t - u + d, "Kilde: FHI / Norsk pasientregister (2026)")
    return Frame(parts, cam, Wd.dawn_env(0.85), focus=dist(cam, [cx + 2, 0.5, cz]), aperture=0.8, post=post, illus=True)


def _calendar(img, x, y, day, a):
    if a <= 0:
        return
    m = np.zeros((H, W), np.float32)
    cv2.rectangle(m, (x, y), (x + 210, y + 230), 1, -1)
    img *= (1 - cv2.GaussianBlur(m, (0, 0), 10) * 0.4 * a)[..., None]
    over_color(img, (0.95, 0.94, 0.9), m * a)
    hm = np.zeros((H, W), np.float32)
    cv2.rectangle(hm, (x, y), (x + 210, y + 52), 1, -1)
    over_color(img, (0.30, 0.32, 0.36), hm * a)
    draw_text(img, "DAGER", x + 105, y + 38, name="cond_sb", size=28, tracking=0.2, color=INK, alpha=a, anchor="c")
    draw_text(img, f"{day}", x + 105, y + 190, name="sans_sb", size=120, color=(0.15, 0.16, 0.18), alpha=a, anchor="c")


# ---- the evidence board ---------------------------------------------------
CLIPS = {
    "c21": dict(pos=(-1.6, 2.2), size=(1.7, 1.2), tilt=-0.04, sec="INNENRIKS", head="2021 · Rusreform fikk ikke flertall", note="2021"),
    "c22": dict(pos=(0.35, 2.35), size=(1.9, 1.3), tilt=0.03, sec="JUSS",
                head="2022 · Høyesterett: rusavhengige med små mengder skal i alminnelighet ikke få følbar straff", note="2022"),
    "c25": dict(pos=(1.95, 1.2), size=(1.7, 1.2), tilt=-0.02, sec="NYHETER",
                head="2025 · Stortinget: narkotika fortsatt forbudt – lav bot for små mengder", note="2025"),
}


@functools.lru_cache(maxsize=None)
def _clip_img(k):
    c = CLIPS[k]
    return S.clipping_img(c["sec"], c["head"])


@functools.lru_cache(maxsize=None)
def _note_img(text):
    return S.note_img(text)


def board_frame(t, cam, shown, doc=0.0, stamp=0.0):
    """shown: {clip: 0..1 (flying in)}"""
    parts = [S.board_set()]
    decals = []
    pins_at = []
    for i, (k, a) in enumerate(shown.items()):
        if a <= 0:
            continue
        c = CLIPS[k]
        lift = (1 - ease_out(a, 3)) * 2.5
        (cx, cy), (w, h) = c["pos"], c["size"]
        oid = 51 + i
        parts.append(S.paper_card(cx, cy, w, h, tilt=c["tilt"], obj=oid, lift=lift))
        decals.append(Decal(_clip_img(k), S.card_corners(cx, cy, w, h, tilt=c["tilt"], lift=lift), oid))
        # blue year note
        nx, ny = cx - w / 2 + 0.05, cy + h / 2 - 0.05
        parts.append(S.paper_card(nx, ny, 0.5, 0.33, z=-0.13, col=K.BLUE_S, tilt=0.08, obj=oid + 10, lift=lift))
        decals.append(Decal(_note_img(c["note"]), S.card_corners(nx, ny, 0.5, 0.33, z=-0.13, tilt=0.08, lift=lift), oid + 10))
        if a > 0.95:
            parts.append(S.pin(cx, cy + h / 2 - 0.12, z=-0.12))
            pins_at.append((cx, cy + h / 2 - 0.12))
    if doc > 0:
        lift = (1 - ease_out(doc, 3)) * 2.0
        parts.append(S.paper_card(1.0, 0.95, 1.2, 1.6, z=-0.105, col=(0.96, 0.96, 0.94), tilt=0.06, obj=70, lift=lift))
        decals.append(Decal(S.stamp_doc_img(stamp_alpha=stamp), S.card_corners(1.0, 0.95, 1.2, 1.6, z=-0.105, tilt=0.06, lift=lift), 70))
    return parts, decals, pins_at


def s14(t, u, d):
    t21, t22 = Wt("a5", "I 2021"), Wt("a5", "I 2022")
    shown = {"c21": clamp01((t - t21 + 0.3) / 0.9), "c22": clamp01((t - t22 + 0.3) / 0.9)}
    parts, decals, pins = board_frame(t, None, shown)
    x = ease_io(u / d)
    cam = Camera([-1.8 + 3.2 * x, 1.9, 4.6], [-1.4 + 2.8 * x, 2.0, -0.2], 38)
    focus_pt = [-1.6, 2.2, -0.15] if t < t22 else [0.35, 2.35, -0.15]
    tw = clamp01((t - t22 - 0.8) / 1.2)

    def pre(img, cam_):
        if tw > 0:
            a, b = np.array([-1.6, 2.68, -0.05]), np.array([0.35, 2.88, -0.05])
            p = sag(a, b, 0.12)
            lines3d(img, cam_, [partial_polyline(p, tw)], np.asarray(TWINE) ** 2.2 * 0.6, 2.2)

    def post(img, cam_):
        O.source(img, t, t - u + 0.5, t - u + d, "Kilde: Stortinget (2021), Høyesterett HR-2022-731-A")
    return Frame(parts, cam, S.studio_env(0.75), focus=dist(cam, focus_pt), aperture=0.7, decals=decals, pre=pre, post=post)


def s15(t, u, d):
    t25 = S_("a6") + 0.3
    shown = {"c21": 1.0, "c22": 1.0, "c25": clamp01((t - t25) / 0.9)}
    tdoc = Wt("a6", "forbudt")
    doc = clamp01((t - tdoc) / 0.8)
    stamp = smooth(lin(t, tdoc + 1.2, tdoc + 1.4))
    parts, decals, pins = board_frame(t, None, shown, doc, stamp)
    x = ease_io(clamp01((u - 1.0) / (d - 1.0)))
    cam = Camera([1.3 + 0.3 * x, 1.6 - 0.3 * x, 5.0 - 2.4 * x], [1.2 - 0.1 * x, 1.4 - 0.3 * x, -0.2], 38)

    def pre(img, cam_):
        p1 = sag((-1.6, 2.68, -0.05), (0.35, 2.88, -0.05), 0.12)
        p2 = sag((0.35, 2.88, -0.05), (1.95, 1.68, -0.05), 0.1)
        tw = clamp01((t - t25 - 0.9) / 1.0)
        lines3d(img, cam_, [p1, partial_polyline(p2, tw)], np.asarray(TWINE) ** 2.2 * 0.6, 2.2)

    def post(img, cam_):
        O.line_text(img, t, tdoc + 1.5, t - u + d, "Lov 20. juni 2025 nr. 83 · Flertall: Ap, H, SV, V", O.MARGIN, H - 150,
                    32, panel=True)
        O.source(img, t, t - u + 0.5, t - u + d, "Kilde: Stortinget (2025)")
    return Frame(parts, cam, S.studio_env(0.75), focus=dist(cam, [1.0, 1.0, -0.1]), aperture=0.7, decals=decals,
                 pre=pre, post=post)


# ---- party plinths --------------------------------------------------------
def plinth_shot(lid, names, symbols, first_sent=1, tail=None):
    """Equal treatment: same plinth, same light, same label size; the spoken party gets the light."""
    def fn(t, u, d):
        n = len(names)
        stage, pos = S.plinth_stage(n, symbols)
        sents = LINES[lid]["sents"]
        # which plinth is being talked about
        act = -1
        lv = np.full(n, 0.35)
        for k in range(n):
            si = first_sent + k
            if si < len(sents):
                a, b = sents[si]
                if k == n - 1 and tail is not None:
                    b = max(b, tail)
                w = fade(t, a - 0.3, a + 0.2, b + 0.2, b + 0.7)
                lv[k] = 0.35 + 0.65 * w
                if a - 0.3 <= t:
                    act = k
        # camera: orbit that turns toward the active plinth
        def ang_for(k):
            return math.degrees(pos[k][2]) * 0.8 if k >= 0 else 0.0
        keys = [(sents[0][0] - 1.0, 0.0)] + [(sents[first_sent + k][0], ang_for(k)) for k in range(n)
                                              if first_sent + k < len(sents)]
        ang = keys[0][1]
        for (ta, aa), (tb, ab) in zip(keys[:-1], keys[1:]):
            if t >= ta:
                ang = aa + (ab - aa) * ease_io(clamp01((t - ta) / 1.4))
        if len(keys) > 1 and t >= keys[-1][0]:
            ang = keys[-1][1]
        cam = orbit([0, 0, 0.2], 9.0, 4.2, ang, 36, ty=1.3)
        env = S.studio_env(0.12, S.plinth_lights(pos, act, lv), bg=(0.035, 0.037, 0.045))

        def post(img, cam_):
            for k, (x, z, a) in enumerate(pos):
                O.label_at(img, cam_, [x, 2.45, z], names[k], fade(u, 0.4 + 0.1 * k, 1.0 + 0.1 * k, d - 0.5, d), 34, -10)
        return Frame([stage], cam, env, focus=dist(cam, [0, 1.3, -1.0]), aperture=0.5, post=post)
    return fn


s16 = plinth_shot("a7", ["Ap-regjeringen", "FrP", "Sp", "SV · V · MDG"], [K.sym_scale, K.sym_door, K.sym_sign, K.sym_house])
s24 = plinth_shot("b6", ["Ap-regjeringen", "FrP", "SV"], [None, None, None])


# ---- Høyre's path through town -------------------------------------------
PATH = [(-6.5, 1.2), (-6.5, -8.6), (-3.4, -8.6), (-3.4, -10.6), (6.3, -10.6), (6.3, -19.3), (13.8, -19.3), (13.8, -21.4)]


@functools.lru_cache(maxsize=None)
def _path_pts():
    p = np.array(PATH, float)
    seg = np.sqrt(((p[1:] - p[:-1]) ** 2).sum(1))
    L = seg.sum()
    n = int(L / 0.6)
    pts = [partial_polyline(p, (k + 0.5) / n)[-1] for k in range(n)]
    cum = np.concatenate([[0], np.cumsum(seg)])
    def frac_at(xz):
        # fraction along the path of the vertex closest to xz
        i = int(np.argmin(((p - xz) ** 2).sum(1)))
        return cum[i] / L
    return np.array(pts), L, frac_at


def s17(t, u, d):
    pts, L, frac_at = _path_pts()
    t_obl, t_fritt, t_ett = Wt("a8", "obligatorisk"), Wt("a8", "fritt"), Wt("a8", "ettervernet")
    t_toll = Wt("a8", "tollkontrollen")
    f_off, f_cli = frac_at((-6.5, -8.6)), frac_at((6.3, -10.6)) - 0.02
    keys = [(S_("a8") + 0.3, 0.0), (t_obl + 0.6, f_off), (t_fritt + 0.6, f_cli), (t_ett + 1.0, 1.0)]
    f = 0.0
    for (ta, fa), (tb, fb) in zip(keys[:-1], keys[1:]):
        if t >= ta:
            f = fa + (fb - fa) * ease_io(clamp01((t - ta) / (tb - ta)))
    n = len(pts)
    parts = list(Wd.town())
    lit_n = f * n
    tiles = []
    for k, (x, z) in enumerate(pts):
        on = clamp01(lit_n - k)
        col = tuple(np.asarray((0.55, 0.55, 0.55)) * (1 - on) + np.asarray(K.BLUE_S) * on)
        tiles.append(M.box(x - 0.22, 0.0, z - 0.22, x + 0.22, 0.05, z + 0.22, col, emit=K.blue_emit(1.4 * on),
                           flags=M.NOSHADOW))
    parts.append(M.merge(tiles))
    toll = smooth(lin(t, t_toll, t_toll + 0.8))
    cu = Wd.CUSTOMS
    if toll > 0:
        parts.append(M.box(cu[0] - 0.6, 1.0, cu[2] + 1.0, cu[0] + 0.6, 1.6, cu[2] + 1.03, K.BLUE_S,
                           emit=K.blue_emit(3.0 * toll), flags=M.UNLIT))
    head = partial_polyline(np.array(PATH, float), max(f, 0.001))[-1]
    # crane that follows the path head (smoothed by easing between keyframes)
    tgt = np.array([head[0], 0.0, head[1]])
    tgt = tgt * 0.7 + np.array([-1.0, 0, -8.0]) * 0.3
    cam = Camera(tgt + [9.0, 17.0, 15.0], tgt, 38)
    lights = Wd.street_lights() + [Light((head[0], 1.0, head[1]), K.blue_emit(1.0), 1.5, 2.0)]
    if toll > 0:
        lights.append(Light((cu[0], 2.0, cu[2] + 2.0), K.blue_emit(1.0), 1.5, 3.0 * toll))

    def post(img, cam_):
        O.label_at(img, cam_, [Wd.OFFICE[0], 3.6, Wd.OFFICE[2]], "Kommunens rustjeneste", fade(t, t_obl, t_obl + 0.6, t - u + d - 0.5, t - u + d), 28)
        O.label_at(img, cam_, [Wd.CLINIC[0], 3.8, Wd.CLINIC[2]], "Behandling", fade(t, t_fritt, t_fritt + 0.6, t - u + d - 0.5, t - u + d), 28)
        O.label_at(img, cam_, [10.5, 4.2, -21.5], "Ettervern: bolig og arbeid", fade(t, t_ett, t_ett + 0.6, t - u + d - 0.5, t - u + d), 28)
        O.label_at(img, cam_, [cu[0], 3.2, cu[2]], "Toll", fade(t, t_toll, t_toll + 0.6, t - u + d - 0.5, t - u + d), 26)
        items = [(S_("a8") + 0.4, "Narkotika fortsatt forbudt"), (t_obl, "Obligatorisk møte i kommunens rustjeneste"),
                 (t_toll, "Sterkere tollkontroll"), (t_fritt, "Fritt behandlingsvalg"), (t_ett, "Bedre ettervern")]
        O.bullets(img, t, items, t - u + d, y=210, size=34, gap=58, title="HØYRE VIL")
        O.source(img, t, t - u + 0.5, t - u + d, "Kilde: Høyres stortingsvalgprogram 2025–2029")
    return Frame(parts, cam, Wd.night_env(lights, fog=0.006), focus=dist(cam, tgt), aperture=0.6, post=post)


# ==========================================================================
# KAPITTEL 2 – INNVANDRING OG INTEGRERING
# ==========================================================================
def s19(t, u, d):
    hb = 4.0
    g = ease_out(clamp01((u - 0.5) / 2.0))
    g2 = ease_out(clamp01((t - S_("b1", 1) + 0.2) / 1.5))
    x0, z0 = 5.0, 2.0
    parts = map_parts() + [K.bar(x0, z0, 0.9, 0.9, hb * g, K.PLINTH),
                           K.bar(x0 + 1.2, z0, 0.9, 0.9, hb * 0.175 * g, K.BLUE_S, 0.15),
                           K.bar(x0 + 1.2, z0, 0.9, 0.9, hb * 0.042 * g2, (0.55, 0.68, 0.88), 0.1, y0=hb * 0.175 * g + 0.005)]
    ang = 15 + 30 * ease_io(u / d)
    cam = orbit([2.0, 0, 0.0], 15.0, 9.5, ang, 36, ty=1.0)

    def post(img, cam_):
        O.label_at(img, cam_, [x0, hb * g + 0.15, z0], "Hele befolkningen", fade(u, 1.5, 2.1, d - 0.5, d), 26, -14)
        O.stat(img, t, S_("b1") + 1.0, t - u + d, "17,5 %", "Innvandrere: 987 120", y=H - 300)
        O.line_text(img, t, S_("b1", 1), t - u + d, "Norskfødte med innvandrerforeldre: 238 507 (4,2 %)", O.MARGIN, H - 140, 30)
        O.source(img, t, t - u + 0.5, t - u + d, "Per 1.1.2026 · Kilde: SSB")
    return Frame(parts, cam, S.studio_env(0.9), focus=dist(cam, [2, 0, 0]), aperture=0.5, post=post)


def s20(t, u, d):
    parts = [S.station_winter()]
    door = np.array([-2.3, 0.48, 0.1])
    walkers = [(-9.5, 1.2, 0.9, "suitcase", 0.0), (-10.6, 1.5, 0.92, "suitcase", 0.4), (-11.8, 1.1, 0.88, None, 1.1),
               (-11.5, 1.6, 0.55, None, 1.1), (-13.2, 1.3, 0.9, "suitcase", 1.9)]
    for i, (x0, z0, h, bag, delay) in enumerate(walkers):
        s = max(0.0, u - delay) * 0.62
        x = x0 + s
        z = z0
        face = math.pi / 2
        if x > door[0] - 0.4:
            k = clamp01((x - (door[0] - 0.4)) / 1.2)
            x = door[0] - 0.4 + 0.4 * k
            z = z0 + (door[2] - z0) * k
            face = math.pi / 2 + k * math.pi / 2 * 0.9
            if k >= 1:
                continue
        bob = 0.02 * abs(math.sin(u * 5.5 + i))
        parts.append(K.figure(x, z, h, [K.FIG, (0.70, 0.66, 0.6), (0.78, 0.8, 0.82), (0.86, 0.80, 0.70), (0.66, 0.70, 0.72)][i],
                              face=face, bob=0.48 + bob, bag=bag))
    x = ease_io(u / d)
    cam = Camera([-12.0 + 7.0 * x, 2.4, 8.5], [-6.0 + 4.0 * x, 1.0, 0.5], 36)
    tn = Wt("b2", "13 000")

    def post(img, cam_):
        _snow(img, t)
        O.stat(img, t, tn, t - u + d, "13 445", "søknader om kollektiv beskyttelse fra ukrainere (2025)")
        O.source(img, t, t - u + 0.5, t - u + d, "Kilde: UDI (2026)")
    return Frame(parts, cam, S.winter_env(), focus=dist(cam, [-5, 1, 1.3]), aperture=0.7, post=post, illus=True)


@functools.lru_cache(maxsize=None)
def _snow_field(n=420, seed=7):
    rng = np.random.default_rng(seed)
    return rng.random((n, 4))


def _snow(img, t):
    f = _snow_field()
    x = (f[:, 0] * W + 30 * np.sin(t * 0.6 + f[:, 3] * 6)) % W
    y = (f[:, 1] * H + t * (40 + 60 * f[:, 2])) % H
    m = np.zeros((H, W), np.float32)
    for xi, yi, s in zip(x, y, f[:, 2]):
        cv2.circle(m, (int(xi), int(yi)), 1 + int(s * 2.2), 0.35 + 0.5 * s, -1, cv2.LINE_AA)
    m = cv2.GaussianBlur(m, (0, 0), 1.0)
    over_color(img, (0.95, 0.96, 1.0), m * 0.8)


ICONS = ["bolig", "skoleplass", "norskopplæring", "arbeid"]


def _icon(img, kind, cx, cy, a, s=46):
    if a <= 0:
        return
    m = np.zeros((H, W), np.float32)
    bg = np.zeros((H, W), np.float32)
    cv2.circle(bg, (int(cx), int(cy)), int(s * 0.95), 1, -1, cv2.LINE_AA)
    img *= (1 - cv2.GaussianBlur(bg, (0, 0), 6) * 0.45 * a)[..., None]
    over_color(img, BLUE, bg * a * 0.9)
    k = s * 0.45
    if kind == "bolig":
        pts = np.array([(cx - k, cy + k * 0.8), (cx - k, cy - k * 0.1), (cx, cy - k * 0.9), (cx + k, cy - k * 0.1), (cx + k, cy + k * 0.8)])
        poly_lines(m, [pts], 3, closed=True)
    elif kind == "skoleplass":
        poly_lines(m, [np.array([(cx - k, cy - k * 0.6), (cx, cy - k * 0.3), (cx + k, cy - k * 0.6), (cx + k, cy + k * 0.7),
                                 (cx, cy + k), (cx - k, cy + k * 0.7)])], 3, closed=True)
        poly_lines(m, [np.array([(cx, cy - k * 0.3), (cx, cy + k)])], 3)
    elif kind == "norskopplæring":
        draw_text(img, "Aa", cx, cy + k * 0.55, name="sans_sb", size=int(s * 0.9), color=INK, alpha=a, anchor="c")
    else:
        poly_lines(m, [np.array([(cx - k, cy - k * 0.3), (cx + k, cy - k * 0.3), (cx + k, cy + k * 0.8), (cx - k, cy + k * 0.8)])], 3, closed=True)
        poly_lines(m, [np.array([(cx - k * 0.35, cy - k * 0.3), (cx - k * 0.35, cy - k * 0.7), (cx + k * 0.35, cy - k * 0.7), (cx + k * 0.35, cy - k * 0.3)])], 3)
    over_color(img, INK, m * a)


def s21(t, u, d):
    th = Wd.TOWNHALL
    g1 = ease_out(clamp01((u - 0.6) / 1.5))
    g2 = ease_out(clamp01((t - Wt("b3", "omtrent")) / 1.5))
    bx, bz = th[0] + 5.5, th[2] + 3.6
    parts = list(Wd.town(lit=False, day=True)) + [K.bar(bx, bz, 0.9, 0.9, 3.2 * g1, K.BLUE_S, 0.15),
                                                  K.bar(bx + 1.2, bz, 0.9, 0.9, 3.2 * 12596 / 25618 * g2, K.PLINTH)]
    ang = 20 + 25 * ease_io(u / d)
    cam = orbit([th[0] + 1.5, 0, th[2] + 1.5], 17.0, 11.0, ang, 36, ty=1.2)
    times = [Wt("b3", w) for w in ICONS]

    def post(img, cam_):
        p = cam_.project(np.array([[th[0], 6.5, th[2]]]), W, H)[0]
        for i, kind in enumerate(ICONS):
            a = fade(t, times[i] - 0.1, times[i] + 0.4, t - u + d - 0.5, t - u + d)
            _icon(img, kind, p[0] + (i - 1.5) * 120, p[1] - 30 - 18 * (1 - ease_out(clamp01((t - times[i]) / 0.6))), a)
        O.label_at(img, cam_, [bx, 3.2 * g1 + 0.2, bz], "2024", fade(u, 1.5, 2.0, d - 0.5, d), 26, -12, color=O.BLUE_TEXT)
        O.label_at(img, cam_, [bx + 1.2, 3.2 * 12596 / 25618 * g2 + 0.2, bz], "2025", fade(t, Wt("b3", "omtrent") + 0.8, Wt("b3", "omtrent") + 1.3, t - u + d - 0.5, t - u + d), 26, -12)
        O.stat(img, t, Wt("b3", "I 2024"), t - u + d, "25 618", "bosatte flyktninger i 2024 · 12 596 i 2025 (foreløpig)")
        O.source(img, t, t - u + 0.5, t - u + d, "Kilde: IMDi (2026)")
    return Frame(parts, cam, Wd.day_env(), focus=dist(cam, th), aperture=0.6, post=post)


def s22(t, u, d):
    t2 = S_("b4", 2)
    a1 = ease_out(clamp01((t - Wt("b4", "67,5 prosent") + 0.3) / 1.4))
    a2 = ease_out(clamp01((t - Wt("b4", "80 prosent") + 0.3) / 1.4))
    swap = smooth(lin(t, t2 - 0.2, t2 + 0.6))
    b1 = ease_out(clamp01((t - Wt("b4", "75 prosent") + 0.3) / 1.4))
    b2 = ease_out(clamp01((t - Wt("b4", "58 prosent") + 0.3) / 1.4))
    hmax = 2.6
    parts = [S.workplace_set()] + S.workplace_people()
    if swap < 1:
        parts += [K.bar(-1.3, 0.6, 0.9, 0.9, hmax * 0.675 * a1 * (1 - swap), K.BLUE_S, 0.15),
                  K.bar(0.9, 0.6, 0.9, 0.9, hmax * 0.797 * a2 * (1 - swap), K.PLINTH)]
    else:
        parts += [K.bar(-1.3, 0.6, 0.9, 0.9, hmax * 0.75 * b1, K.BLUE_S, 0.15),
                  K.bar(0.9, 0.6, 0.9, 0.9, hmax * 0.58 * b2, K.BLUE_S, 0.15)]
    x = ease_io(u / d)
    cam = Camera([-2.5 + 3.0 * x, 1.0 + 0.6 * x, 7.0], [-0.2, 1.3, 0.0], 40)

    def post(img, cam_):
        if swap < 1:
            O.label_at(img, cam_, [-1.3, hmax * 0.675 * a1 + 0.15, 0.6], "67,5 %", a1 * (1 - swap), 34, -12, color=O.BLUE_TEXT, name="sans_sb")
            O.label_at(img, cam_, [0.9, hmax * 0.797 * a2 + 0.15, 0.6], "79,7 %", a2 * (1 - swap), 34, -12, name="sans_sb")
            O.label_at(img, cam_, [-1.3, -0.05, 1.3], "Innvandrere", a1 * (1 - swap), 26, 40)
            O.label_at(img, cam_, [0.9, -0.05, 1.3], "Øvrig befolkning", a2 * (1 - swap), 26, 40)
        else:
            O.label_at(img, cam_, [-1.3, hmax * 0.75 * b1 + 0.15, 0.6], "75 %", b1, 34, -12, color=O.BLUE_TEXT, name="sans_sb")
            O.label_at(img, cam_, [0.9, hmax * 0.58 * b2 + 0.15, 0.6], "58 %", b2, 34, -12, color=O.BLUE_TEXT, name="sans_sb")
            O.label_at(img, cam_, [-1.3, -0.05, 1.3], "Menn", b1, 26, 40)
            O.label_at(img, cam_, [0.9, -0.05, 1.3], "Kvinner", b2, 26, 40)
        O.line_text(img, t, S_("b4", 1), t2 - 0.3, "Sysselsatte 20–66 år: innvandrere 67,5 % (2025), øvrig befolkning 79,7 % (2024)",
                    O.MARGIN, 150, 30, panel=True)
        O.line_text(img, t, t2 + 0.3, t - u + d, "I arbeid/utdanning ett år etter introduksjonsprogram (avsluttet 2021)",
                    O.MARGIN, 150, 30, panel=True)
        O.source(img, t, t - u + 0.5, t2 - 0.2, "Kilde: SSB")
        O.source(img, t, t2 + 0.3, t - u + d, "Kilde: SSB (2025)")
    return Frame(parts, cam, S.studio_env(0.9), focus=dist(cam, [-0.2, 1.0, 0.6]), aperture=0.6, post=post, illus=True)


def s23(t, u, d):
    st, x0, top = S.stairs_set()
    parts = [st]
    for k in range(6):
        g = ease_out(clamp01((u - 0.4 - k * 0.45) / 1.0))
        parts.append(K.bar(-6.2 + k * 1.6, 0.0, 0.5, 0.5, (0.35 + 0.22 * k) * g, K.BLUE_S, 0.15, y0=0.35 * (k + 1)))
    t2 = S_("b5", 2)
    for i in range(5):
        ga = smooth(lin(t, t2 - 0.4 + i * 0.15, t2 + 0.4 + i * 0.15))
        if ga > 0:
            parts.append(K.figure(x0 + 3.8 + i * 1.1, 0.5 + (i % 2) * 0.6, 0.9, [K.FIG, (0.72, 0.68, 0.62), (0.8, 0.82, 0.84)][i % 3],
                                  bob=top - 0.6 * (1 - ga), cap="student", bag="diploma"))
    x = ease_io(clamp01((t - t2 + 1.5) / 3.5))
    keys_e = np.array([-3.5, 3.0, 11.0]) + (np.array([4.0, 5.2, 10.0]) - [-3.5, 3.0, 11.0]) * x
    keys_t = np.array([-2.5, 1.3, 0.0]) + (np.array([x0 + 5.5, top + 1.6, -1.0]) - [-2.5, 1.3, 0.0]) * x
    cam = Camera(keys_e, keys_t, 38)

    def post(img, cam_):
        O.label_at(img, cam_, [-2.5, 0.0, 2.6], "Lengre botid", fade(u, 1.0, 1.6, d - 0.5, d), 28, 40)
        O.line_text(img, t, S_("b5", 1), t2 - 0.2, "Sysselsettingen øker med botid", O.MARGIN, 160, 36, panel=True)
        O.line_text(img, t, t2 + 0.2, t - u + d, "Norskfødte med innvandrerforeldre tar oftere høyere utdanning enn jevnaldrende",
                    O.MARGIN, 160, 32, panel=True)
        O.source(img, t, t - u + 0.5, t - u + d, "Kilde: SSB (2024–2025)")
    return Frame(parts, cam, Wd.day_env(), focus=dist(cam, keys_t), aperture=0.6, post=post, illus=True)


def s25(t, u, d):
    ts = [S_("b7") + 0.4, Wt("b7", "kvoteflyktninger"), Wt("b7", "aktivitetsplikt"), Wt("b7", "norskopplæring"),
          Wt("b7", "strengere norskkrav")]
    k = sum(clamp01((t - ti) / 1.0) for ti in ts)
    parts = [S.bridge_set()] + S.bridge_planks(k)
    tw = S_("b7", 2)
    if t > tw:
        s = clamp01((t - tw) / 4.5)
        parts.append(K.figure(-8.5 + 17 * s, 1.6, 0.9, K.FIG, face=math.pi / 2, bob=0.4 * (-6 < -8.5 + 17 * s < 6) + 0.02 * abs(math.sin(t * 6))))
    xw = ease_io(clamp01((u - d * 0.55) / (d * 0.45)))
    x = ease_io(clamp01(u / (d * 0.6)))
    eye = np.array([-7.0 + 12.0 * x, 3.2, 8.5]) + (np.array([0.0, 11.0, 19.0]) - np.array([-7.0 + 12.0 * x, 3.2, 8.5])) * xw
    tg = np.array([-4.0 + 9.0 * x, 0.6, 1.6]) + (np.array([0.0, 0.0, 0.0]) - np.array([-4.0 + 9.0 * x, 0.6, 1.6])) * xw
    cam = Camera(eye, tg, 38)

    def post(img, cam_):
        O.label_at(img, cam_, [-11, 3.8, -1.5], "Ankomst", fade(u, 0.5, 1.1, d - 0.5, d), 30)
        O.label_at(img, cam_, [12.5, 4.0, -1.5], "Arbeid", fade(u, 0.5, 1.1, d - 0.5, d), 30)
        items = [(ts[0], "Streng, forutsigbar og bærekraftig"), (ts[1], "Kvoteflyktninger og hjelp i nærområdene"),
                 (ts[2], "Aktivitetsplikt for sosialhjelpsmottakere"), (ts[3], "Norskopplæring for foreldre utenfor arbeid"),
                 (ts[4], "Strengere norskkrav for statsborgerskap")]
        O.bullets(img, t, items, t - u + d, y=210, size=34, gap=58, title="HØYRE VIL")
        O.source(img, t, t - u + 0.5, t - u + d, "Kilde: Høyres stortingsvalgprogram 2025–2029")
    return Frame(parts, cam, Wd.day_env(), focus=dist(cam, tg), aperture=0.6, post=post, illus=True)


# ==========================================================================
# KAPITTEL 3 – TRYGGHET
# ==========================================================================
@functools.lru_cache(maxsize=None)
def _report_img():
    from PIL import Image, ImageDraw
    from .common import font
    w, h = 420, 560
    im = Image.new("RGBA", (w, h), (232, 230, 224, 255))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, w, 150), fill=(58, 62, 70, 255))
    d.text((30, 40), "Vold som", font=font("sans_sb", 52), fill=(240, 240, 236, 255))
    d.text((30, 96), "handelsvare", font=font("sans_sb", 52), fill=(240, 240, 236, 255))
    for k in range(9):
        d.rectangle((30, 200 + k * 34, 30 + (w - 60) * (0.6 + 0.4 * ((k * 37) % 10) / 10), 212 + k * 34), fill=(160, 160, 160, 255))
    return np.asarray(im, np.float32) / 255.0


def _rain(img, t):
    rng = np.random.default_rng(int(t * 25) % 50)
    m = np.zeros((H, W), np.float32)
    for _ in range(260):
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        L = rng.uniform(18, 40)
        cv2.line(m, (int(x), int(y)), (int(x - L * 0.18), int(y + L)), 0.5, 1, cv2.LINE_AA)
    over_color(img, (0.75, 0.8, 0.88), m * 0.25)


def s27(t, u, d):
    x = ease_io(u / d)
    bx = -26 + 40 * clamp01(u / d)
    screens, pos = S.phone_screens(t)
    parts = [S.city_set(), S.bus(bx)] + screens
    cam = Camera([0.0, 1.6 + 10.5 * x, 13.5 - 1.0 * x], [0.0, 2.8 + 7.0 * x, -4.0], 40)
    links = [(0, 3), (3, 5), (5, 1), (1, 7), (7, 2), (2, 4), (4, 8), (8, 6), (6, 0), (3, 8)]

    def pre(img, cam_):
        f = clamp01((u - d * 0.35) / (d * 0.4))
        polys = []
        for k, (a, b) in enumerate(links):
            g = clamp01(f * len(links) - k)
            if g > 0:
                polys.append(partial_polyline(sag(pos[a], pos[b], 0.6), g))
        lines3d(img, cam_, polys, (0.55, 0.55, 0.5), 1.6, 0.9)

    def post(img, cam_):
        _rain(img, t)
        a = fade(u, d * 0.5, d * 0.5 + 0.6, d - 0.4, d)
        if a > 0:
            r = _report_img()
            rh, rw = 330, int(330 * r.shape[1] / r.shape[0])
            rr = cv2.resize(r, (rw, rh), interpolation=cv2.INTER_AREA)
            M_ = cv2.getRotationMatrix2D((rw / 2, rh / 2), 4, 1.0)
            rr = cv2.warpAffine(rr, M_, (rw, rh))
            x0, y0 = W - rw - 90, 90
            al = rr[..., 3] * a
            img[y0:y0 + rh, x0:x0 + rw] += (rr[..., :3] - img[y0:y0 + rh, x0:x0 + rw]) * al[..., None]
        O.line_text(img, t, S_("c1") + 0.5, S_("c1", 1) - 0.3,
                    "Politiets trusselvurdering 2026: nettverk kjøper tjenester av hverandre – også vold", O.MARGIN, H - 150, 30, panel=True)
        O.line_text(img, t, S_("c1", 1), t - u + d,
                    "Kripos (2025): flere barn og unge rekrutteres til voldsoppdrag via digitale plattformer", O.MARGIN, H - 150, 30, panel=True)
        O.source(img, t, t - u + 0.5, t - u + d, "Kilde: Politiet (2026), Kripos (2025)")
    return Frame(parts, cam, Wd.night_env(S.city_lights(), fog=0.01), focus=dist(cam, [0, 4, -4]), aperture=0.6, pre=pre, post=post)


def s28(t, u, d):
    h18 = 3.0
    h23 = 3.0 * 4266 / 4461
    g = ease_out(clamp01((u - 0.3) / 1.5))
    parts = [S.crossroads_set(), K.bar(-0.7, -10.0, 1.0, 1.0, h18 * g, K.PLINTH), K.bar(0.7, -10.0, 1.0, 1.0, h23 * g, K.PLINTH),
             K.figure(0.0, 0.6, 0.85, (0.78, 0.78, 0.8), face=math.pi)]
    t_dn = S_("c2", 1) - 0.5
    x = ease_io(clamp01((t - t_dn) / 4.0))
    eye = np.array([1.5, 4.5, -2.0]) + (np.array([0.5, 2.6, 7.5]) - [1.5, 4.5, -2.0]) * x
    tg = np.array([0.0, 2.0, -10.0]) + (np.array([0.0, 0.6, -1.0]) - [0.0, 2.0, -10.0]) * x
    cam = Camera(eye, tg, 40)

    def post(img, cam_):
        O.label_at(img, cam_, [-0.7, h18 * g + 0.15, -10], "2018", g * (1 - x), 26, -12)
        O.label_at(img, cam_, [0.7, h23 * g + 0.15, -10], "2023", g * (1 - x), 26, -12)
        O.stat(img, t, Wt("c2", "Færre"), t_dn + 2.0, "4 461 – 4 266", "siktede 15–17 år, 2018 og 2023 · per 1 000: 23,8 og 21,2",
               blue=False, size=76)
        O.source(img, t, t - u + 0.5, t_dn + 2.0, "Kilde: SSB")
    env = Wd.night_env(S.crossroads_lights() + [Light((0.0, 5.0, -6.0), (0.9, 0.92, 1.0), 4.0, 3.0 * (1 - 0.7 * x))], fog=0.006)
    return Frame(parts, cam, env, focus=dist(cam, tg), aperture=0.7, post=post, illus=True)


POLICE_ROUTES = [[(13.5, -9.4), (13.5, -8.0), (-2.0, -8.0)], [(13.5, -9.4), (16.0, -9.4), (16.0, -2.0)],
                 [(13.5, -9.4), (9.0, -9.4), (9.0, -17.1), (-14.0, -17.1)], [(13.5, -9.4), (22.0, -9.4), (22.0, -24.0)],
                 [(13.5, -9.4), (6.5, -9.4), (6.5, 1.5), (-20.0, 1.5)]]


def s29(t, u, d):
    t_h = S_("c3", 1)
    if t < t_h - 0.1:
        stage, pos = S.plinth_stage(1, None)
        cam = orbit([0, 0, 0.2], 8.0 - 0.6 * ease_io(clamp01(u / 4.0)), 3.6, 0.0, 34, ty=1.3)
        env = S.studio_env(0.12, S.plinth_lights(pos, 0, [1.0]), bg=(0.035, 0.037, 0.045))

        def post(img, cam_):
            O.label_at(img, cam_, [pos[0][0], 2.45, pos[0][1]], "Regjeringen", fade(u, 0.3, 0.9, 99, 100), 34, -10)
        return Frame([stage], cam, env, focus=dist(cam, [0, 1.3, -1.0]), aperture=0.5, post=post)
    v = t - t_h
    blue = smooth(clamp01(v / 1.5))
    parts = list(Wd.town(police=False)) + [Wd.police_court(blue)]
    for i, (x, z) in enumerate(((-22, -26), (-9, -27.8), (2, -27.8))):
        parts.append(S.village(x, z, 3, seed=70 + i))
    t_m = Wt("c3", "minst")
    for i, route in enumerate(POLICE_ROUTES):
        s = (t - t_m - i * 0.3) * 1.5
        if s <= 0:
            continue
        r = np.array(route, float)
        L = np.sqrt(((r[1:] - r[:-1]) ** 2).sum(1)).sum()
        p = partial_polyline(r, min(1.0, s / L))[-1]
        parts.append(K.figure(p[0], p[1], 0.8, (0.20, 0.24, 0.34), cap="police", bob=0.02 * abs(math.sin(t * 6 + i))))
    x = ease_io(clamp01(v / (d - (t_h - (t - u)))))
    ang = 30 + 35 * x
    cam = orbit([12.0 - 8.0 * x, 0, -13.0 + 2.0 * x], 14.0 + 22.0 * x, 9.0 + 22.0 * x, ang, 36, ty=1.0)
    lights = Wd.street_lights() + [Light((Wd.POLICE[0], 2.0, Wd.POLICE[2] + 3.0), K.blue_emit(1.0), 2.0, 3.5 * blue),
                                   Light((Wd.COURT[0], 2.0, Wd.COURT[2] + 3.5), K.blue_emit(1.0), 2.0, 3.0 * blue)]

    def post(img, cam_):
        items = [(t_m, "Minst 1000 nye politifolk i distriktene"), (Wt("c3", "enklere"), "Enklere inndragning av kriminelles verdier"),
                 (Wt("c3", "strengere straff"), "Strengere straff for å utnytte unge"),
                 (Wt("c3", "raskere"), "Raskere reaksjoner på alvorlige lovbrudd")]
        O.bullets(img, t, items, t - u + d, y=210, size=34, gap=58, title="HØYRE VIL")
        O.source(img, t, t_h + 0.5, t - u + d, "Kilde: Høyres stortingsvalgprogram og valgmateriell 2025")
    return Frame(parts, cam, Wd.night_env(lights, fog=0.004), focus=dist(cam, [8, 0, -12]), aperture=0.6, post=post, illus=True)


# ==========================================================================
# SYNTESE + AVSLUTNING
# ==========================================================================
def s30(t, u, d):
    x = ease_io(u / d)
    cam = Camera([-0.8 + 0.5 * x, 3.6 + 2.0 * x, 13.0 + 6.0 * x], [-0.8, 2.0, -1.5], 32)
    c1, c2, c3 = (Wd.win_center(k) + [0, 0.1, 0.25] for k in (1, 2, 3))
    strings = [sag(c1, c2, 0.5), sag(c2, c3, 0.45), sag(c3, c1 + [0, 0.6, 0], 1.2)]
    f = clamp01((u - 0.6) / 4.0)

    def pre(img, cam_):
        polys = [partial_polyline(s, clamp01(f * 3 - k)) for k, s in enumerate(strings) if f * 3 - k > 0]
        lines3d(img, cam_, polys, (2.2, 1.9, 1.3), 2.0, 0.9, intensity=1.0)
    return Frame(Wd.street_only(), cam, Wd.night_env(Wd.street_lights(1.2)), focus=dist(cam, [-0.8, 1.8, -0.6]),
                 aperture=0.7, pre=pre, illus=True)


def s31(t, u, d):
    x = ease_io(u / d)
    dawn = smooth(clamp01(u / (d * 0.8)))
    ang = 10 + 90 * x
    cam = orbit([0.0, 0, -5.0], 46.0, 34.0, ang, 34, ty=0.0)
    lights = Wd.street_lights(1 - dawn)
    return Frame(Wd.town(lit=True, day=False), cam, Wd.dawn_env(dawn, lights), focus=dist(cam, [0, 0, -5]), aperture=0.35,
                 warm=0.01 * dawn)


def s32(t, u, d):
    s = LINES["s3"]["sents"]
    b1, b2 = s[1][0] - 0.3, s[2][0] - 0.3
    items = [(s[0][0] + 0.3, "Tydelige regler for dem som utnytter andre"),
             (s[1][0] + 0.2, "Hjelp og oppfølging for dem som sliter med rus"),
             (s[2][0] + 0.2, "Forventninger og muligheter for alle")]

    def post(img, cam_):
        O.bullets(img, t, items, t - u + d, y=H - 260, size=36, gap=62)
    if t < b1:
        # window 3: the phone is left on the bed and the football shoes are gone
        x = ease_io(clamp01((t - (t - u)) / (b1 - (t - u))))
        cam = Camera([1.3 - 0.4 * x, 1.6 - 0.15 * x, 0.6 - 0.4 * x], [-0.6, 0.6, -1.3], 42)
        return Frame([Rm.bedroom(True)] + Rm.bedroom_dyn(0.0, True, False), cam, Rm.bedroom_env(True),
                     focus=dist(cam, [-0.7, 0.57, -1.3]), aperture=0.5, post=post, illus=True, warm=0.01)
    if t < b2:
        x = ease_io(clamp01((t - b1) / (b2 - b1)))
        cam = Camera([0.9 - 0.3 * x, 1.6 - 0.15 * x, 0.6 - 0.4 * x], [-0.1, 0.85, -1.5], 42)
        return Frame([Rm.kitchen(True)] + Rm.kitchen_dyn(1.0, True, 1.0), cam, Rm.kitchen_env(True),
                     focus=dist(cam, [-0.05, 0.75, -1.25]), aperture=0.5, post=post, illus=True, warm=0.01)
    x = ease_io(clamp01((t - b2) / (t - u + d - b2)))
    cam = Camera([-0.6 + 0.3 * x, 1.55 - 0.15 * x, 0.5 - 0.4 * x], [0.05, 0.75, -0.9], 42)
    return Frame([Rm.study(True, True)] + Rm.study_dyn(True), cam, Rm.study_env(True),
                 focus=dist(cam, [0.05, 0.75, -0.85]), aperture=0.5, post=post, warm=0.01)


def s33(t, u, d):
    x = ease_io(u / d)
    cam = Camera([-0.8, 3.9 + 1.5 * x, 17.5 + 6.0 * x], STREET_C, 29 + 2 * x)
    return Frame(Wd.street_only(lit=False, day=True), cam, Wd.day_env(), focus=dist(cam, [0, 1.5, -0.6]),
                 aperture=0.6, illus=True, warm=0.01)


def s34(t, u, d):
    def draw(img):
        img[:] = np.array((0.95, 0.94, 0.91), np.float32)
        a = smooth(lin(u, 0.0, 0.8))
        dark = (0.13, 0.14, 0.16)
        if config.LOGO_PNG and os.path.exists(config.LOGO_PNG):
            lg = cv2.imread(config.LOGO_PNG, cv2.IMREAD_UNCHANGED)
            lg = cv2.cvtColor(lg, cv2.COLOR_BGRA2RGBA).astype(np.float32) / 255.0
            s = 220 / lg.shape[0]
            lg = cv2.resize(lg, (int(lg.shape[1] * s), 220), interpolation=cv2.INTER_AREA)
            y0, x0 = 300, int(W / 2 - lg.shape[1] / 2)
            al = lg[..., 3:] * a
            img[y0:y0 + 220, x0:x0 + lg.shape[1]] += (lg[..., :3] - img[y0:y0 + 220, x0:x0 + lg.shape[1]]) * al
        else:
            m = np.zeros((H, W), np.float32)
            cv2.rectangle(m, (W // 2 - 190, 300), (W // 2 + 190, 520), 1, 2, cv2.LINE_AA)
            over_color(img, (0.6, 0.6, 0.6), m * a)
            draw_text(img, "[HØYRES LOGO]", W / 2, 425, name="mono_r", size=26, color=(0.5, 0.5, 0.5), alpha=a, anchor="c")
        draw_text(img, "Produsert av Høyre", W / 2, 640, name="sans_sb", size=52, color=dark, alpha=a, anchor="c")
        url = config.URL or "[INSERT URL]"
        src = config.SOURCES_URL or "[INSERT URL TIL KILDELISTE]"
        draw_text(img, url, W / 2, 715, name="sans_m", size=34, color=dark, alpha=a, anchor="c")
        draw_text(img, f"Kilder: {src}", W / 2, 775, name="mono_r", size=24, color=(0.4, 0.4, 0.42), alpha=a, anchor="c")
        O.fade_black(img, smooth(lin(t, TOTAL - 1.4, TOTAL)))
    return Card(draw)


# ==========================================================================
# Timing: each shot starts on its narration line (see 02-shotliste.md)
# ==========================================================================
def _starts():
    return [
        ("S01", 0.0, s01),
        ("S02", S_("o2") - 0.4, s02),
        ("S03", S_("o3") - 0.4, s03),
        ("S04", S_("o4") - 0.4, s04),
        ("S05", S_("o5") - 0.4, s05),
        ("S06", E_("o5") + 0.9, s06),
        ("S07", S_("r1") - 0.6, s07),
        ("S08", S_("r2") - 0.2, s08),
        ("S09", S_("k1") - 0.6, chapter_shot(1, 1, "RUS")),
        ("S10", S_("a1") - 0.3, s10),
        ("S11", S_("a2") - 0.3, s11),
        ("S12", S_("a3") - 0.3, s12),
        ("S13", S_("a4") - 0.3, s13),
        ("S14", S_("a5") - 0.3, s14),
        ("S15", S_("a6") - 0.3, s15),
        ("S16", S_("a7") - 0.3, s16),
        ("S17", S_("a8") - 0.3, s17),
        ("S18", S_("k2") - 0.6, chapter_shot(2, 2, "INNVANDRING OG INTEGRERING")),
        ("S19", S_("b1") - 0.3, s19),
        ("S20", S_("b2") - 0.3, s20),
        ("S21", S_("b3") - 0.3, s21),
        ("S22", S_("b4") - 0.3, s22),
        ("S23", S_("b5") - 0.3, s23),
        ("S24", S_("b6") - 0.3, s24),
        ("S25", S_("b7") - 0.3, s25),
        ("S26", S_("k3") - 0.6, chapter_shot(3, 3, "TRYGGHET")),
        ("S27", S_("c1") - 0.3, s27),
        ("S28", S_("c2") - 0.3, s28),
        ("S29", S_("c3") - 0.3, s29),
        ("S30", S_("s1") - 0.4, s30),
        ("S31", S_("s2", 1) - 0.3, s31),
        ("S32", S_("s3") - 0.3, s32),
        ("S33", S_("e1") - 0.3, s33),
        ("S34", S_("e2") - 0.2, s34),
    ]


class Shot:
    def __init__(self, name, t0, t1, fn):
        self.name, self.t0, self.t1, self.fn = name, t0, t1, fn


def _shots():
    st = _starts()
    out = []
    for i, (name, t0, fn) in enumerate(st):
        t1 = st[i + 1][1] if i + 1 < len(st) else TOTAL
        out.append(Shot(name, t0, t1, fn))
    return out


SHOTS = _shots()


def shot_at(t):
    for s in SHOTS:
        if s.t0 <= t < s.t1:
            return s
    return SHOTS[-1]
