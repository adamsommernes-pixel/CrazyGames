# -*- coding: utf-8 -*-
"""Effekter: flagga, jordglob, hällristningar, is, eld, rök, snö, partiklar."""
import functools
import math
import os

import cv2
import numpy as np

from .common import (ASSETS, H, W, clamp01, dot, ease_out, fill_polys,
                     over_color, paper_texture, poly_lines, smooth,
                     value_noise)


# --------------------------------------------------------------------------
# Rök/dimma (bakgrunder)
# --------------------------------------------------------------------------
@functools.lru_cache(maxsize=None)
def _smoke_tex(seed):
    n = value_noise(H + 400, W + 800, 260, seed, 6)
    lo, hi = np.percentile(n, 1), np.percentile(n, 99)
    return np.clip((n - lo) / (hi - lo), 0, 1).astype(np.float32)


def smoke(t, speed=(18, -6), seed=1, density=1.0):
    tex = _smoke_tex(seed)
    ox = int(200 + (t * speed[0]) % 400)
    oy = int(200 + (t * speed[1]) % 200)
    a = tex[oy:oy + H, ox:ox + W]
    tex2 = _smoke_tex(seed + 7)
    ox2 = int(200 + (t * speed[0] * -0.6) % 400)
    b = tex2[200:200 + H, ox2:ox2 + W]
    return np.clip((a * 0.6 + b * 0.4 - 0.35) * 1.6, 0, 1) * density


# --------------------------------------------------------------------------
# Snö / partiklar
# --------------------------------------------------------------------------
class Snow:
    def __init__(self, n=900, seed=1, wind=(-220, 160)):
        rng = np.random.default_rng(seed)
        self.x = rng.uniform(-300, W + 300, n)
        self.y = rng.uniform(-100, H, n)
        self.z = rng.uniform(0.2, 1.0, n)
        self.ph = rng.uniform(0, 6.28, n)
        self.wind = np.array(wind, float)

    def draw(self, img, t, alpha=1.0, color=(0.75, 0.78, 0.8)):
        m = np.zeros((H, W), np.float32)
        vx = self.wind[0] * self.z
        vy = self.wind[1] * self.z + 60 * self.z
        x = (self.x + vx * t + 12 * np.sin(t * 1.3 + self.ph)) % (W + 600) - 300
        y = (self.y + vy * t) % (H + 100) - 50
        L = 0.03
        for lo, hi, th in ((0.0, 0.5, 1), (0.5, 0.8, 1), (0.8, 1.01, 2)):
            sel = (self.z >= lo) & (self.z < hi)
            segs = np.stack([np.stack([x[sel] - vx[sel] * L, y[sel] - vy[sel] * L], 1),
                             np.stack([x[sel], y[sel]], 1)], 1)
            poly_lines(m, list(segs), th, value=float(0.25 + 0.6 * (lo + hi) / 2))
        m = cv2.GaussianBlur(m, (0, 0), 0.8)
        over_color(img, np.asarray(color, np.float32), np.clip(m, 0, 1) * alpha)
        return img


# --------------------------------------------------------------------------
# Is (inlandsis över kartan)
# --------------------------------------------------------------------------
@functools.lru_cache(maxsize=None)
def ice_layers(seed=4):
    """Inlandsis sedd ovanifrån: vit-blå yta, snödrev, glesa sprickzoner."""
    rng = np.random.default_rng(seed)
    n = value_noise(H, W, 420, seed, 6)
    drift = cv2.GaussianBlur(rng.standard_normal((H, W)).astype(np.float32), (0, 0), sigmaX=22, sigmaY=3)
    drift /= drift.std() + 1e-6
    col = np.empty((H, W, 3), np.float32)
    white = np.array([0.80, 0.85, 0.90], np.float32)
    blue = np.array([0.50, 0.63, 0.74], np.float32)
    k = np.clip(0.35 + 1.6 * (n - 0.5) + 0.08 * drift, 0, 1)
    col[:] = white * (1 - k[..., None]) + blue * k[..., None]
    # sprickor: tunna mörkblå linjer i några zoner
    cr = np.zeros((H, W), np.float32)
    for _ in range(9):
        cx, cy = rng.uniform(0, W), rng.uniform(0, H)
        ang = rng.uniform(0, math.pi)
        for j in range(rng.integers(4, 9)):
            off = (j - 4) * rng.uniform(10, 18)
            x0 = cx + math.cos(ang + math.pi / 2) * off
            y0 = cy + math.sin(ang + math.pi / 2) * off
            L_ = rng.uniform(60, 220)
            pts = []
            for u in np.linspace(-0.5, 0.5, 14):
                pts.append((x0 + math.cos(ang) * L_ * u + rng.normal(0, 1.5), y0 + math.sin(ang) * L_ * u + rng.normal(0, 1.5)))
            poly_lines(cr, [np.array(pts)], 1, value=rng.uniform(0.4, 0.9))
    cr = cv2.GaussianBlur(cr, (0, 0), 0.7)
    col -= cr[..., None] * np.array([0.30, 0.22, 0.14], np.float32)
    # ljusare åsar
    col += np.clip(drift, 0, None)[..., None] * 0.015
    # smältordning: syd/sydost först
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    grad = (yy / H) * 0.6 + (xx / W) * 0.25
    melt = grad * 0.55 + value_noise(H, W, 220, seed + 3, 5) * 0.45
    melt = (melt - melt.min()) / (melt.max() - melt.min())
    return col, 1 - melt


def ice_over(img, cover):
    """cover 1 = helt istäckt, 0 = borta."""
    if cover <= 0:
        return img
    col, order = ice_layers()
    thr = (1 - cover) * 1.1 - 0.1
    a = np.clip((order - thr) * 14, 0, 1)
    # smältkant: blått vatten-sken
    edge = np.clip(1 - np.abs(order - thr) * 30, 0, 1) * (cover < 0.999)
    img += (col * 0.84 - img) * a[..., None] * 0.92
    img += edge[..., None] * np.array([0.10, 0.16, 0.2], np.float32)
    return img


# --------------------------------------------------------------------------
# Eld och glöd på karta
# --------------------------------------------------------------------------
def fire_spots(img, spots, t, strength=1.0):
    """spots: lista av (x, y, t_start, size)."""
    glow = np.zeros((H, W), np.float32)
    core = np.zeros((H, W), np.float32)
    for i, (x, y, ts, sz) in enumerate(spots):
        if t < ts:
            continue
        a = ease_out((t - ts) / 0.8)
        fl = 0.75 + 0.25 * math.sin(t * 13 + i * 1.7) * math.sin(t * 7.3 + i)
        r = sz * (0.8 + 0.2 * fl)
        xi, yi = int(x), int(y)
        if -60 < xi < W + 60 and -60 < yi < H + 60:
            cv2.circle(glow, (xi, yi), int(r * 7), a * 0.5 * fl, -1, cv2.LINE_AA)
            cv2.circle(core, (xi, yi), max(1, int(r)), a * fl, -1, cv2.LINE_AA)
    glow = cv2.GaussianBlur(glow, (0, 0), 14)
    core = cv2.GaussianBlur(core, (0, 0), 1.5)
    img += glow[..., None] * np.array([0.9, 0.35, 0.08], np.float32) * strength
    img += core[..., None] * np.array([1.0, 0.75, 0.35], np.float32) * strength
    return img


# --------------------------------------------------------------------------
# Hällristningar på rödgranit (rapakivi)
# --------------------------------------------------------------------------
@functools.lru_cache(maxsize=None)
def granite(seed=5):
    """Isslipad rödgranithäll: låg kontrast, kristallkorn, sprickor, lavfläckar."""
    rng = np.random.default_rng(seed)
    mott = value_noise(H, W, 260, seed, 5)
    col = np.empty((H, W, 3), np.float32)
    col[..., 0] = 0.40 + 0.06 * mott
    col[..., 1] = 0.27 + 0.04 * mott
    col[..., 2] = 0.23 + 0.03 * mott
    # kristallkorn i tre skalor
    for sig, amp in ((0.7, 0.10), (1.6, 0.08), (3.5, 0.05)):
        g = cv2.GaussianBlur(rng.standard_normal((H, W)).astype(np.float32), (0, 0), sig)
        g /= g.std() + 1e-6
        col *= (1 + amp * g)[..., None]
    # rosa fältspat-fläckar
    fs = cv2.GaussianBlur(rng.standard_normal((H, W)).astype(np.float32), (0, 0), 5)
    fs = np.clip((fs / fs.std() - 1.2) * 0.8, 0, 1)
    col += fs[..., None] * np.array([0.10, 0.05, 0.03], np.float32)
    # mörka korn
    dk = cv2.GaussianBlur((rng.random((H, W)) > 0.997).astype(np.float32), (0, 0), 1.0) * 4
    col *= np.clip(1 - dk, 0.4, 1)[..., None]
    # sprickor
    cr = np.zeros((H, W), np.float32)
    for _ in range(7):
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        ang = rng.uniform(0, math.pi)
        pts = []
        for k in range(60):
            ang += rng.normal(0, 0.12)
            x += math.cos(ang) * 14
            y += math.sin(ang) * 14
            pts.append((x, y))
        poly_lines(cr, [np.array(pts)], 1, value=rng.uniform(0.5, 1.0))
    col *= (1 - 0.45 * cv2.GaussianBlur(cr, (0, 0), 0.8))[..., None]
    # lavfläckar
    li = value_noise(H, W, 45, seed + 9, 4)
    li = np.clip((li - 0.66) * 7, 0, 1) * 0.5
    col += li[..., None] * (np.array([0.45, 0.47, 0.40], np.float32) - col)
    # släpljus
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    light = 1.05 - 0.55 * ((xx / W - 0.3) ** 2 + (yy / H - 0.25) ** 2)
    col *= light[..., None] * 0.72
    return col


def petroglyphs():
    """Strokes för båtar, sälar och människor (skärmkoordinater)."""
    strokes = []  # (pts, width, group)

    def boat(cx, cy, s, crew, g):
        hull = []
        for u in np.linspace(-1, 1, 30):
            hull.append((cx + u * 150 * s, cy + 22 * s * (1 - u * u)))
        strokes.append((np.array(hull), 7 * s, g))
        strokes.append((np.array([(cx - 150 * s, cy), (cx - 176 * s, cy - 40 * s), (cx - 166 * s, cy - 58 * s)]), 6 * s, g))
        strokes.append((np.array([(cx + 150 * s, cy), (cx + 170 * s, cy - 44 * s), (cx + 190 * s, cy - 50 * s)]), 6 * s, g))
        strokes.append((np.array([(cx - 150 * s, cy + 4 * s), (cx - 172 * s, cy + 30 * s)]), 5 * s, g))
        for k in range(crew):
            x = cx - 100 * s + k * (200 * s / max(1, crew - 1))
            strokes.append((np.array([(x, cy + 4 * s), (x, cy - 32 * s)]), 5 * s, g))

    def seal(cx, cy, s, g, flip=1):
        # fylld sälkropp (markeras med bredd 0 = fyllning)
        up = []
        dn = []
        for u in np.linspace(0, 1, 30):
            th = 22 * s * math.sin(u * math.pi) ** 0.7 * (1.1 - 0.3 * u) + 3 * s
            x = cx + flip * (u - 0.5) * 190 * s
            yc = cy + 8 * s * math.sin(u * math.pi * 1.3)
            up.append((x, yc - th))
            dn.append((x, yc + th * 0.8))
        body = np.array(up + dn[::-1])
        strokes.append((body, 0, g))
        tx = cx - flip * 95 * s
        strokes.append((np.array([(tx + flip * 6 * s, cy - 2 * s), (tx - flip * 34 * s, cy - 22 * s), (tx - flip * 26 * s, cy + 2 * s),
                                  (tx - flip * 36 * s, cy + 24 * s), (tx + flip * 6 * s, cy + 6 * s)]), 0, g))
        strokes.append((np.array([(cx + flip * 36 * s, cy + 12 * s), (cx + flip * 10 * s, cy + 44 * s), (cx + flip * 26 * s, cy + 46 * s),
                                  (cx + flip * 50 * s, cy + 14 * s)]), 0, g))

    def hunter(cx, cy, s, g):
        strokes.append((np.array([(cx, cy - 70 * s), (cx, cy)]), 6 * s, g))
        a = np.linspace(0, 2 * np.pi, 16)
        strokes.append((np.stack([cx + 11 * s * np.cos(a), cy - 84 * s + 11 * s * np.sin(a)], 1), 5 * s, g))
        strokes.append((np.array([(cx, cy), (cx - 18 * s, cy + 46 * s)]), 5 * s, g))
        strokes.append((np.array([(cx, cy), (cx + 18 * s, cy + 46 * s)]), 5 * s, g))
        strokes.append((np.array([(cx - 30 * s, cy - 40 * s), (cx + 36 * s, cy - 56 * s), (cx + 110 * s, cy - 76 * s)]), 4 * s, g))

    boat(560, 430, 1.7, 7, 0)
    boat(1180, 250, 1.15, 5, 0)
    seal(1320, 610, 1.5, 1, flip=-1)
    seal(1580, 440, 1.1, 1, flip=-1)
    seal(1450, 860, 1.25, 1, flip=1)
    hunter(880, 760, 1.8, 2)
    return strokes


def draw_petroglyphs(img, strokes, prog_by_group, t, rng_seed=2):
    """Rödockra-målning. prog_by_group: dict g->0..1."""
    m = np.zeros((H, W), np.float32)
    from .common import partial_polyline, polyline_length
    lens = {}
    for pts, w_, g in strokes:
        lens[g] = lens.get(g, 0) + polyline_length(pts)
    acc = {}
    for pts, w_, g in strokes:
        L = polyline_length(pts)
        done = lens[g] * prog_by_group.get(g, 0)
        a0 = acc.get(g, 0)
        acc[g] = a0 + L
        frac = clamp01((done - a0) / max(L, 1e-6))
        if frac <= 0:
            continue
        if w_ == 0:
            # fylld form: avslöjas med mjuk svepning längs x
            fm = np.zeros((H, W), np.float32)
            fill_polys(fm, [pts])
            x0, x1 = pts[:, 0].min(), pts[:, 0].max()
            xs = np.arange(W, dtype=np.float32)
            wipe = np.clip((x0 + (x1 - x0) * frac * 1.15 - xs) / 12.0, 0, 1)
            m = np.maximum(m, fm * wipe[None, :])
            continue
        p = partial_polyline(pts, frac)
        if len(p) >= 2:
            poly_lines(m, [p], max(1, int(w_)))
    # ojämn färg och kant: bryt med brus
    tex = paper_texture(9)
    mb = cv2.GaussianBlur(m, (0, 0), 1.6)
    m = np.clip((mb - 0.5 + tex * 1.2) * 3 + 0.5, 0, 1) * (mb > 0.02)
    m = m * np.clip(0.8 + tex * 2.0, 0.45, 1)
    ochre = np.array([0.52, 0.11, 0.06], np.float32)
    img += (ochre - img) * m[..., None] * 0.85
    return img


# --------------------------------------------------------------------------
# Ålands flagga (vajande)
# --------------------------------------------------------------------------
FLAG_BLUE = np.array([0.0, 0.26, 0.58], np.float32)
FLAG_YEL = np.array([0.98, 0.78, 0.05], np.float32)
FLAG_RED = np.array([0.80, 0.07, 0.14], np.float32)


@functools.lru_cache(maxsize=None)
def flag_texture(w=2600, h=1700):
    """Proportioner 17:26, kors 8+5+13 / 6+5+6, rött 3 inuti gult 5."""
    u = w / 26.0
    img = np.empty((h, w, 3), np.float32)
    img[:] = FLAG_BLUE
    img[int(6 * u):int(11 * u), :] = FLAG_YEL
    img[:, int(8 * u):int(13 * u)] = FLAG_YEL
    img[int(7 * u):int(10 * u), :] = FLAG_RED
    img[:, int(9 * u):int(12 * u)] = FLAG_RED
    # väv
    rng = np.random.default_rng(1)
    weave = (np.sin(np.arange(w) * 1.9)[None, :] * np.sin(np.arange(h) * 1.9)[:, None]) * 0.015
    img *= (1 + weave[..., None] + rng.normal(0, 0.012, (h, w, 1)).astype(np.float32))
    return img


def flag_frame(t, bg=None, zoom=1.0, light=(0.4, -0.6)):
    """Närbild på vajande flagga som fyller bilden."""
    tex = flag_texture()
    th, tw = tex.shape[:2]
    # skärm -> flaggkoordinat (0..1)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    fx = (xx / W - 0.5) / zoom * 0.95 + 0.42
    fy = (yy / H - 0.5) / zoom * 0.95 * (H / W) * (26 / 17) + 0.5
    ph = fx * 9.0 - t * 3.1
    amp = 0.02 + 0.05 * fx
    z = amp * (np.sin(ph) + 0.35 * np.sin(fx * 17 - t * 5.3 + fy * 3) + 0.25 * np.sin(fx * 5 + fy * 6 - t * 2.1))
    dzdx = amp * (9.0 * np.cos(ph) + 0.35 * 17 * np.cos(fx * 17 - t * 5.3 + fy * 3) + 0.25 * 5 * np.cos(fx * 5 + fy * 6 - t * 2.1))
    dzdy = amp * (0.35 * 3 * np.cos(fx * 17 - t * 5.3 + fy * 3) + 0.25 * 6 * np.cos(fx * 5 + fy * 6 - t * 2.1))
    # förskjutning (tyget dras ihop i vecken)
    u = (fx + z * 0.25) * tw
    v = (fy + z * 0.6) * th
    col = cv2.remap(tex, u.astype(np.float32), v.astype(np.float32), cv2.INTER_LINEAR,
                    borderMode=cv2.BORDER_REFLECT)
    nx, ny = -dzdx * 1.3, -dzdy * 1.3
    lx, ly = light
    shade = 0.58 + 0.9 * (nx * lx + ny * ly) + 0.1
    spec = np.clip(nx * lx + ny * ly, 0, 1) ** 6 * 0.25
    col = col * np.clip(shade, 0.25, 1.3)[..., None] + spec[..., None]
    return col.astype(np.float32)


# --------------------------------------------------------------------------
# Jordglob (ortografisk)
# --------------------------------------------------------------------------
@functools.lru_cache(maxsize=None)
def earth_tex():
    p = os.path.join(ASSETS, "tex/earth_day_4096.jpg")
    im = cv2.cvtColor(cv2.imread(p), cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    return im


def globe(lon0, lat0, radius, cx=W / 2, cy=H / 2, sun=(-0.5, 0.35, 0.8), tint=0.8):
    """Returnerar (bild, alfa) för jorden sedd från ovanför (lon0, lat0)."""
    tex = earth_tex()
    th, tw = tex.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    x = (xx - cx) / radius
    y = -(yy - cy) / radius
    r2 = x * x + y * y
    inside = r2 <= 1.0
    z = np.sqrt(np.clip(1 - r2, 0, 1))
    la0, lo0 = math.radians(lat0), math.radians(lon0)
    # invers ortografisk
    rho = np.sqrt(r2)
    c = np.arcsin(np.clip(rho, 0, 1))
    sinc, cosc = np.sin(c), np.cos(c)
    lat = np.arcsin(np.clip(cosc * math.sin(la0) + np.where(rho > 0, y * sinc * math.cos(la0) / np.maximum(rho, 1e-9), 0), -1, 1))
    lon = lo0 + np.arctan2(x * sinc, rho * math.cos(la0) * cosc - y * math.sin(la0) * sinc)
    u = ((np.degrees(lon) + 180) % 360) / 360 * tw
    v = (90 - np.degrees(lat)) / 180 * th
    col = cv2.remap(tex, u.astype(np.float32), v.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_WRAP)
    # belysning (ljus i vy-rymd)
    s = np.asarray(sun, float)
    s = s / np.linalg.norm(s)
    lam = np.clip(x * s[0] + y * s[1] + z * s[2], 0, 1)
    col = col * (0.12 + 0.95 * lam[..., None] ** 0.8) * tint
    # desaturera lite, mörk dokumentärton
    luma = col @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    col = luma[..., None] + (col - luma[..., None]) * 0.75
    # atmosfär vid kanten
    rim = np.clip((np.sqrt(r2) - 0.8) / 0.2, 0, 1) ** 2 * inside
    col += rim[..., None] * np.array([0.10, 0.18, 0.3], np.float32)
    a = np.clip((1 - np.sqrt(r2)) * radius, 0, 1).astype(np.float32)
    # yttre glöd
    outer = np.exp(-np.clip(np.sqrt(r2) - 1, 0, None) * 18) * (r2 > 1)
    glow = outer[..., None] * np.array([0.06, 0.12, 0.22], np.float32)
    return col.astype(np.float32), a, glow.astype(np.float32)


def globe_project(lon, lat, lon0, lat0, radius, cx=W / 2, cy=H / 2):
    """lon/lat (grader, arrayer) -> skärm + synlig-flagga."""
    lon = np.radians(np.asarray(lon, float))
    lat = np.radians(np.asarray(lat, float))
    la0, lo0 = math.radians(lat0), math.radians(lon0)
    cosc = math.sin(la0) * np.sin(lat) + math.cos(la0) * np.cos(lat) * np.cos(lon - lo0)
    x = np.cos(lat) * np.sin(lon - lo0)
    y = math.cos(la0) * np.sin(lat) - math.sin(la0) * np.cos(lat) * np.cos(lon - lo0)
    return np.stack([cx + x * radius, cy - y * radius], -1), cosc > 0


def great_circle(p, q, n=100):
    """Interpolera längs storcirkel mellan (lon,lat)-punkter."""
    lo1, la1 = map(math.radians, p)
    lo2, la2 = map(math.radians, q)
    a = np.array([math.cos(la1) * math.cos(lo1), math.cos(la1) * math.sin(lo1), math.sin(la1)])
    b = np.array([math.cos(la2) * math.cos(lo2), math.cos(la2) * math.sin(lo2), math.sin(la2)])
    om = math.acos(np.clip(a @ b, -1, 1))
    ts = np.linspace(0, 1, n)
    if om < 1e-6:
        pts = np.repeat(a[None], n, 0)
    else:
        pts = (np.sin((1 - ts) * om)[:, None] * a + np.sin(ts * om)[:, None] * b) / math.sin(om)
    lat = np.degrees(np.arcsin(pts[:, 2]))
    lon = np.degrees(np.arctan2(pts[:, 1], pts[:, 0]))
    return np.stack([lon, lat], 1)
