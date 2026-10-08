# -*- coding: utf-8 -*-
"""Stand-alone sets: title letters, the Norway map, the evidence board, the party
plinths, and the small dioramas for chapters 2 and 3."""
import functools
import json
import math
import os

import cv2
import numpy as np
from PIL import Image, ImageDraw

from . import kit as K
from . import mesh as M
from .common import ASSETS, BLUE, font
from .mesh import GRAIN, NOSHADOW, PANELS, UNLIT, WET, box, cylinder, merge
from .raster import Env, Light


def studio_env(key=1.0, lights=(), bg=(0.05, 0.055, 0.065), warm=0.0):
    return Env(sky=(0.20, 0.21, 0.23), gnd=(0.05, 0.045, 0.04), sun=(-0.35, 0.85, 0.55),
               sun_col=(1.0 * key, 0.95 * key, 0.88 * key), bg_top=bg, bg_bot=tuple(np.asarray(bg) * 0.4),
               lights=list(lights), shadow_res=2048)


# --------------------------------------------------------------------------
# Title letters
# --------------------------------------------------------------------------
@functools.lru_cache(maxsize=None)
def glyph_polys(ch, name="sans_b", size=400):
    """Outline polygons of one character (world units = em), and its advance."""
    from shapely.geometry import Polygon
    f = font(name, size)
    adv = f.getlength(ch)
    asc, desc = f.getmetrics()
    im = Image.new("L", (int(adv + size), asc + desc + 40), 0)
    ImageDraw.Draw(im).text((20, 20), ch, font=f, fill=255)
    a = np.asarray(im)
    cnts, hier = cv2.findContours((a > 127).astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    polys = []
    if hier is None:
        return [], adv / size
    hier = hier[0]
    for i, c in enumerate(cnts):
        if hier[i][3] != -1:
            continue
        ext = cv2.approxPolyDP(c, 1.2, True)[:, 0, :].astype(float)
        holes = []
        j = hier[i][2]
        while j != -1:
            holes.append(cv2.approxPolyDP(cnts[j], 1.2, True)[:, 0, :].astype(float))
            j = hier[j][0]
        def tf(p):
            return np.stack([(p[:, 0] - 20) / size, (asc + 20 - p[:, 1]) / size], 1)
        pg = Polygon(tf(ext), [tf(h) for h in holes]).buffer(0)
        if pg.area > 0:
            polys.append(pg)
    return polys, adv / size


def letter_mesh(ch, height, depth, col, side_col):
    """Letter standing upright on y=0, facing +z, thickness depth (z from -depth..0)."""
    polys, adv = glyph_polys(ch)
    out = []
    for pg in polys:
        # extrude in (x, z) then stand up: polygon y -> world y
        m = M.extrude_polygon(pg, 0, depth, col, side_col)
        # extrude_polygon builds in x/z plane with height along y; rotate so glyph-y becomes world y
        V = m.V.copy()
        m.V = np.stack([V[:, 0] * height, V[:, 2] * height, V[:, 1] - depth], 1)
        out.append(m)
    return merge(out), adv * height


# --------------------------------------------------------------------------
# Norway map
# --------------------------------------------------------------------------
@functools.lru_cache(maxsize=None)
def norway_polys():
    from shapely.geometry import Polygon
    f = json.load(open(os.path.join(ASSETS, "geo", "norway.geojson")))
    out = []
    for poly in f["geometry"]["coordinates"]:
        ring = np.asarray(poly[0])
        lon, lat = ring[:, 0], ring[:, 1]
        if lat.mean() > 71.5 or lon.mean() < 4 or lat.mean() < 57:
            continue
        x = (lon - 15.0) * math.cos(math.radians(65)) * 1.0
        z = -(lat - 65.0)
        pg = Polygon(np.stack([x, z], 1)).buffer(0)
        if pg.area > 0.02:
            out.append(pg.simplify(0.03))
    return out


def map_xy(lon, lat):
    return (lon - 15.0) * math.cos(math.radians(65)), -(lat - 65.0)


@functools.lru_cache(maxsize=None)
def norway_terrain(seed=2):
    """Low-poly relief: random interior points + coast points, Delaunay, heights by
    distance from the coast with noise. Returns (V, F, base_heights)."""
    from scipy.spatial import Delaunay
    from shapely.geometry import Point
    from shapely.prepared import prep
    rng = np.random.default_rng(seed)
    allV, allF, allH, allB = [], [], [], []
    off = 0
    for pg in norway_polys():
        P = prep(pg)
        coast = []
        for ring in [pg.exterior]:
            L = ring.length
            n = max(8, int(L / 0.12))
            for k in range(n):
                p = ring.interpolate(k / n, normalized=True)
                coast.append((p.x, p.y))
        coast = np.array(coast)
        x0, z0, x1, z1 = pg.bounds
        cnt = int(pg.area / 0.03) + 4
        pts = []
        tries = 0
        while len(pts) < cnt and tries < cnt * 20:
            q = rng.uniform([x0, z0], [x1, z1], (cnt, 2))
            for qq in q:
                if P.contains(Point(qq)):
                    pts.append(qq)
            tries += cnt
        pts = np.array(pts[:cnt]) if pts else np.zeros((0, 2))
        allp = np.vstack([coast, pts]) if len(pts) else coast
        if len(allp) < 3:
            continue
        tri = Delaunay(allp)
        keep = []
        for s in tri.simplices:
            c = allp[s].mean(0)
            if P.contains(Point(c)):
                keep.append(s)
        if not keep:
            continue
        keep = np.array(keep)
        d = np.array([pg.exterior.distance(Point(p)) for p in allp])
        d[:len(coast)] = 0
        # mountains: stronger in the west/south-centre spine
        ridge = np.exp(-((allp[:, 0] + 1.5 - 0.35 * (allp[:, 1] + 3)) ** 2) / 8.0)
        h = np.clip(d, 0, 1.2) ** 0.8 * (0.35 + 0.65 * ridge) * (0.7 + 0.6 * rng.random(len(allp))) * 0.55
        allV.append(np.stack([allp[:, 0], np.zeros(len(allp)), allp[:, 1]], 1))
        allH.append(h)
        allF.append(keep + off)
        # boundary edges for skirts
        from collections import Counter
        ec = Counter()
        for s in keep:
            for a, b in ((s[0], s[1]), (s[1], s[2]), (s[2], s[0])):
                ec[(min(a, b), max(a, b))] += 1
        allB += [(a + off, b + off) for (a, b), c in ec.items() if c == 1]
        off += len(allp)
    return np.vstack(allV), np.vstack(allF), np.concatenate(allH), np.array(allB)


def terrain_mesh(rise=1.0, colour=1.0, paper=(0.93, 0.91, 0.86), scale=1.0, y0=0.0):
    V, F, Hh, B = norway_terrain()
    V = V.copy()
    V[:, 1] = y0 + Hh * rise
    tv = V[F]
    hmean = Hh[F].mean(1)
    low, mid, high = np.array(K.MOSS), np.array((0.62, 0.60, 0.55)), np.array((0.93, 0.93, 0.92))
    c = np.where(hmean[:, None] < 0.12, low,
                 np.where(hmean[:, None] < 0.3, low + (mid - low) * ((hmean[:, None] - 0.12) / 0.18), mid + (high - mid) * np.clip((hmean[:, None] - 0.3) / 0.15, 0, 1)))
    c = np.asarray(paper) * (1 - colour) + c * colour
    # make faces point up
    n = np.cross(tv[:, 1] - tv[:, 0], tv[:, 2] - tv[:, 0])[:, 1]
    F = np.where((n < 0)[:, None], F[:, ::-1], F)
    top = M.Mesh(V, F, c.astype(np.float32), flags=GRAIN)
    # skirts down to the table
    nB = len(B)
    SV = np.concatenate([V[B[:, 0]], V[B[:, 1]], V[B[:, 1]] * [1, 0, 1] + [0, y0 - 0.05, 0], V[B[:, 0]] * [1, 0, 1] + [0, y0 - 0.05, 0]])
    idx = np.arange(nB)
    SF = np.concatenate([np.stack([idx, idx + nB, idx + 2 * nB], 1), np.stack([idx, idx + 2 * nB, idx + 3 * nB], 1)])
    sk = M.Mesh(SV, SF, tuple(np.asarray(paper) * (1 - colour) + np.array((0.55, 0.52, 0.47)) * colour))
    m = merge([top, sk])
    m.V *= scale
    return m


def paper_sheet(unfold, x0=-6.5, z0=-8.5, x1=6.5, z1=8.5, col=(0.93, 0.91, 0.86)):
    """Map sheet in three panels; unfold 0 = folded stack, 1 = flat."""
    w = (x1 - x0) / 3
    parts = [box(x0 + w, 0.0, z0, x0 + 2 * w, 0.01, z1, col, flags=GRAIN)]
    a = (1 - unfold) * math.pi * 0.98
    left = box(x0, 0.0, z0, x0 + w, 0.01, z1, tuple(np.asarray(col) * 0.97), flags=GRAIN).rotz(-a, about=(x0 + w, 0, 0))
    right = box(x0 + 2 * w, 0.0, z0, x1, 0.01, z1, tuple(np.asarray(col) * 0.98), flags=GRAIN).rotz(a * 0.99, about=(x0 + 2 * w, 0, 0)).move(0, 0.015 * (1 - unfold), 0)
    return merge(parts + [left, right])


def table_top(col=(0.34, 0.28, 0.23), size=30):
    return M.ground(-size, -size, size, size, -0.02, col, 6, 6, flags=GRAIN | PANELS)


# --------------------------------------------------------------------------
# Evidence board
# --------------------------------------------------------------------------
BOARD_W, BOARD_H = 6.0, 3.6


def board_set():
    p = [M.quad((-12, -2, -0.3), (12, -2, -0.3), (12, 8, -0.3), (-12, 8, -0.3), (0.55, 0.53, 0.5), flags=GRAIN),
         box(-BOARD_W / 2, 0, -0.3, BOARD_W / 2, BOARD_H, -0.15, (0.62, 0.46, 0.31), flags=GRAIN, obj=50),
         box(-BOARD_W / 2 - 0.12, -0.12, -0.3, BOARD_W / 2 + 0.12, 0.0, -0.1, (0.45, 0.33, 0.24), flags=GRAIN),
         box(-BOARD_W / 2 - 0.12, BOARD_H, -0.3, BOARD_W / 2 + 0.12, BOARD_H + 0.12, -0.1, (0.45, 0.33, 0.24), flags=GRAIN),
         box(-BOARD_W / 2 - 0.12, 0, -0.3, -BOARD_W / 2, BOARD_H, -0.1, (0.45, 0.33, 0.24), flags=GRAIN),
         box(BOARD_W / 2, 0, -0.3, BOARD_W / 2 + 0.12, BOARD_H, -0.1, (0.45, 0.33, 0.24), flags=GRAIN)]
    return merge(p)


def pin(x, y, col=(0.86, 0.85, 0.82), z=-0.15):
    return merge([cylinder(x, y, z, 0.012, 0.012, 0.1, (0.7, 0.7, 0.72), n=5).rotx(math.pi / 2, about=(x, y, z)),
                  M.sphere(x, y, z + 0.1, 0.05, col, nu=8, nv=5)])


def paper_card(cx, cy, w, h, z=-0.145, col=(0.95, 0.94, 0.9), tilt=0.0, obj=0, lift=0.0):
    m = box(-w / 2, -h / 2, 0.0, w / 2, h / 2, 0.012, col, obj=obj)
    m.rotz(tilt)
    return m.move(cx, cy, z + lift)


def card_corners(cx, cy, w, h, z=-0.13, tilt=0.0, lift=0.0):
    c = np.array([[-w / 2, h / 2], [w / 2, h / 2], [w / 2, -h / 2], [-w / 2, -h / 2]])
    R = np.array([[math.cos(tilt), -math.sin(tilt)], [math.sin(tilt), math.cos(tilt)]])
    c = c @ R.T
    return np.stack([c[:, 0] + cx, c[:, 1] + cy, np.full(4, z + 0.0125 + lift)], 1)


def clipping_img(section, headline, w=900, h=640, stamp=None):
    """Newspaper clipping texture (generic section masthead, never a real paper)."""
    im = Image.new("RGBA", (w, h), (243, 240, 230, 255))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, w, 70), fill=(40, 42, 46, 255))
    d.text((30, 14), section, font=font("cond_sb", 44), fill=(240, 238, 230, 255))
    y = 100
    words = headline.split()
    line, lines = "", []
    fb = font("sans_sb", 58)
    for wd in words:
        cand = (line + " " + wd).strip()
        if fb.getlength(cand) > w - 60 and line:
            lines.append(line)
            line = wd
        else:
            line = cand
    lines.append(line)
    for ln in lines:
        d.text((30, y), ln, font=fb, fill=(25, 26, 30, 255))
        y += 70
    y += 16
    rng = np.random.default_rng(len(headline))
    while y < h - 40:
        L = rng.uniform(0.6, 1.0) * (w - 60)
        d.rectangle((30, y, 30 + L, y + 10), fill=(150, 150, 150, 255))
        y += 26
    a = np.asarray(im, np.float32) / 255.0
    return a


def note_img(text, w=360, h=240):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    b = tuple(int(c * 255) for c in BLUE)
    d.rectangle((0, 0, w, h), fill=b + (255,))
    f = font("sans_sb", 120)
    tw = f.getlength(text)
    d.text(((w - tw) / 2, 40), text, font=f, fill=(245, 245, 245, 255))
    return np.asarray(im, np.float32) / 255.0


def stamp_doc_img(w=900, h=1200, stamp_alpha=1.0):
    im = Image.new("RGBA", (w, h), (246, 245, 240, 255))
    d = ImageDraw.Draw(im)
    rng = np.random.default_rng(3)
    y = 90
    d.rectangle((60, y, 520, y + 24), fill=(60, 60, 64, 255))
    y += 80
    while y < h - 100:
        L = rng.uniform(0.5, 1.0) * (w - 120)
        d.rectangle((60, y, 60 + L, y + 12), fill=(165, 165, 165, 255))
        y += 30
    if stamp_alpha > 0:
        st = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        sd = ImageDraw.Draw(st)
        c = (60, 64, 72, int(220 * stamp_alpha))
        f = font("cond_sb", 120)
        txt = "LOVVEDTAK"
        tw = f.getlength(txt)
        sd.rectangle((w / 2 - tw / 2 - 30, 520, w / 2 + tw / 2 + 30, 680), outline=c, width=10)
        sd.text((w / 2 - tw / 2, 530), txt, font=f, fill=c)
        st = st.rotate(-8, center=(w / 2, 600), resample=Image.BICUBIC)
        im = Image.alpha_composite(im, st)
    return np.asarray(im, np.float32) / 255.0


# --------------------------------------------------------------------------
# Party plinths
# --------------------------------------------------------------------------
def plinth_stage(n, symbols=None, radius=3.2, arc=1.9):
    """n identical grey plinths in an arc on a round platform, all equal."""
    p = [K.platform(0, 0, radius + 1.6, 0.25, (0.30, 0.31, 0.33), n=40),
         M.ground(-30, -30, 30, 30, 0.0, (0.12, 0.12, 0.13), 6, 6)]
    pos = []
    for k in range(n):
        a = (k - (n - 1) / 2) * (arc / max(1, n - 1)) if n > 1 else 0.0
        x, z = radius * math.sin(a), -radius * math.cos(a) + radius * 0.35
        pos.append((x, z, a))
        p.append(K.plinth(x, z, 1.1, 1.25).move(0, 0.25, 0))
        if symbols and symbols[k]:
            p.append(symbols[k](x, 1.58, z))
    return merge(p), pos


def plinth_lights(pos, active, levels=None):
    """One identical spot per plinth; the active one is brighter."""
    L = []
    for k, (x, z, a) in enumerate(pos):
        lv = levels[k] if levels is not None else (1.0 if k == active else 0.35)
        L.append(Light((x, 5.5, z + 1.2), (1.0, 0.97, 0.92), 3.0, 9.0 * lv, direction=(0, -1, -0.22), cone=(14, 26)))
    return L


# --------------------------------------------------------------------------
# Small dioramas for chapter 2 and 3
# --------------------------------------------------------------------------
SNOW = (0.93, 0.94, 0.96)


@functools.lru_cache(maxsize=2)
def station_winter():
    p = [M.ground(-20, -12, 20, 12, 0.0, SNOW, 10, 6, flags=GRAIN),
         K.diorama_base(-20, -12, 20, 12)]
    # tracks
    for r in (-0.35, 0.35):
        p.append(box(-20, 0.0, 3.0 + r - 0.05, 20, 0.12, 3.0 + r + 0.05, (0.45, 0.45, 0.47)))
    for x in np.arange(-20, 20, 0.7):
        p.append(box(x, 0.0, 2.4, x + 0.25, 0.06, 3.6, (0.38, 0.32, 0.27)))
    # platform
    p.append(box(-12, 0.0, 0.6, 12, 0.45, 2.2, (0.62, 0.62, 0.62), flags=GRAIN))
    p.append(box(-12, 0.45, 0.6, 12, 0.48, 2.2, SNOW))
    # station building with snowy roof (warm windows)
    h = K.house(0, -2.0, 7.0, 3.4, 1, (0.72, 0.44, 0.35), SNOW, 1, {(0, 0): K.WARM_LIGHT, (0, 1): K.WARM_LIGHT * 1.2, (0, 2): K.WARM_LIGHT},
                wins=3, door=True, chimney=True, seed=5)
    p.append(h)
    # waiting room door glow
    p.append(box(-2.65, 0.25, -0.29, -1.95, 1.5, -0.27, (1, 0.9, 0.7), emit=K.WARM_LIGHT * 0.8, flags=UNLIT, obj=60))
    # canopy and lamps
    for x in (-8, -4, 4, 8):
        p.append(box(x - 0.05, 0.48, 1.35, x + 0.05, 2.6, 1.45, (0.3, 0.3, 0.32)))
        p.append(K.street_lamp(x, 1.9, 2.9, 0.3, -1))
    p.append(box(-10, 2.6, 0.6, 10, 2.72, 2.2, (0.42, 0.44, 0.47)))
    p.append(box(-10, 2.72, 0.6, 10, 2.78, 2.2, SNOW))
    # train waiting at the platform
    for k in range(2):
        x = 3.5 + k * 6.3
        p.append(box(x, 0.2, 2.55, x + 6.0, 2.1, 3.45, (0.52, 0.56, 0.60), flags=GRAIN))
        p.append(box(x, 2.1, 2.55, x + 6.0, 2.2, 3.45, SNOW))
        for wx in np.arange(x + 0.5, x + 5.6, 1.0):
            p.append(box(wx, 1.0, 2.53, wx + 0.6, 1.6, 2.55, (0.4, 0.36, 0.3), emit=K.WARM_LIGHT * 0.3, flags=UNLIT))
    for i, x in enumerate((-15, -12.5, 12, 15.5, -17)):
        p.append(K.tree(x, -6 + (i % 2) * 2, 3.0, "spruce", col=(0.38, 0.45, 0.38), seed=i))
        p.append(M.sphere(x, 1.2, -6 + (i % 2) * 2, 0.01, SNOW))
    return merge(p)


def station_lights():
    L = [K.lamp_light(x, 1.9, 2.9, 0.3, -1, power=3.0) for x in (-8, -4, 4, 8)]
    L += [K.window_light(x, 1.0, -0.3, 1, K.WARM_LIGHT, 1.0) for x in (-1.75, 0.0, 1.75)]
    return L


def winter_env():
    return Env(sky=(0.16, 0.19, 0.26), gnd=(0.10, 0.11, 0.13), sun=(-0.5, 0.6, 0.6), sun_col=(0.16, 0.19, 0.28),
               bg_top=(0.07, 0.09, 0.14), bg_bot=(0.03, 0.035, 0.05), fog=(0.10, 0.12, 0.16),
               fog_density=0.02, fog_start=8, lights=station_lights(), shadow_res=2048)


@functools.lru_cache(maxsize=2)
def workplace_set():
    """Cut-away: half hospital ward, half workshop."""
    p = [box(-6, -0.1, -4, 6, 0.0, 2, (0.70, 0.70, 0.68), flags=GRAIN),
         box(-6, 0, -4.12, 6, 3.0, -4, (0.84, 0.84, 0.82), flags=GRAIN),
         box(-6.12, 0, -4.12, -6, 3.0, 2, (0.84, 0.84, 0.82), flags=GRAIN),
         box(6, 0, -4.12, 6.12, 3.0, 2, (0.62, 0.60, 0.56), flags=GRAIN),
         box(-0.06, 0, -4, 0.06, 3.0, -1.0, (0.8, 0.8, 0.78)),
         box(0, -0.099, -4, 6, 0.001, 2, (0.5, 0.5, 0.5), flags=GRAIN)]
    # ward: bed, curtain rail, cabinet
    p.append(box(-5.2, 0.5, -3.6, -3.4, 0.7, -2.6, (0.92, 0.93, 0.94)))
    for x in (-5.1, -3.5):
        for z in (-3.5, -2.7):
            p.append(box(x - 0.04, 0, z - 0.04, x + 0.04, 0.5, z + 0.04, (0.6, 0.62, 0.65)))
    p.append(box(-5.2, 0.7, -3.6, -4.8, 0.85, -2.6, (0.95, 0.95, 0.95)))
    p.append(box(-3.0, 0, -3.95, -2.2, 1.2, -3.5, (0.80, 0.84, 0.86)))
    p.append(box(-2.0, 0.0, -1.6, -1.95, 2.0, -1.0, (0.60, 0.72, 0.74)))
    # workshop: bench, tools, machine
    p.append(box(1.0, 0.85, -3.9, 4.5, 0.95, -3.1, (0.55, 0.42, 0.30), flags=GRAIN))
    for x in (1.1, 4.4):
        p.append(box(x - 0.05, 0, -3.85, x + 0.05, 0.85, -3.15, (0.3, 0.3, 0.32)))
    p.append(box(1.2, 1.4, -3.98, 4.3, 2.4, -3.94, (0.5, 0.5, 0.5)))
    for x in np.arange(1.4, 4.2, 0.35):
        p.append(box(x, 1.7, -3.93, x + 0.05, 2.1, -3.9, (0.25, 0.25, 0.27)))
    p.append(box(4.8, 0, -3.5, 5.8, 1.6, -2.3, (0.45, 0.55, 0.52), flags=GRAIN))
    p.append(cylinder(5.3, 1.6, -2.9, 0.2, 0.2, 0.3, (0.3, 0.3, 0.32), n=8))
    p.append(box(3.2, 0.95, -3.7, 3.6, 1.25, -3.4, (0.3, 0.3, 0.3)))                 # coffee machine
    return merge(p)


def workplace_people():
    return [K.figure(-4.2, -2.2, 0.95, (0.92, 0.93, 0.95)), K.figure(2.6, -2.8, 0.95, (0.50, 0.56, 0.62), face=math.pi),
            K.figure(5.0, -1.9, 0.95, (0.62, 0.58, 0.52), face=-0.6)]


@functools.lru_cache(maxsize=2)
def stairs_set(steps=6):
    p = [M.ground(-14, -20, 14, 8, 0.0, (0.5, 0.5, 0.48), 6, 6, flags=GRAIN)]
    for k in range(steps):
        p.append(box(-7 + k * 1.6, 0, -2 - k * 0.0, -7 + (k + 1) * 1.6, 0.35 * (k + 1), 2.0, (0.74, 0.72, 0.68), flags=GRAIN))
    # landing and university portico on top
    top = 0.35 * steps
    x0 = -7 + steps * 1.6
    p.append(box(x0, 0, -6, x0 + 9, top, 4, (0.74, 0.72, 0.68), flags=GRAIN))
    p.append(box(x0 + 3, top, -5.5, x0 + 9, top + 4.2, -2.0, (0.86, 0.84, 0.80), flags=GRAIN))
    for x in np.linspace(x0 + 3.4, x0 + 8.6, 5):
        p.append(cylinder(x, top, -1.2, 0.2, 0.18, 3.6, (0.92, 0.91, 0.88), n=10))
    p.append(box(x0 + 3, top + 3.6, -2.0, x0 + 9, top + 4.0, -0.8, (0.92, 0.91, 0.88)))
    p.append(M.gable_roof(x0 + 3, x0 + 9, -2.0, -0.8, top + 4.0, 0.8, (0.92, 0.91, 0.88), over=0.05, along="z"))
    for i, x in enumerate((-12, -10, 12)):
        p.append(K.tree(x, -6 + i, 3.2, "round", seed=i))
    return merge(p), x0, top


@functools.lru_cache(maxsize=2)
def bridge_set():
    """A fjord with 'Ankomst' (left bank) and 'Arbeid' (right bank)."""
    p = [M.ground(-6, -14, 6, 14, -0.5, K.WATER, 6, 10, flags=WET, jitter=0.02, seed=3)]
    for s in (-1, 1):
        x0, x1 = (-22, -6) if s < 0 else (6, 22)
        p.append(box(x0, -1.2, -14, x1, 0.0, 14, (0.45, 0.48, 0.42), flags=GRAIN))
        p.append(M.ground(x0, -14, x1, 14, 0.0, K.GRASS, 6, 6, flags=GRAIN))
        # rock edge
        for z in np.arange(-14, 14, 1.5):
            p.append(box(s * 6 - 0.4 + (0.6 if s < 0 else -0.2), -0.8, z, s * 6 + (0.2 if s < 0 else 0.4), 0.1, z + 1.4,
                         (0.50, 0.50, 0.48), flags=GRAIN))
    # left: small station
    p.append(K.house(-11, -1.5, 5.0, 3.0, 1, (0.72, 0.44, 0.35), K.SLATE, 1, {(0, 0): K.WARM_LIGHT * 0.5}, wins=3, seed=8))
    for r in (-0.3, 0.3):
        p.append(box(-22, 0.0, -5.5 + r - 0.05, -7, 0.1, -5.5 + r + 0.05, (0.45, 0.45, 0.47)))
    # right: workplace
    p.append(K.flat_building(12.5, -1.5, 7.0, 3.6, 3.0, (0.70, 0.72, 0.74), 1, 2, 5))
    # piers
    for x in np.linspace(-4.0, 4.0, 4):
        p.append(box(x - 0.2, -0.6, 1.3, x + 0.2, 0.4, 1.9, (0.55, 0.55, 0.55), flags=GRAIN))
    # abutments and paths
    p.append(box(-7.5, 0.0, 1.0, -6.0, 0.4, 2.2, (0.6, 0.6, 0.58)))
    p.append(box(6.0, 0.0, 1.0, 7.5, 0.4, 2.2, (0.6, 0.6, 0.58)))
    p.append(box(-11, 0.0, 1.3, -7.5, 0.03, 1.9, (0.62, 0.6, 0.56)))
    p.append(box(7.5, 0.0, 1.3, 12, 0.03, 1.9, (0.62, 0.6, 0.56)))
    for i, (x, z) in enumerate(((-16, -6), (-18, 3), (-9, 7), (16, 6), (18, -7), (9, 8))):
        p.append(K.tree(x, z, 2.6, "spruce" if i % 2 else "round", seed=40 + i))
    return merge(p)


def bridge_planks(k_float):
    """Planks 0..5 (fractional = the plank still being laid)."""
    out = []
    n = 5
    span = 12.0
    for k in range(n):
        u = np.clip(k_float - k, 0, 1)
        if u <= 0:
            continue
        x0 = -6.0 + k * span / n
        drop = (1 - u) ** 2 * 2.5
        m = box(x0 + 0.03, 0.4, 1.2, x0 + span / n - 0.03, 0.55, 2.0, K.BLUE_S, emit=K.blue_emit(0.25), flags=GRAIN)
        out.append(m.move(0, drop, 0))
    return out


@functools.lru_cache(maxsize=2)
def city_set():
    """A larger town's street at night: taller blocks, nameless shopfronts, wet asphalt."""
    p = [M.ground(-30, -2, 30, 4, 0.0, K.ASPHALT, 30, 4, flags=WET | GRAIN),
         box(-30, 0, -3.5, 30, 0.1, -2, K.CURB, flags=GRAIN),
         box(-30, 0, 4, 30, 0.1, 5.5, K.CURB, flags=GRAIN),
         M.ground(-30, -14, 30, -3.5, 0.0, (0.3, 0.3, 0.3), 6, 3)]
    rng = np.random.default_rng(12)
    x = -28.0
    cols = [(0.62, 0.58, 0.52), (0.52, 0.55, 0.58), (0.70, 0.66, 0.58), (0.45, 0.47, 0.50), (0.66, 0.62, 0.60)]
    i = 0
    while x < 28:
        w = rng.uniform(3.0, 5.0)
        h = rng.uniform(4.5, 8.5)
        c = cols[i % len(cols)]
        lit = {(r, cc): K.WARM_LIGHT * rng.uniform(0.3, 0.8) for r in range(4) for cc in range(4) if rng.random() < 0.18}
        p.append(K.flat_building(x + w / 2, -6.5, w - 0.2, 6.0, h, c, 1, 4, 3, lit, win_w=0.55, win_h=0.7))
        # shopfront
        on = rng.random() < 0.55
        p.append(box(x + 0.4, 0.1, -3.48, x + w - 0.6, 1.4, -3.45, (0.55, 0.5, 0.42) if on else K.GLASS,
                     emit=K.WARM_LIGHT * 0.22 if on else (0, 0, 0), flags=UNLIT if on else 0))
        p.append(box(x + 0.2, 1.5, -3.6, x + w - 0.4, 1.75, -3.0, (0.25, 0.26, 0.28)))
        x += w
        i += 1
    for x in (-12, 0, 12):
        p.append(K.street_lamp(x, 4.6, side=-1))
    return merge(p)


def city_lights():
    return [K.lamp_light(x, 4.6, side=-1, power=5.0) for x in (-12, 0, 12)]


def bus(x):
    p = [box(x, 0.35, 0.4, x + 6, 2.2, 2.2, (0.55, 0.60, 0.62), flags=GRAIN),
         box(x + 0.3, 1.2, 2.21, x + 5.7, 1.9, 2.23, (0.35, 0.33, 0.3), emit=K.WARM_LIGHT * 0.18, flags=UNLIT)]
    for wx in (x + 1, x + 5):
        p.append(cylinder(wx, 0.0, 0.4, 0.35, 0.35, 0.2, (0.1, 0.1, 0.1), n=10).rotx(math.pi / 2, about=(wx, 0.35, 0.4)).move(0, 0.35, 0))
        p.append(cylinder(wx, 0.0, 2.2, 0.35, 0.35, 0.2, (0.1, 0.1, 0.1), n=10).rotx(math.pi / 2, about=(wx, 0.35, 2.2)).move(0, 0.35, -0.2))
    return merge(p)


def phone_screens(t, n=9, seed=4):
    """Glowing phone screens floating over the rooftops."""
    rng = np.random.default_rng(seed)
    out, pos = [], []
    for k in range(n):
        x = rng.uniform(-14, 14)
        y = rng.uniform(9.5, 12.5) + 0.15 * math.sin(t * 0.8 + k)
        z = rng.uniform(-9, -4)
        m = box(-0.25, -0.45, -0.02, 0.25, 0.45, 0.02, (0.9, 0.93, 1.0), emit=(1.5, 1.7, 2.0), flags=UNLIT | NOSHADOW)
        m.roty(rng.uniform(-0.4, 0.4)).move(x, y, z)
        out.append(m)
        pos.append((x, y, z))
    return out, pos


@functools.lru_cache(maxsize=2)
def crossroads_set():
    """One junction: one road to a lit football pitch, the other into a dark back yard."""
    p = [M.ground(-16, -16, 16, 10, 0.0, K.GRASS, 8, 8, flags=GRAIN),
         box(-1.2, 0, -16, 1.2, 0.02, 4, (0.55, 0.54, 0.52), flags=GRAIN),
         K.diorama_base(-16, -16, 16, 10)]
    # left branch to the pitch
    p.append(box(-12, 0, -2.0, -1.2, 0.02, 0.0, (0.58, 0.57, 0.55), flags=GRAIN))
    # right branch into a back yard between dark buildings
    p.append(box(1.2, 0, -2.0, 12, 0.02, 0.0, (0.38, 0.38, 0.38), flags=GRAIN))
    p.append(K.flat_building(7.5, -5.0, 6.0, 4.0, 4.5, (0.40, 0.40, 0.42), 1, 2, 3))
    p.append(K.flat_building(7.5, 3.5, 6.0, 3.0, 3.8, (0.42, 0.42, 0.44), -1, 2, 3))
    for x in (9, 9.7):
        p.append(box(x, 0, -2.6, x + 0.6, 0.8, -2.1, (0.25, 0.27, 0.25)))
    # football pitch
    fx, fz = -9.0, -1.0
    p.append(box(fx - 4.5, 0.0, fz - 3.0, fx + 3.0, 0.03, fz + 3.0, (0.38, 0.52, 0.36), flags=GRAIN))
    c = (0.92, 0.92, 0.9)
    for (a, b, cc, d) in ((fx - 4.2, fx + 2.7, fz - 2.75, fz - 2.68), (fx - 4.2, fx + 2.7, fz + 2.68, fz + 2.75),
                          (fx - 0.78, fx - 0.72, fz - 2.75, fz + 2.75)):
        p.append(box(a, 0.03, cc, b, 0.04, d, c, flags=NOSHADOW))
    for sx in (-1, 1):
        px_ = fx - 0.75 + sx * 4.6
        p.append(cylinder(px_, 0, fz - 3.4, 0.07, 0.05, 4.0, (0.3, 0.3, 0.32), n=6))
        p.append(box(px_ - 0.3, 3.9, fz - 3.5, px_ + 0.3, 4.2, fz - 3.3, c, emit=(5, 5, 4.6), flags=UNLIT))
    for i, (x, z) in enumerate(((-6, -9), (-12, -8), (-4, 6), (-13, 6))):
        p.append(K.tree(x, z, 2.6, "round" if i % 2 else "spruce", seed=60 + i))
    return merge(p)


def crossroads_lights():
    fx, fz = -9.0, -1.0
    return [Light((fx - 0.75 + sx * 4.4, 3.8, fz - 3.0), (1, 1, 0.95), 4.0, 4.5, direction=(-sx * 0.5, -1, 0.6), cone=(40, 75))
            for sx in (-1, 1)] + [Light((0.0, 3.0, 1.0), (1.0, 0.8, 0.55), 1.5, 2.0)]


def village(x, z, n=3, seed=0, lit=False):
    rng = np.random.default_rng(seed)
    out = []
    for k in range(n):
        out.append(K.house(x + rng.uniform(-2.5, 2.5), z + rng.uniform(-2, 2), 2.4, 2.4, 1,
                           [K.OFFWHITE, K.OCHRE, K.SAND][k % 3], K.SLATE, 1, {}, seed=seed + k, wins=2))
    return merge(out)
