# -*- coding: utf-8 -*-
"""Linjeteckningar som ritas fram streck för streck (bläck på mörkt papper)."""
import math

import cv2
import numpy as np

from .common import (AMBER, H, INK, INK_DIM, RED, W, arc_between, catmull,
                     clamp01, dashed, dot, draw_text, fill_polys, over_color,
                     paper_texture, partial_polyline, poly_lines,
                     polyline_length, value_noise, wobble)


# --------------------------------------------------------------------------
# Byggstenar
# --------------------------------------------------------------------------
def rect(x0, y0, x1, y1):
    return np.array([(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)], float)


def line(*pts):
    return np.array(pts, float)


def circle(cx, cy, r, a0=0.0, a1=2 * math.pi, n=None):
    n = n or max(12, int(abs(a1 - a0) * r / 3))
    a = np.linspace(a0, a1, n)
    return np.stack([cx + r * np.cos(a), cy + r * np.sin(a)], 1)


def arch_window(cx, ybot, w, h):
    """Rundbågefönster."""
    r = w / 2
    left = [(cx - r, ybot), (cx - r, ybot - h + r)]
    top = circle(cx, ybot - h + r, r, math.pi, 2 * math.pi, 16)
    right = [(cx + r, ybot - h + r), (cx + r, ybot), (cx - r, ybot)]
    return np.vstack([left, top, right])


def hatch(poly, spacing=7, angle=-35, jitter=0.0, seed=0):
    """Parallella skuggstreck inom polygon (enkel scanline)."""
    poly = np.asarray(poly, float)
    a = math.radians(angle)
    d = np.array([math.cos(a), math.sin(a)])
    nrm = np.array([-d[1], d[0]])
    proj = poly @ nrm
    lo, hi = proj.min(), proj.max()
    out = []
    rng = np.random.default_rng(seed)
    for off in np.arange(lo + spacing / 2, hi, spacing):
        # skärningar med polygonkanter
        xs = []
        for i in range(len(poly) - 1):
            p, q = poly[i], poly[i + 1]
            pa, qa = p @ nrm - off, q @ nrm - off
            if (pa > 0) != (qa > 0):
                u = pa / (pa - qa)
                xs.append(p + (q - p) * u)
        if len(xs) >= 2:
            xs.sort(key=lambda v: v @ d)
            for j in range(0, len(xs) - 1, 2):
                a_, b_ = xs[j], xs[j + 1]
                if jitter:
                    a_ = a_ + d * rng.uniform(0, jitter)
                    b_ = b_ - d * rng.uniform(0, jitter)
                out.append(np.array([a_, b_]))
    return out


class Drawing:
    def __init__(self):
        self.strokes = []   # (pts, width, color, alpha, group)

    def add(self, pts, width=1.6, color=INK, alpha=1.0, group=0, wob=0.7, seed=None):
        pts = np.asarray(pts, float)
        if wob > 0:
            pts = wobble(pts, amp=wob, freq=0.045, seed=len(self.strokes) if seed is None else seed)
        self.strokes.append((pts, width, np.asarray(color, np.float32), alpha, group))
        return self

    def add_many(self, lst, **kw):
        for p in lst:
            self.add(p, **kw)
        return self

    def lengths(self, group=None):
        return [polyline_length(s[0]) for s in self.strokes if group is None or s[4] == group]

    def render(self, img, progress, group_progress=None, offset=(0, 0), scale=1.0,
               glow=0.35, tip=True, alpha=1.0, sketch=True):
        """progress: 0..1 över alla streck (i ordning). group_progress: dict grupp->0..1
        (ersätter progress för den gruppen)."""
        ox, oy = offset
        layer = np.zeros((H, W, 3), np.float32)
        amask = np.zeros((H, W), np.float32)
        total = sum(polyline_length(s[0]) for s in self.strokes if group_progress is None or s[4] not in group_progress)
        drawn = total * progress
        acc = 0.0
        tip_pt = None
        by_group_len = {}
        if group_progress:
            for s in self.strokes:
                if s[4] in group_progress:
                    by_group_len[s[4]] = by_group_len.get(s[4], 0) + polyline_length(s[0])
        g_acc = {}
        for pts, width, color, a, group in self.strokes:
            L = polyline_length(pts)
            if group_progress is not None and group in group_progress:
                gl = by_group_len[group] * group_progress[group]
                ga = g_acc.get(group, 0.0)
                g_acc[group] = ga + L
                frac = clamp01((gl - ga) / max(L, 1e-6))
            else:
                frac = clamp01((drawn - acc) / max(L, 1e-6))
                acc += L
            if frac <= 0:
                continue
            p = partial_polyline(pts, frac) * scale + np.array([ox, oy])
            if len(p) < 2:
                continue
            m = np.zeros((H, W), np.float32)
            poly_lines(m, [p], width)
            if width < 1:
                m *= width
            if sketch and width >= 1:
                # andra, svagare drag för skissad känsla
                poly_lines(m, [p + np.array([0.6, -0.4])], 1, value=0.35)
            m = np.clip(m, 0, 1) * a
            layer += m[..., None] * color[None, None, :]
            amask = np.maximum(amask, m)
            if 0 < frac < 1:
                tip_pt = p[-1]
        img *= (1 - amask[..., None] * alpha)
        img += layer * alpha
        if glow > 0:
            g = cv2.GaussianBlur(layer, (0, 0), 3.0)
            img += g * glow * alpha
        if tip and tip_pt is not None:
            dot(img, tip_pt[0], tip_pt[1], 1.6, np.array([1.0, 0.9, 0.7], np.float32), alpha, glow=0.8)
        return img


def ink_paper(tint=(0.035, 0.04, 0.045), seed=2, grid=0.0, grid_step=48, grid_color=(0.3, 0.4, 0.45)):
    """Mörkt papper med fibrer och valfritt rutnät (ritning)."""
    img = np.empty((H, W, 3), np.float32)
    img[:] = np.asarray(tint, np.float32)
    img += paper_texture(seed)[..., None] * 0.02
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H / 2) / H) ** 2)
    img *= (1.15 - r * 0.6)[..., None]
    if grid > 0:
        m = np.zeros((H, W), np.float32)
        for x in range(0, W, grid_step):
            m[:, x] = 1
        for y in range(0, H, grid_step):
            m[y, :] = 1
        m2 = np.zeros((H, W), np.float32)
        for x in range(0, W, grid_step * 5):
            m2[:, x:x + 1] = 1
        for y in range(0, H, grid_step * 5):
            m2[y:y + 1, :] = 1
        img += (m * 0.5 + m2)[..., None] * np.asarray(grid_color, np.float32) * grid * 0.06
    return img


# --------------------------------------------------------------------------
# Motiv
# --------------------------------------------------------------------------
def church(cx=960, base=820, s=1.0):
    """Medeltida gråstenskyrka med västtorn (Jomala-typ)."""
    d = Drawing()
    S = lambda *p: np.array(p, float) * s + np.array([cx, base]) * (1 - s) if False else None  # noqa
    def P(pts):
        a = np.asarray(pts, float)
        return np.stack([cx + a[:, 0] * s, base + a[:, 1] * s], 1)
    # mark
    d.add(P([(-520, 0), (520, 0)]), 1.2, INK_DIM, 0.8, group=0)
    # torn
    tw, th = 170, 330
    tx0 = -330
    d.add(P([(tx0, 0), (tx0, -th), (tx0 + tw, -th), (tx0 + tw, 0)]), 1.8)
    # tornspira: brant pyramid med utsvängd fot
    d.add(P([(tx0 - 12, -th), (tx0 + tw / 2, -th - 260), (tx0 + tw + 12, -th)]), 1.8)
    d.add(P([(tx0 - 12, -th), (tx0 + tw + 12, -th)]), 1.4)
    d.add(P([(tx0 + tw / 2, -th - 260), (tx0 + tw / 2, -th - 300)]), 1.4)
    d.add(P([(tx0 + tw / 2 - 16, -th - 285), (tx0 + tw / 2 + 16, -th - 285)]), 1.4)
    # ljudgluggar
    for gx in (tx0 + 45, tx0 + tw - 45):
        d.add(P(arch_window(gx, -th + 70, 26, 52)[:, :] * [1, 1]), 1.3)
    # långhus
    nx0, nx1, nh = tx0 + tw, 360, 190
    d.add(P([(nx0, -nh), (nx1, -nh), (nx1, 0)]), 1.8)
    # brant sadeltak
    d.add(P([(nx0, -nh), (nx0 + 20, -nh - 150), (nx1 - 6, -nh - 150), (nx1 + 22, -nh)]), 1.8)
    d.add(P([(nx1 + 22, -nh), (nx1, -nh)]), 1.4)
    # gavel mot öster med kors
    d.add(P([(nx1, 0), (nx1 + 90, 0), (nx1 + 90, -150), (nx1 + 22, -nh + 40)]), 1.5)
    d.add(P([(nx1 + 90, -150), (nx1 + 22, -nh - 150 + 8)]), 1.2, alpha=0.8)
    # fönster
    for wx in (-60, 70, 200):
        d.add(P(arch_window(wx, -60, 30, 78)), 1.3)
    # portal
    d.add(P(arch_window(tx0 + tw / 2, 0, 56, 110)), 1.6)
    # stenfogar (antydan)
    rng = np.random.default_rng(3)
    for _ in range(38):
        x = rng.uniform(tx0 + 8, nx1 - 20)
        y = rng.uniform(-nh + 14, -8) if x > nx0 else rng.uniform(-th + 20, -8)
        w_ = rng.uniform(14, 34)
        d.add(P([(x, y), (x + w_, y + rng.uniform(-2, 2))]), 0.8, INK_DIM, 0.55, group=2)
    # skuggning på tornets högra sida och taket
    for h_ in hatch(P([(tx0 + tw - 50, -th + 4), (tx0 + tw - 4, -th + 4), (tx0 + tw - 4, -4), (tx0 + tw - 50, -4), (tx0 + tw - 50, -th + 4)]), 8, -60):
        d.add(h_, 0.8, INK_DIM, 0.6, group=3, wob=0.3)
    for h_ in hatch(P([(nx0 + 24, -nh - 144), (nx1 - 8, -nh - 144), (nx1 + 16, -nh - 4), (nx0 + 4, -nh - 4), (nx0 + 24, -nh - 144)]), 11, 20):
        d.add(h_, 0.7, INK_DIM, 0.45, group=3, wob=0.3)
    # träd till vänster
    for tx, ts in ((-470, 1.0), (-430, 0.7), (470, 0.85)):
        pts = []
        for k in range(9):
            a = math.pi / 2 + (k - 4) * 0.36
            rr = 60 * ts * (1 + 0.15 * math.sin(k * 2.1))
            pts.append((tx + math.cos(a) * rr * 0.8, -110 * ts - math.sin(a) * rr - 20))
        d.add(P(catmull(pts, 6)), 1.0, INK_DIM, 0.7, group=4)
        d.add(P([(tx, 0), (tx, -80 * ts)]), 1.2, INK_DIM, 0.7, group=4)
    return d


def castle(cx=960, base=780, s=1.0):
    """Kastelholm: medeltida borg på klippa vid vatten."""
    d = Drawing()

    def P(pts):
        a = np.asarray(pts, float)
        return np.stack([cx + a[:, 0] * s, base + a[:, 1] * s], 1)
    # klippa
    rock = [(-560, 40), (-470, 10), (-380, -8), (-250, -20), (-100, -26), (60, -22), (230, -14), (380, 2), (520, 26), (600, 44)]
    d.add(P(catmull(rock, 6)), 1.6)
    for h_ in hatch(P(np.vstack([catmull(rock, 6), [(600, 60), (-560, 60), (-560, 40)]])), 9, -30, jitter=6, seed=2):
        d.add(h_, 0.8, INK_DIM, 0.55, group=3, wob=0.4)
    # huvudbyggnad (hög, brant tak)
    d.add(P([(-300, -22), (-300, -300), (40, -300), (40, -26)]), 1.9)
    d.add(P([(-312, -300), (-240, -410), (-20, -410), (52, -300)]), 1.9)
    d.add(P([(-312, -300), (52, -300)]), 1.3)
    # torn höger (kvadratiskt, högt)
    d.add(P([(40, -26), (40, -380), (170, -380), (170, -18)]), 1.9)
    d.add(P([(30, -380), (105, -470), (180, -380)]), 1.9)
    d.add(P([(30, -380), (180, -380)]), 1.3)
    # ringmur till höger + runt torn
    d.add(P([(170, -120), (330, -120), (330, -8)]), 1.6)
    for k in range(6):
        x = 180 + k * 25
        d.add(P([(x, -120), (x, -134), (x + 13, -134), (x + 13, -120)]), 1.1, alpha=0.9)
    d.add(P([(330, -170), (330, -8)]), 1.4)
    d.add(P(circle(330, -170, 0.1, 0, 0.1, 2)), 0.1)
    d.add(P([(300, -170), (360, -170), (360, -4), (300, -4)]), 1.6)
    d.add(P([(292, -170), (330, -225), (368, -170)]), 1.6)
    # vänster lägre flygel
    d.add(P([(-300, -180), (-460, -180), (-460, -6)]), 1.6)
    d.add(P([(-470, -180), (-430, -240), (-300, -240)]), 1.6)
    # fönster (smala gluggar)
    for x, y in [(-240, -250), (-160, -250), (-80, -250), (-240, -160), (-80, -160), (90, -300), (120, -220), (90, -140), (-400, -110)]:
        d.add(P(arch_window(x, y, 14, 34)), 1.1)
    # portal
    d.add(P(arch_window(-130, -26, 50, 90)), 1.5)
    # skugga på tornsidan
    for h_ in hatch(P([(130, -376), (166, -376), (166, -22), (130, -26), (130, -376)]), 7, -70):
        d.add(h_, 0.8, INK_DIM, 0.6, group=3, wob=0.3)
    for h_ in hatch(P([(-240, -404), (-24, -404), (40, -306), (-300, -306), (-240, -404)]), 10, 15):
        d.add(h_, 0.7, INK_DIM, 0.45, group=3, wob=0.3)
    # vattenlinje och speglingar
    d.add(P([(-640, 64), (640, 64)]), 1.0, INK_DIM, 0.7, group=5)
    rng = np.random.default_rng(9)
    for k in range(26):
        y = 80 + k * 7 + rng.uniform(-2, 2)
        x = rng.uniform(-520, 420)
        w_ = rng.uniform(40, 180) * (1 - k / 34)
        d.add(P([(x, y), (x + w_, y)]), 0.8, INK_DIM, 0.55 * (1 - k / 30), group=5, wob=0.3)
    return d


def three_crowns(cx=960, cy=250, s=1.0):
    d = Drawing()
    def crown(x, y, k):
        pts = [(-40, 22), (-46, -18), (-24, 0), (-12, -30), (0, -8), (12, -30), (24, 0), (46, -18), (40, 22), (-40, 22)]
        a = np.array(pts, float) * k * s + np.array([x, y])
        d.add(a, 1.8, AMBER, 1.0, group=7, wob=0.3)
        d.add(np.array([(-40, 12), (40, 12)], float) * k * s + np.array([x, y]), 1.2, AMBER, 0.9, group=7, wob=0.2)
    crown(cx - 70 * s, cy, 1.0)
    crown(cx + 70 * s, cy, 1.0)
    crown(cx, cy + 90 * s, 1.0)
    return d


def fortress_plan(cx=960, cy=560, s=1.0):
    """Bomarsund: hästskoformat huvudfäste + torn. Byggda delar (grupp 1),
    aldrig byggda (grupp 6, streckade)."""
    d = Drawing()

    def P(pts):
        a = np.asarray(pts, float)
        return np.stack([cx + a[:, 0] * s, cy + a[:, 1] * s], 1)
    # strandlinje (sund i öster)
    shore = [(420, -470), (380, -300), (400, -150), (370, 20), (390, 180), (350, 340), (380, 480)]
    d.add(P(catmull(shore, 8)), 1.2, INK_DIM, 0.8, group=0)
    shore2 = [(560, -470), (530, -250), (560, -60), (520, 140), (560, 330), (530, 480)]
    d.add(P(catmull(shore2, 8)), 1.2, INK_DIM, 0.8, group=0)
    # huvudfäste: halvcirkel (yttre och inre)
    R1, R2 = 250, 190
    ccx, ccy = 180, 0
    outer = circle(ccx, ccy, R1, math.pi / 2, 3 * math.pi / 2, 80)
    inner = circle(ccx, ccy, R2, math.pi / 2, 3 * math.pi / 2, 70)
    d.add(P(outer), 2.2, group=1)
    d.add(P(inner), 1.8, group=1)
    d.add(P([(ccx, ccy - R1), (ccx, ccy - R2)]), 2.0, group=1)
    d.add(P([(ccx, ccy + R1), (ccx, ccy + R2)]), 2.0, group=1)
    # fasad mot vattnet
    d.add(P([(ccx, ccy - R1), (ccx + 26, ccy - R1), (ccx + 26, ccy + R1), (ccx, ccy + R1)]), 2.0, group=1)
    # kasematter: radiella streck
    for a in np.linspace(math.pi / 2 + 0.06, 3 * math.pi / 2 - 0.06, 34):
        p0 = (ccx + R2 * math.cos(a), ccy + R2 * math.sin(a))
        p1 = (ccx + R1 * math.cos(a), ccy + R1 * math.sin(a))
        d.add(P([p0, p1]), 0.9, INK_DIM, 0.8, group=2, wob=0.2)
    # gårdsplan: port + ringväg
    d.add(P(circle(ccx - R2 - 30, ccy, 10)), 1.2, group=2)
    # torn (runda) – byggda
    towers = [(-330, -260, 60, "Brännklint"), (-120, 330, 55, "Notvik"), (720, -80, 55, "Prästö")]
    for x, y, r, _ in towers:
        d.add(P(circle(x, y, r)), 2.0, group=1)
        d.add(P(circle(x, y, r * 0.55)), 1.2, group=1)
        for a in np.linspace(0, 2 * math.pi, 12, endpoint=False):
            d.add(P([(x + r * 0.55 * math.cos(a), y + r * 0.55 * math.sin(a)),
                     (x + r * math.cos(a), y + r * math.sin(a))]), 0.8, INK_DIM, 0.7, group=2, wob=0.1)
    # planerade men aldrig byggda torn och murar
    planned = [(-420, 120, 50), (-40, -420, 50), (620, 330, 50), (-560, -60, 45), (80, 460, 45)]
    for x, y, r in planned:
        for seg in dashed(P(circle(x, y, r, 0, 2 * math.pi, 60)), 8, 7):
            d.add(seg, 1.2, INK_DIM, 0.7, group=6, wob=0.0)
    wall = [(-600, -380), (-420, -470), (-120, -520), (160, -500)]
    for seg in dashed(P(catmull(wall, 10)), 12, 8):
        d.add(seg, 1.2, INK_DIM, 0.7, group=6, wob=0.0)
    wall2 = [(-620, 200), (-500, 400), (-250, 520), (80, 560)]
    for seg in dashed(P(catmull(wall2, 10)), 12, 8):
        d.add(seg, 1.2, INK_DIM, 0.7, group=6, wob=0.0)
    return d, [(cx + x * s, cy + y * s, n) for x, y, r, n in towers], (cx + ccx * s, cy + ccy * s)


def barque_profile(cx=960, wl=700, s=1.0):
    """Detaljerad profil av en fyrmastad bark (Pommern)."""
    d = Drawing()

    def P(pts):
        a = np.asarray(pts, float)
        return np.stack([cx + a[:, 0] * s, wl - a[:, 1] * s], 1)
    L = 760
    # skrov
    sheer = catmull([(-L / 2, 70), (-L / 4, 58), (0, 55), (L / 4, 60), (L / 2, 76), (L / 2 + 40, 92)], 10)
    keel = catmull([(-L / 2 + 20, -40), (-L / 4, -48), (L / 4, -48), (L / 2 - 30, -30)], 10)
    d.add(P(sheer), 2.0, group=1)
    d.add(P(np.vstack([[(-L / 2, 70)], [(-L / 2 - 14, 30)], [(-L / 2 + 20, -40)]])), 2.0, group=1)
    d.add(P(keel), 2.0, group=1)
    d.add(P([(L / 2 - 30, -30), (L / 2 + 10, 20), (L / 2 + 40, 92)]), 2.0, group=1)
    d.add(P([(-L / 2 + 5, 0), (L / 2 + 8, 0)]), 1.0, INK_DIM, 0.8, group=1)  # vattenlinje
    # ränder/dekor
    d.add(P(catmull([(-L / 2 + 6, 44), (0, 32), (L / 2 + 16, 50)], 10)), 1.0, INK_DIM, 0.8, group=2)
    for k in range(14):
        x = -L / 2 + 60 + k * 48
        d.add(P(circle(x, 42 + 0.00004 * x * x, 3.2)), 0.9, INK_DIM, 0.9, group=2, wob=0)
    # bogspröt
    d.add(P([(L / 2 + 30, 84), (L / 2 + 190, 140)]), 1.8, group=1)
    masts = [L / 2 - 140, L / 2 - 310, L / 2 - 480, L / 2 - 650]
    heights = [440, 460, 440, 330]
    for i, (mx, mh) in enumerate(zip(masts, heights)):
        d.add(P([(mx, 58), (mx, 58 + mh)]), 1.9, group=3)
        if i < 3:
            ys = np.linspace(110, 58 + mh - 30, 6)
            for j, y in enumerate(ys):
                hw = 120 - j * 16
                d.add(P([(mx - hw, y), (mx + hw, y)]), 1.4, group=3)
            # segel (svagt buktande)
            for j in range(5):
                y0, y1 = ys[j] + 4, ys[j + 1] - 4
                w0, w1 = 116 - j * 16, 116 - (j + 1) * 16
                sail = catmull([(mx - w0, y0), (mx - w1 - 6, (y0 + y1) / 2), (mx - w1, y1)], 6)
                sail2 = catmull([(mx + w0, y0), (mx + w1 + 6, (y0 + y1) / 2), (mx + w1, y1)], 6)
                d.add(P(sail), 1.0, INK, 0.8, group=4)
                d.add(P(sail2), 1.0, INK, 0.8, group=4)
                d.add(P(catmull([(mx - w0, y0), (mx, y0 - 8), (mx + w0, y0)], 6)), 0.9, INK_DIM, 0.8, group=4)
        else:
            d.add(P([(mx, 110), (mx - 150, 120)]), 1.4, group=3)
            d.add(P([(mx, 330), (mx - 140, 280)]), 1.4, group=3)
            d.add(P(catmull([(mx - 150, 120), (mx - 158, 200), (mx - 140, 280)], 6)), 1.0, INK, 0.8, group=4)
    # stag
    tops = [(m, 58 + h) for m, h in zip(masts, heights)]
    d.add(P([(L / 2 + 190, 140), tops[0]]), 0.9, INK_DIM, 0.9, group=5, wob=0)
    d.add(P([(L / 2 + 120, 118), (masts[0], 380)]), 0.9, INK_DIM, 0.9, group=5, wob=0)
    for a, b in zip(tops[:-1], tops[1:]):
        d.add(P([a, (b[0], b[1] - 60)]), 0.9, INK_DIM, 0.9, group=5, wob=0)
    for m, h in zip(masts, heights):
        for k in range(4):
            d.add(P([(m - 30 + k * 4, 60), (m, 58 + h * 0.62)]), 0.7, INK_DIM, 0.7, group=5, wob=0)
            d.add(P([(m + 30 - k * 4, 60), (m, 58 + h * 0.62)]), 0.7, INK_DIM, 0.7, group=5, wob=0)
    d.add(P([tops[-1], (-L / 2 - 10, 72)]), 0.9, INK_DIM, 0.9, group=5, wob=0)
    # vattenkrusningar
    rng = np.random.default_rng(4)
    for k in range(22):
        y = -12 - k * 6
        x = rng.uniform(-L / 2 - 60, L / 2)
        w_ = rng.uniform(40, 160)
        d.add(P([(x, y), (x + w_, y)]), 0.8, INK_DIM, 0.5 * (1 - k / 26), group=6, wob=0.3)
    return d


def victoria_cross(cx=960, cy=560, s=1.0):
    """Kors pattée med krona och lejon (förenklat), upphängning och band."""
    d = Drawing()
    def P(pts):
        a = np.asarray(pts, float)
        return np.stack([cx + a[:, 0] * s, cy + a[:, 1] * s], 1)
    arm = 150
    pts = []
    for k in range(4):
        a = k * math.pi / 2
        c, sn = math.cos(a), math.sin(a)
        def R(x, y):
            return (x * c - y * sn, x * sn + y * c)
        pts += [R(38, -26), R(arm, -86), R(arm - 8, 0), R(arm, 86), R(38, 26)]
    pts.append(pts[0])
    outer = np.array(pts)
    d.add(P(outer), 2.2, AMBER, 1.0, group=1, wob=0.3)
    inner = outer * 0.86
    d.add(P(inner), 1.2, AMBER, 0.8, group=1, wob=0.3)
    d.add(P(circle(0, 0, 44)), 1.6, AMBER, 0.9, group=2)
    # krona i mitten
    crown = [(-30, 8), (-32, -18), (-18, -6), (-8, -24), (0, -10), (8, -24), (18, -6), (32, -18), (30, 8), (-30, 8)]
    d.add(P(crown), 1.4, AMBER, 0.9, group=2, wob=0.2)
    # skriftrulle
    d.add(P([(-70, 60), (70, 60), (76, 78), (-76, 78), (-70, 60)]), 1.2, AMBER, 0.8, group=2, wob=0.2)
    # upphängning
    d.add(P([(0, -arm + 8), (0, -arm - 40)]), 1.6, AMBER, 1.0, group=3)
    d.add(P([(-26, -arm - 56), (0, -arm - 30), (26, -arm - 56)]), 1.6, AMBER, 1.0, group=3)
    d.add(P([(-80, -arm - 64), (80, -arm - 64)]), 2.0, AMBER, 1.0, group=3)
    # band
    rb = [(-70, -arm - 72), (-70, -arm - 260), (70, -arm - 260), (70, -arm - 72), (-70, -arm - 72)]
    d.add(P(rb), 1.6, RED, 1.0, group=4)
    for h_ in hatch(P(rb), 6, 90):
        d.add(h_, 0.9, RED, 0.6, group=5, wob=0.1)
    return d


def hemicycle_seats(n=30, cx=960, cy=720, r0=180, r1=340, rows=4):
    """Platser i halvcirkel (parlament)."""
    seats = []
    radii = np.linspace(r0, r1, rows)
    weights = radii / radii.sum()
    counts = np.round(weights * n).astype(int)
    counts[-1] += n - counts.sum()
    for r, c in zip(radii, counts):
        for a in np.linspace(math.pi, 2 * math.pi, c):
            seats.append((cx + r * math.cos(a), cy + r * math.sin(a), a))
    seats.sort(key=lambda s: s[2])
    return [(x, y) for x, y, _ in seats]


def table_topdown(cx=960, cy=560, s=1.0):
    d = Drawing()
    def P(pts):
        a = np.asarray(pts, float)
        return np.stack([cx + a[:, 0] * s, cy + a[:, 1] * s], 1)
    d.add(P(rect(-420, -110, 420, 110)), 2.0, group=1)
    d.add(P(rect(-408, -98, 408, 98)), 0.9, INK_DIM, 0.8, group=1)
    for k in range(6):
        x = -350 + k * 140
        for sgn in (-1, 1):
            y = sgn * 160
            d.add(P(rect(x - 30, y - 22, x + 30, y + 22)), 1.4, group=2)
            d.add(P([(x - 30, y + sgn * 22), (x + 30, y + sgn * 22)]), 2.2, group=2)
    for sgn, x in ((-1, -470), (1, 470)):
        d.add(P(rect(x - 22, -30, x + 22, 30)), 1.4, group=2)
    rng = np.random.default_rng(2)
    for k in range(6):
        x = -350 + k * 140
        for sgn in (-1, 1):
            y = sgn * 55
            a = rng.uniform(-0.2, 0.2)
            c, sn = math.cos(a), math.sin(a)
            pr = np.array([(-26, -34), (26, -34), (26, 34), (-26, 34), (-26, -34)])
            pr = pr @ np.array([[c, sn], [-sn, c]]) + np.array([x, y])
            d.add(P(pr), 1.0, INK_DIM, 0.9, group=3)
            for j in range(4):
                yy = -20 + j * 12
                q = np.array([(-18, yy), (rng.uniform(4, 18), yy)]) @ np.array([[c, sn], [-sn, c]]) + np.array([x, y])
                d.add(P(q), 0.7, INK_DIM, 0.6, group=3, wob=0.2)
    return d


def scribble(x, y, w, h, rng, loops=None):
    """Handstil-liknande krumelur (ett ord/en namnteckning)."""
    n = loops or rng.integers(4, 10)
    pts = []
    xs = np.linspace(x, x + w, n * 3)
    for i, xx in enumerate(xs):
        amp = h * (0.25 + 0.55 * rng.random())
        yy = y - amp * (1 if i % 3 == 1 else (-0.15 if i % 3 == 2 else 0.1))
        pts.append((xx + rng.normal(0, w / n * 0.15), yy))
    return catmull(pts, 5)


def document(kind="treaty", seed=1, cx=960, cy=540, w=760, h=940):
    """Papper (ljusare) + rader. Returnerar (bakgrundsfunktion, Drawing)."""
    rng = np.random.default_rng(seed)
    d = Drawing()
    x0, y0 = cx - w / 2, cy - h / 2
    ink = np.array([0.16, 0.12, 0.09], np.float32)
    y = y0 + 190
    if kind == "treaty":
        lines = 15
        for i in range(lines):
            xx = x0 + 80
            while xx < x0 + w - 110:
                ww = rng.uniform(30, 110)
                d.add(scribble(xx, y, ww, 14, rng), 1.3, ink, 0.9, group=1, wob=0.2)
                xx += ww + rng.uniform(12, 22)
            y += 34
        # underskrifter
        for k, xs in enumerate((x0 + 90, x0 + 300, x0 + 510)):
            d.add(scribble(xs, y0 + h - 170, 170, 30, rng, 9), 1.6, ink, 1.0, group=2, wob=0.4)
            d.add(line((xs, y0 + h - 150), (xs + 170, y0 + h - 150)), 0.8, ink, 0.6, group=2, wob=0.2)
    else:  # petition: namnteckningar i kolumner
        cols = 3
        cw = (w - 120) / cols
        for c in range(cols):
            yy = y0 + 170
            for r in range(24):
                ww = rng.uniform(cw * 0.45, cw * 0.85)
                d.add(scribble(x0 + 60 + c * cw, yy, ww, 12, rng), 1.1, ink, 0.9, group=1, wob=0.25)
                yy += 30
    return d, (x0, y0, w, h)


def paper_sheet(img, rect_, alpha=1.0, tone=(0.78, 0.72, 0.60), seed=4, rot=0.0):
    x0, y0, w, h = rect_
    tex = paper_texture(seed)
    m = np.zeros((H, W), np.float32)
    c = np.array([x0 + w / 2, y0 + h / 2])
    pts = np.array([(x0, y0), (x0 + w, y0), (x0 + w, y0 + h), (x0, y0 + h)], float) - c
    cr, sr = math.cos(rot), math.sin(rot)
    pts = pts @ np.array([[cr, sr], [-sr, cr]]) + c
    fill_polys(m, [pts])
    # skugga
    sh = cv2.GaussianBlur(m, (0, 0), 18)
    over_color(img, (0, 0, 0), np.roll(sh, (14, 10), (0, 1)) * 0.6 * alpha)
    col = np.asarray(tone, np.float32)[None, None, :] * (1 + tex[..., None] * 0.35)
    # mörkare kanter (åldrat)
    edge = cv2.GaussianBlur(m, (0, 0), 30)
    col = col * (0.72 + 0.28 * edge[..., None])
    img += (col - img) * (m * alpha)[..., None]
    return img


def wax_seal(img, x, y, r, alpha=1.0, t=1.0):
    """Lacksigill."""
    yy, xx = np.mgrid[-int(r * 1.6):int(r * 1.6) + 1, -int(r * 1.6):int(r * 1.6) + 1].astype(np.float32)
    ang = np.arctan2(yy, xx)
    rr = np.sqrt(xx * xx + yy * yy) / (r * (1 + 0.06 * np.sin(ang * 7) + 0.03 * np.sin(ang * 13)))
    m = np.clip((1 - rr) * r * 0.5, 0, 1) * alpha
    inner = np.clip((0.72 - rr) * r * 0.5, 0, 1)
    ring_ = np.clip(1 - np.abs(rr - 0.72) * r * 0.4, 0, 1)
    shade = 0.75 + 0.35 * (-(xx + yy) / (r * 2.2))
    col = np.stack([0.48 * shade, 0.06 * shade, 0.05 * shade], -1).astype(np.float32)
    col -= ring_[..., None] * 0.08
    col += inner[..., None] * np.array([0.03, 0.0, 0.0], np.float32)
    x0, y0 = int(x - xx.shape[1] // 2), int(y - xx.shape[0] // 2)
    over_color(img, (0, 0, 0), cv2.GaussianBlur(m, (0, 0), 5) * 0.5, x0 + 4, y0 + 6)
    from .common import over
    over(img, col, m, x0, y0)
    return img
