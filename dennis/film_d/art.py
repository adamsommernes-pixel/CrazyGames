# -*- coding: utf-8 -*-
"""Linjeteckningar och grafik för Dennis-filmen (instrument, stolar, café, emblem, terräng)."""
import functools
import math

import cv2
import numpy as np

from film.common import (AMBER, H, INK, INK_DIM, W, catmull, draw_text, fill_polys,
                         poly_lines, text_mask, value_noise)
from film.drawings import Drawing, circle, line, rect

WARM_INK = np.array([0.93, 0.80, 0.60], np.float32)


def _mirror(right):
    r = np.asarray(right, float)
    left = r[::-1].copy()
    left[:, 0] *= -1
    return np.vstack([r, left[1:]])


def _xf(pts, cx, cy, s, rot=0.0):
    p = np.asarray(pts, float) * s
    if rot:
        c, sn = math.cos(rot), math.sin(rot)
        p = p @ np.array([[c, sn], [-sn, c]])
    return p + np.array([cx, cy])


# --------------------------------------------------------------------------
# Instrument
# --------------------------------------------------------------------------
def violin(d, cx, cy, s=1.0, group=0, color=INK, rot=0.0):
    """Fiol, kroppens mitt vid (cx,cy). Höjd ca 620*s."""
    X = lambda p: _xf(p, cx, cy, s, rot)  # noqa: E731
    body_r = [(0, -180), (38, -178), (70, -168), (84, -140), (80, -105), (66, -80), (52, -58),
              (47, -30), (52, -2), (70, 20), (96, 50), (106, 100), (96, 150), (62, 176), (0, 184)]
    body = catmull(_mirror(body_r), 6)
    d.add(X(body), 2.0, color, 1.0, group, wob=0.4)
    # inre kant (purfling)
    d.add(X(body * 0.94 + np.array([0, 2])), 0.9, color, 0.55, group, wob=0.3)
    # f-hål
    for sg in (-1, 1):
        f = catmull([(sg * 30, -40), (sg * 36, -20), (sg * 40, 10), (sg * 36, 40), (sg * 30, 58)], 6)
        d.add(X(f), 1.4, color, 0.9, group, wob=0.2)
        d.add(X(circle(sg * 30, -42, 3.5, n=10)), 1.2, color, 0.9, group, wob=0.0)
        d.add(X(circle(sg * 30, 60, 3.5, n=10)), 1.2, color, 0.9, group, wob=0.0)
    # greppbräda + hals
    d.add(X(line((-14, -410), (-16, -180), (-20, 20), (20, 20), (16, -180), (14, -410))), 1.6, color, 1.0, group, wob=0.2)
    # snäcka + skruvlåda
    d.add(X(line((-12, -410), (-14, -470), (14, -470), (12, -410))), 1.4, color, 0.9, group, wob=0.2)
    sc = [(0, -470)]
    for k in range(40):
        a = -math.pi / 2 + k * 0.28
        r = 22 - k * 0.45
        sc.append((r * math.cos(a) * 0.8, -492 + r * math.sin(a)))
    d.add(X(sc), 1.5, color, 1.0, group, wob=0.1)
    for sg, yy in ((-1, -425), (1, -440), (-1, -455), (1, -465)):
        d.add(X(line((sg * 13, yy), (sg * 34, yy - 2))), 3.0, color, 0.8, group, wob=0.1)
    # stall + stränghållare
    d.add(X(line((-34, 36), (-26, 28), (26, 28), (34, 36))), 1.6, color, 1.0, group, wob=0.1)
    d.add(X(line((-16, 70), (-24, 150), (0, 166), (24, 150), (16, 70), (-16, 70))), 1.4, color, 0.9, group, wob=0.1)
    # strängar
    for k, (xa, xb) in enumerate(((-7, -18), (-2.5, -6), (2.5, 6), (7, 18))):
        d.add(X(line((xa, -410), (xb * 0.9, 28), (xb * 0.8, 70))), 0.7, color, 0.8, group, wob=0.0)
    return d


def guitar(d, cx, cy, s=1.0, group=0, color=INK, strings=6, rot=0.0, uke=False):
    """Gitarr (eller ukulele med uke=True), kroppens mitt vid (cx,cy)."""
    X = lambda p: _xf(p, cx, cy, s, rot)  # noqa: E731
    if uke:
        body_r = [(0, -150), (50, -146), (84, -122), (92, -80), (78, -40), (72, -10), (90, 40), (110, 90),
                  (104, 140), (70, 172), (0, 180)]
        hole, neck_len, head = (0, -40, 34), 330, 90
    else:
        body_r = [(0, -210), (70, -205), (118, -175), (128, -120), (106, -60), (100, -30), (130, 40),
                  (152, 110), (146, 180), (100, 226), (0, 236)]
        hole, neck_len, head = (0, -70, 50), 470, 130
    body = catmull(_mirror(body_r), 6)
    d.add(X(body), 2.0, color, 1.0, group, wob=0.4)
    d.add(X(body * 0.95), 0.8, color, 0.45, group, wob=0.3)
    d.add(X(circle(hole[0], hole[1], hole[2], n=48)), 1.6, color, 1.0, group, wob=0.2)
    d.add(X(circle(hole[0], hole[1], hole[2] + 8, n=48)), 0.8, color, 0.6, group, wob=0.2)
    top = body_r[0][1]
    nw = 20 if uke else 24
    d.add(X(line((-nw, top + 10), (-nw + 3, top - neck_len), (nw - 3, top - neck_len), (nw, top + 10))), 1.6, color, 1.0, group, wob=0.2)
    # band
    L = neck_len
    for k in range(1, 12 if not uke else 9):
        y = top - L + L * (1 - 2 ** (-k / 6.0)) * 1.55
        if y > top:
            break
        d.add(X(line((-nw + 3, y), (nw - 3, y))), 0.7, color, 0.6, group, wob=0.0)
    # huvud
    hy = top - neck_len
    d.add(X(line((-nw + 3, hy), (-nw - 8, hy - head), (nw + 8, hy - head), (nw - 3, hy))), 1.6, color, 1.0, group, wob=0.2)
    per = strings // 2
    for k in range(per):
        yy = hy - head * (k + 1) / (per + 1)
        for sg in (-1, 1):
            d.add(X(circle(sg * (nw + 20), yy, 6, n=14)), 1.3, color, 0.9, group, wob=0.0)
            d.add(X(line((sg * (nw + 4), yy), (sg * (nw + 14), yy))), 1.2, color, 0.9, group, wob=0.0)
    # stall
    by = body_r[-1][1] * 0.55
    d.add(X(rect(-60 if not uke else -40, by - 8, 60 if not uke else 40, by + 8)), 1.4, color, 0.9, group, wob=0.1)
    # strängar
    for k in range(strings):
        u = (k - (strings - 1) / 2) / max(1, strings - 1)
        d.add(X(line((u * (nw * 1.4), hy), (u * (nw * 1.8), by))), 0.6, color, 0.75, group, wob=0.0)
    return d


# --------------------------------------------------------------------------
# Två stolar (att lyssna)
# --------------------------------------------------------------------------
def chairs(cx=960, base=760, s=1.0, color=INK):
    d = Drawing()
    X = lambda p: _xf(p, cx, base, s)  # noqa: E731
    for sg, g in ((-1, 0), (1, 1)):
        ox = sg * 230
        # rygg (ytterkant), sits, ben
        back = [(ox + sg * 70, -330), (ox + sg * 62, -160)]
        d.add(X(catmull([(ox + sg * 76, -340), (ox + sg * 70, -250), (ox + sg * 64, -160)], 8)), 2.2, color, 1.0, g)
        d.add(X(line((ox + sg * 76, -340), (ox + sg * 40, -338))), 1.8, color, 1.0, g)
        d.add(X(catmull([(ox + sg * 40, -338), (ox + sg * 36, -250), (ox + sg * 34, -175)], 8)), 1.6, color, 0.9, g)
        d.add(X(line((ox + sg * 64, -160), (ox - sg * 70, -160), (ox - sg * 74, -146), (ox + sg * 64, -146))), 2.0, color, 1.0, g)
        d.add(X(line((ox + sg * 58, -146), (ox + sg * 62, 0))), 2.0, color, 1.0, g)
        d.add(X(line((ox - sg * 64, -146), (ox - sg * 68, 0))), 2.0, color, 1.0, g)
        d.add(X(line((ox + sg * 60, -80), (ox - sg * 66, -80))), 1.0, color, 0.6, g)
        _ = back
    # litet bord med två koppar
    d.add(X(line((-46, -110), (46, -110))), 2.0, color, 1.0, 2)
    d.add(X(line((0, -110), (0, 0))), 1.8, color, 1.0, 2)
    d.add(X(line((-26, 0), (26, 0))), 1.6, color, 1.0, 2)
    for ox in (-22, 16):
        d.add(X(line((ox - 9, -128), (ox - 7, -111), (ox + 7, -111), (ox + 9, -128))), 1.3, color, 0.9, 2)
    # golv
    d.add(X(line((-420, 0), (420, 0))), 1.0, color, 0.5, 3, wob=1.0)
    return d


# --------------------------------------------------------------------------
# Telefon (enkel UI-mock)
# --------------------------------------------------------------------------
def rounded_rect_mask(x0, y0, x1, y1, r, shape=(H, W)):
    m = np.zeros(shape, np.float32)
    k = 16
    cv2.rectangle(m, (int((x0 + r) * k), int(y0 * k)), (int((x1 - r) * k), int(y1 * k)), 1.0, -1, cv2.LINE_AA, 4)
    cv2.rectangle(m, (int(x0 * k), int((y0 + r) * k)), (int(x1 * k), int((y1 - r) * k)), 1.0, -1, cv2.LINE_AA, 4)
    for cx, cy in ((x0 + r, y0 + r), (x1 - r, y0 + r), (x0 + r, y1 - r), (x1 - r, y1 - r)):
        cv2.circle(m, (int(cx * k), int(cy * k)), int(r * k), 1.0, -1, cv2.LINE_AA, 4)
    return m


# --------------------------------------------------------------------------
# Café-fasad
# --------------------------------------------------------------------------
def cafe_facade(cx=960, base=900, s=1.0, color=INK):
    """Returnerar (Drawing, fönsterrektanglar i skärmkoordinater, skylt-position)."""
    d = Drawing()
    X = lambda p: _xf(p, cx, base, s)  # noqa: E731
    # huset
    d.add(X(line((-520, 0), (-520, -620), (520, -620), (520, 0))), 2.2, color, 1.0, 0)
    d.add(X(line((-560, -620), (0, -840), (560, -620))), 2.2, color, 1.0, 0)
    d.add(X(line((-600, 0), (600, 0))), 1.6, color, 0.8, 0, wob=1.0)
    # takfönster
    d.add(X(circle(0, -700, 46, n=40)), 1.6, color, 0.9, 0)
    d.add(X(line((-46, -700), (46, -700))), 1.0, color, 0.7, 0)
    d.add(X(line((0, -746), (0, -654))), 1.0, color, 0.7, 0)
    # markis
    aw = [(-470, -385), (470, -385), (500, -320), (-500, -320), (-470, -385)]
    d.add(X(aw), 2.0, color, 1.0, 1)
    for k in range(9):
        xa = -470 + k * 117.5
        xb = -500 + k * 125
        d.add(X(line((xa, -385), (xb, -320))), 1.0, color, 0.7, 1)
    scal = [(-500 + k * 62.5, -320 + (8 if k % 2 else 0)) for k in range(17)]
    d.add(X(catmull(scal, 4)), 1.2, color, 0.8, 1)
    # dörr + skyltfönster
    d.add(X(rect(-60, -280, 60, 0)), 2.0, color, 1.0, 2)
    d.add(X(rect(-40, -250, 40, -120)), 1.0, color, 0.7, 2)
    d.add(X(circle(42, -140, 4, n=10)), 1.2, color, 1.0, 2)
    wins = []
    for x0, x1 in ((-440, -130), (130, 440)):
        d.add(X(rect(x0, -280, x1, -40)), 2.0, color, 1.0, 2)
        d.add(X(line(((x0 + x1) / 2, -280), ((x0 + x1) / 2, -40))), 1.2, color, 0.8, 2)
        d.add(X(line((x0 - 14, -40), (x1 + 14, -40))), 1.6, color, 0.9, 2)
        wins.append((X([(x0, -280)])[0], X([(x1, -40)])[0]))
    # övervåning fönster
    for x0 in (-400, -130, 150, 400):
        w = 110
        d.add(X(rect(x0 - w / 2, -560, x0 + w / 2, -440)), 1.6, color, 0.9, 3)
        d.add(X(line((x0, -560), (x0, -440))), 0.9, color, 0.6, 3)
        d.add(X(line((x0 - w / 2, -500), (x0 + w / 2, -500))), 0.9, color, 0.6, 3)
    # skyltbräda
    d.add(X(rect(-230, -430, 230, -395)), 1.2, color, 0.8, 4)
    sign = X([(0, -405)])[0]
    return d, wins, sign


# --------------------------------------------------------------------------
# Bord uppifrån: koppar + bullar
# --------------------------------------------------------------------------
def table_top(cx=960, cy=540, s=1.0, color=INK):
    d = Drawing()
    X = lambda p: _xf(p, cx, cy, s)  # noqa: E731
    d.add(X(circle(0, 0, 400, n=220)), 2.0, color, 0.9, 0, wob=0.6)
    cups = [((-150, -120), 1.0), ((150, -140), 0.72), ((210, 110), 0.72), ((-80, 190), 0.72), ((-250, 60), 0.72)]
    for i, ((x, y), k) in enumerate(cups):
        g = 1 + i
        d.add(X(circle(x, y, 70 * k, n=80)), 1.6, color, 1.0, g, wob=0.2)
        d.add(X(circle(x, y, 44 * k, n=64)), 1.8, color, 1.0, g, wob=0.2)
        d.add(X(circle(x, y, 36 * k, n=56)), 0.8, color, 0.6, g, wob=0.2)
        d.add(X(catmull([(x + 44 * k, y - 10 * k), (x + 66 * k, y - 12 * k), (x + 70 * k, y + 8 * k), (x + 44 * k, y + 10 * k)], 6)),
              1.6, color, 1.0, g, wob=0.1)
    # kanelbullar
    for i, (x, y) in enumerate(((40, 30), (110, 60))):
        sp = [(x + (3 + a * 5.2) * math.cos(a * 1.0), y + (3 + a * 5.2) * math.sin(a * 1.0)) for a in np.linspace(0, 16, 140)]
        d.add(X(sp), 1.6, AMBER, 0.9, 6, wob=0.3)
    return d, [(X([c])[0], 44 * k * s) for c, k in cups]


# --------------------------------------------------------------------------
# Skoavtryck (löparsko)
# --------------------------------------------------------------------------
def shoe_print(mask, x, y, s=1.0, ang=0.0, value=1.0, flip=False):
    sg = -1 if flip else 1
    c, sn = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    outline = catmull([(0, -48), (13, -44), (17, -26), (13, -6), (11, 8), (14, 26), (10, 44), (0, 50),
                       (-10, 44), (-13, 26), (-11, 8), (-15, -6), (-17, -26), (-13, -44), (0, -48)], 5)
    p = outline * np.array([sg, 1.0]) * s
    p = p @ np.array([[c, sn], [-sn, c]]) + np.array([x, y])
    fill_polys(mask, [p], value)
    # tvärränder
    for yy in (-30, -14, 2, 20, 36):
        q = np.array([(-12, yy), (12, yy)], float) * s
        q = q @ np.array([[c, sn], [-sn, c]]) + np.array([x, y])
        poly_lines(mask, [q], max(1, int(2.5 * s)), value=0.0)
    return mask


# --------------------------------------------------------------------------
# Emblem med text runt en cirkel
# --------------------------------------------------------------------------
def ring_text(img, text, cx, cy, r, size=22, color=INK, alpha=1.0, start=-math.pi / 2, name="sans_m", tracking=0.3):
    from film.common import font
    f = font(name, size)
    widths = [f.getlength(ch) + tracking * size for ch in text]
    total = sum(widths)
    ang = start - (total / r) / 2
    for ch, w in zip(text, widths):
        a_mid = ang + (w / 2) / r
        if ch != " ":
            m, base, tw, pad = text_mask(ch, name, size, 0.0)
            hh, ww = m.shape
            # tecknets mittpunkt på cirkeln, uppåt = ut från centrum
            px = cx + r * math.cos(a_mid)
            py = cy + r * math.sin(a_mid)
            rot = math.degrees(a_mid + math.pi / 2)
            M = cv2.getRotationMatrix2D((pad + tw / 2, base - size * 0.35), -rot, 1.0)
            M[0, 2] += px - (pad + tw / 2)
            M[1, 2] += py - (base - size * 0.35)
            wm = cv2.warpAffine(m, M, (W, H), flags=cv2.INTER_LINEAR)
            from film.common import over_color
            over_color(img, color, wm * alpha)
        ang += w / r
    return img


# --------------------------------------------------------------------------
# Terräng med höjdkurvor (för löpning)
# --------------------------------------------------------------------------
TW, TH = 4200, 2600


@functools.lru_cache(maxsize=1)
def topo():
    """Returnerar (kurvbild float (TH,TW), höjdfält)."""
    n = value_noise(TH, TW, 900, 21, 5)
    n = cv2.GaussianBlur(n, (0, 0), 6)
    lo, hi = np.percentile(n, 1), np.percentile(n, 99)
    n = np.clip((n - lo) / (hi - lo), 0, 1)
    m = np.zeros((TH, TW), np.float32)
    levels = np.linspace(0.04, 0.96, 34)
    for i, lv in enumerate(levels):
        b = (n > lv).astype(np.uint8)
        cs, _ = cv2.findContours(b, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
        pts = [c[:, 0, :].astype(np.float64) for c in cs if len(c) > 20]
        v = 1.0 if i % 5 == 0 else 0.45
        poly_lines(m, pts, 1, closed=True, value=v)
    return m, n


def trail_points():
    """Slingrande stig genom terrängen (terrängpixlar)."""
    pts = [(300, 1900), (700, 1700), (1000, 1850), (1350, 1600), (1500, 1250), (1850, 1100), (2250, 1250),
           (2600, 1050), (2800, 750), (3200, 650), (3550, 850), (3900, 700)]
    return catmull(pts, 24)
