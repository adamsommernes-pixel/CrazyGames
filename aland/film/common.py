# -*- coding: utf-8 -*-
"""Gemensamma verktyg: easing, komposition, text, linjer, grain, grade."""
import functools
import math
import os

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
FPS = 25
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
BUILD = os.path.join(ROOT, "build")
FONTS = os.path.join(ASSETS, "fonts")

# Palett (sRGB 0..1)
def hexc(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], np.float32)

INK = hexc("#e9e2d0")        # varm benvit
INK_DIM = hexc("#9aa3a3")
AMBER = hexc("#d9a44a")
RED = hexc("#b8372d")
SEA = hexc("#070e12")
SEA2 = hexc("#0c171d")
LAND = hexc("#2c3633")
LAND2 = hexc("#34403c")
COAST = hexc("#7d8b89")
BLUE_FI = hexc("#3d5f7a")
SW_BLUE = hexc("#2f5d8a")


# --------------------------------------------------------------------------
# Easing / tid
# --------------------------------------------------------------------------
def clamp01(x):
    return max(0.0, min(1.0, x))


def lin(t, a, b):
    """0..1 när t går från a till b."""
    if b <= a:
        return 1.0 if t >= b else 0.0
    return clamp01((t - a) / (b - a))


def smooth(x):
    x = clamp01(x)
    return x * x * (3 - 2 * x)


def smoother(x):
    x = clamp01(x)
    return x * x * x * (x * (x * 6 - 15) + 10)


def ease_out(x, p=3):
    x = clamp01(x)
    return 1 - (1 - x) ** p


def ease_in(x, p=3):
    x = clamp01(x)
    return x ** p


def ease_io(x, p=3):
    x = clamp01(x)
    if x < 0.5:
        return 0.5 * (2 * x) ** p
    return 1 - 0.5 * (2 * (1 - x)) ** p


def fade(t, a, b, c, d):
    """Trapets: 0 före a, upp till 1 vid b, 1 till c, ner till 0 vid d."""
    return smooth(lin(t, a, b)) * (1 - smooth(lin(t, c, d)))


def mix(a, b, x):
    return a + (b - a) * x


# --------------------------------------------------------------------------
# Bildoperationer
# --------------------------------------------------------------------------
def blank(color=(0, 0, 0)):
    img = np.empty((H, W, 3), np.float32)
    img[:] = np.asarray(color, np.float32)
    return img


def over(dst, rgb, alpha, x=0, y=0):
    """Lägg rgb (h,w,3) med alpha (h,w) på dst vid (x,y). Klipper mot kanter."""
    h, w = alpha.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(dst.shape[1], x + w), min(dst.shape[0], y + h)
    if x1 <= x0 or y1 <= y0:
        return dst
    a = alpha[y0 - y:y1 - y, x0 - x:x1 - x, None]
    if rgb.ndim == 1:
        src = rgb[None, None, :]
    else:
        src = rgb[y0 - y:y1 - y, x0 - x:x1 - x]
    d = dst[y0:y1, x0:x1]
    d += (src - d) * a
    return dst


def over_color(dst, color, alpha, x=0, y=0):
    return over(dst, np.asarray(color, np.float32), alpha, x, y)


def add_glow(dst, layer, radius, strength):
    """layer: (H,W,3) additiv glöd."""
    k = int(radius * 3) | 1
    g = cv2.GaussianBlur(layer, (k, k), radius)
    dst += g * strength
    return dst


def screen(dst, layer):
    return 1 - (1 - dst) * (1 - layer)


@functools.lru_cache(maxsize=None)
def vignette_mask(strength=0.55, power=2.2):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    nx = (xx - W / 2) / (W / 2)
    ny = (yy - H / 2) / (H / 2)
    r = np.sqrt(nx * nx * 0.85 + ny * ny)
    m = 1 - strength * np.clip(r / 1.25, 0, 1) ** power
    return m[:, :, None].astype(np.float32)


@functools.lru_cache(maxsize=None)
def grain_bank(n=12, seed=3):
    rng = np.random.default_rng(seed)
    bank = []
    for _ in range(n):
        g = rng.standard_normal((H, W)).astype(np.float32)
        g = cv2.GaussianBlur(g, (0, 0), 0.7)
        g /= g.std()
        bank.append(g)
    return bank


def value_noise(h, w, scale, seed=0, octaves=4):
    """Mjukt fraktalbrus 0..1 (för texturer)."""
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    s = scale
    for _ in range(octaves):
        gh, gw = max(2, int(h / s) + 2), max(2, int(w / s) + 2)
        g = rng.random((gh, gw)).astype(np.float32)
        up = cv2.resize(g, (int(gw * s), int(gh * s)), interpolation=cv2.INTER_CUBIC)[:h, :w]
        out += up * amp
        tot += amp
        amp *= 0.5
        s /= 2
    return out / tot


@functools.lru_cache(maxsize=None)
def paper_texture(seed=1):
    """Diskret fibrig struktur för mörka 'papper'-bakgrunder, ~0..1 kring 0.5."""
    n = value_noise(H, W, 220, seed, 5)
    fine = np.random.default_rng(seed).standard_normal((H, W)).astype(np.float32)
    fine = cv2.GaussianBlur(fine, (0, 0), 0.8) * 0.04
    fib = cv2.GaussianBlur(np.random.default_rng(seed + 1).standard_normal((H, W)).astype(np.float32),
                           (0, 0), sigmaX=9, sigmaY=0.9) * 0.25
    return (n - 0.5) * 0.9 + fine + fib * 0.35


# --------------------------------------------------------------------------
# Färgbehandling (slutlig look)
# --------------------------------------------------------------------------
def grade(img, frame_idx, grain=0.035, vign=0.5, lift=(0.012, 0.018, 0.022)):
    x = np.clip(img, 0, None)
    # mjuk högdagerkompression
    x = x / (1 + 0.18 * x)
    x = x * 1.12
    # lätt S-kurva
    x = np.clip(x, 0, 1)
    x = x + 0.12 * x * (1 - x) * (x - 0.35) * 2.2
    # split-toning: kalla skuggor, varma högdagrar
    luma = (x[..., 0] * 0.2126 + x[..., 1] * 0.7152 + x[..., 2] * 0.0722)[..., None]
    sh = (1 - luma) ** 2
    hi = luma ** 2
    x = x + sh * np.array([-0.012, 0.004, 0.018], np.float32) + hi * np.array([0.02, 0.008, -0.018], np.float32)
    x = x * (1 - np.asarray(lift, np.float32)) + np.asarray(lift, np.float32)
    x = x * vignette_mask(vign)
    if grain > 0:
        g = grain_bank()[frame_idx % len(grain_bank())]
        # förskjut bruset så det aldrig "står still"
        dx = (frame_idx * 37) % 64
        dy = (frame_idx * 53) % 64
        g = np.roll(g, (dy, dx), axis=(0, 1))
        amt = grain * (0.22 + 1.3 * luma * (1 - luma) * 2.5)
        x = x + g[..., None] * amt
    return np.clip(x, 0, 1)


def to_u8(img):
    return (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)


# --------------------------------------------------------------------------
# Typsnitt och text
# --------------------------------------------------------------------------
FONT_FILES = {
    "serif": os.path.join(FONTS, "CormorantGaramond-VF.ttf"),
    "serif_it": os.path.join(FONTS, "CormorantGaramond-Italic-VF.ttf"),
    "serif_sc": os.path.join(FONTS, "CormorantSC-Medium.ttf"),
    "sans": os.path.join(FONTS, "Barlow-Regular.ttf"),
    "sans_l": os.path.join(FONTS, "Barlow-Light.ttf"),
    "sans_m": os.path.join(FONTS, "Barlow-Medium.ttf"),
    "sans_sb": os.path.join(FONTS, "Barlow-SemiBold.ttf"),
    "cond": os.path.join(FONTS, "BarlowCondensed-Medium.ttf"),
    "mono": os.path.join(FONTS, "IBMPlexMono-Light.ttf"),
    "mono_r": os.path.join(FONTS, "IBMPlexMono-Regular.ttf"),
    "garamond": "/usr/share/fonts/opentype/ebgaramond/EBGaramond12-Regular.otf",
    "garamond_it": "/usr/share/fonts/opentype/ebgaramond/EBGaramond12-Italic.otf",
}


@functools.lru_cache(maxsize=None)
def font(name, size, weight=None):
    f = ImageFont.truetype(FONT_FILES[name], size)
    if weight is not None:
        try:
            f.set_variation_by_axes([weight])
        except Exception:
            pass
    return f


@functools.lru_cache(maxsize=512)
def text_mask(text, name, size, tracking=0.0, weight=None):
    """Returnerar (alpha float32 h×w, baseline_y, bredd) för en rad text.
    tracking i em-andelar (0.1 = 10 % av storleken extra mellan tecken)."""
    f = font(name, size, weight)
    asc, desc = f.getmetrics()
    pad = int(size * 0.3)
    track = tracking * size
    widths = [f.getlength(c) for c in text]
    total = sum(widths) + track * max(0, len(text) - 1)
    wimg = int(math.ceil(total)) + 2 * pad
    himg = asc + desc + 2 * pad
    # rita i 2x för bättre kantutjämning, skala ner
    S = 2
    f2 = font(name, size * S, weight)
    im = Image.new("L", (wimg * S, himg * S), 0)
    d = ImageDraw.Draw(im)
    x = pad * S
    for c, w in zip(text, widths):
        d.text((x, pad * S), c, font=f2, fill=255)
        x += (w + track) * S
    im = im.resize((wimg, himg), Image.LANCZOS)
    a = np.asarray(im, np.float32) / 255.0
    return a, pad + asc, total, pad


def draw_text(dst, text, x, y, name="sans", size=32, color=INK, alpha=1.0,
              tracking=0.0, anchor="l", weight=None, blur=0.0, dy=0.0, shadow=0.0):
    """Rita text med baslinjen vid y. anchor: l/c/r."""
    if alpha <= 0.001 or not text:
        return dst
    a, base, tw, pad = text_mask(text, name, size, round(tracking, 4), weight)
    if anchor == "c":
        x0 = x - tw / 2 - pad
    elif anchor == "r":
        x0 = x - tw - pad
    else:
        x0 = x - pad
    y0 = y - base + dy
    ix, iy = int(math.floor(x0)), int(math.floor(y0))
    fx, fy = x0 - ix, y0 - iy
    if abs(fx) > 1e-3 or abs(fy) > 1e-3:
        M = np.float32([[1, 0, fx], [0, 1, fy]])
        a = cv2.warpAffine(a, M, (a.shape[1] + 1, a.shape[0] + 1), flags=cv2.INTER_LINEAR)
    if blur > 0.05:
        a = cv2.GaussianBlur(a, (0, 0), blur)
    if shadow > 0:
        sa = cv2.GaussianBlur(a, (0, 0), size * 0.12) * shadow * alpha
        over_color(dst, (0, 0, 0), sa, ix, iy + 2)
    over_color(dst, color, a * alpha, ix, iy)
    return dst


def text_width(text, name, size, tracking=0.0, weight=None):
    return text_mask(text, name, size, round(tracking, 4), weight)[2]


def reveal_text(dst, text, x, y, t, dur=1.2, stagger=0.045, rise=10, **kw):
    """Tecken för tecken-intoning med lätt uppglidning."""
    name = kw.get("name", "sans")
    size = kw.get("size", 32)
    tracking = kw.get("tracking", 0.0)
    weight = kw.get("weight")
    anchor = kw.pop("anchor", "l")
    alpha = kw.pop("alpha", 1.0)
    f = font(name, size, weight)
    track = tracking * size
    widths = [f.getlength(c) for c in text]
    total = sum(widths) + track * max(0, len(text) - 1)
    if anchor == "c":
        cx = x - total / 2
    elif anchor == "r":
        cx = x - total
    else:
        cx = x
    n = max(1, len(text))
    for i, (c, w) in enumerate(zip(text, widths)):
        p = clamp01((t - i * stagger) / dur)
        e = ease_out(p, 3)
        if e > 0 and c != " ":
            draw_text(dst, c, cx, y, anchor="l", alpha=alpha * e, dy=rise * (1 - e),
                      blur=1.5 * (1 - e), **kw)
        cx += w + track
    return dst


# --------------------------------------------------------------------------
# Linjer
# --------------------------------------------------------------------------
SHIFT = 4
SCALE = 1 << SHIFT


def poly_lines(mask, pts_list, thickness=1.0, closed=False, value=1.0):
    """Kantutjämnade polylinjer på en float-mask (h,w)."""
    arrs = [np.round(np.asarray(p, np.float64) * SCALE).astype(np.int32) for p in pts_list if len(p) >= 2]
    if not arrs:
        return mask
    th = max(1, int(round(thickness)))
    cv2.polylines(mask, arrs, closed, value, th, cv2.LINE_AA, SHIFT)
    return mask


def fill_polys(mask, pts_list, value=1.0):
    arrs = [np.round(np.asarray(p, np.float64) * SCALE).astype(np.int32) for p in pts_list if len(p) >= 3]
    if arrs:
        cv2.fillPoly(mask, arrs, value, cv2.LINE_AA, SHIFT)
    return mask


def thin_line_mask(pts_list, thickness=1.0, closed=False, shape=(H, W)):
    """För linjer tunnare än 1 px: rita 1 px och skala alfa."""
    m = np.zeros(shape, np.float32)
    poly_lines(m, pts_list, 1, closed)
    if thickness < 1:
        m *= thickness
    elif thickness > 1.01:
        m = np.zeros(shape, np.float32)
        poly_lines(m, pts_list, thickness, closed)
    return m


def polyline_length(pts):
    p = np.asarray(pts, np.float64)
    if len(p) < 2:
        return 0.0
    return float(np.sqrt(((p[1:] - p[:-1]) ** 2).sum(1)).sum())


def partial_polyline(pts, frac):
    """Första frac (0..1) av en polylinje efter längd."""
    p = np.asarray(pts, np.float64)
    if frac >= 1:
        return p
    if frac <= 0 or len(p) < 2:
        return p[:1]
    seg = np.sqrt(((p[1:] - p[:-1]) ** 2).sum(1))
    cum = np.concatenate([[0], np.cumsum(seg)])
    L = cum[-1] * frac
    i = int(np.searchsorted(cum, L) - 1)
    i = max(0, min(i, len(seg) - 1))
    u = (L - cum[i]) / max(seg[i], 1e-9)
    q = p[i] + (p[i + 1] - p[i]) * u
    return np.vstack([p[:i + 1], q[None]])


def point_at(pts, frac):
    p = partial_polyline(pts, frac)
    return p[-1]


def dashed(pts, dash=10, gap=7, offset=0.0):
    """Dela upp polylinje i streck."""
    p = np.asarray(pts, np.float64)
    seg = np.sqrt(((p[1:] - p[:-1]) ** 2).sum(1))
    cum = np.concatenate([[0], np.cumsum(seg)])
    L = cum[-1]
    out = []
    s = -offset % (dash + gap) - (dash + gap)
    while s < L:
        a, b = max(0, s), min(L, s + dash)
        if b > a:
            ts = np.linspace(a, b, max(2, int((b - a) / 4) + 2))
            xs = np.interp(ts, cum, p[:, 0])
            ys = np.interp(ts, cum, p[:, 1])
            out.append(np.stack([xs, ys], 1))
        s += dash + gap
    return out


def wobble(pts, amp=0.8, freq=0.05, seed=0):
    """Handritad darrning längs en linje."""
    p = np.asarray(pts, np.float64)
    if len(p) < 2:
        return p
    # förtäta
    L = polyline_length(p)
    n = max(2, int(L / 3))
    seg = np.sqrt(((p[1:] - p[:-1]) ** 2).sum(1))
    cum = np.concatenate([[0], np.cumsum(seg)])
    ts = np.linspace(0, cum[-1], n)
    xs = np.interp(ts, cum, p[:, 0])
    ys = np.interp(ts, cum, p[:, 1])
    rng = np.random.default_rng(seed)
    ph = rng.random(4) * 6.28
    dx = amp * (np.sin(ts * freq + ph[0]) * 0.6 + np.sin(ts * freq * 2.7 + ph[1]) * 0.4)
    dy = amp * (np.sin(ts * freq * 1.3 + ph[2]) * 0.6 + np.sin(ts * freq * 3.1 + ph[3]) * 0.4)
    return np.stack([xs + dx, ys + dy], 1)


def catmull(pts, n=12):
    """Mjuk kurva genom punkter."""
    p = np.asarray(pts, np.float64)
    if len(p) < 3:
        return p
    P = np.vstack([p[0] * 2 - p[1], p, p[-1] * 2 - p[-2]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(p[-1])
    return np.array(out)


def arc_between(a, b, bend=0.2, n=64):
    """Båge mellan två punkter (för rutter/förbindelser)."""
    a, b = np.asarray(a, float), np.asarray(b, float)
    m = (a + b) / 2
    d = b - a
    nrm = np.array([-d[1], d[0]])
    c = m + nrm * bend
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 2 * a + 2 * (1 - t) * t * c + t ** 2 * b


def dot(dst, x, y, r, color, alpha=1.0, glow=0.0):
    s = int(r * 4 + 6)
    yy, xx = np.mgrid[-s:s + 1, -s:s + 1].astype(np.float32)
    fx, fy = x - math.floor(x), y - math.floor(y)
    d = np.sqrt((xx - fx) ** 2 + (yy - fy) ** 2)
    a = np.clip(r + 0.5 - d, 0, 1) * alpha
    if glow > 0:
        g = np.exp(-(d / (r * 3 + 2)) ** 2) * glow * alpha
        a = np.maximum(a, g)
    over_color(dst, color, a, int(math.floor(x)) - s, int(math.floor(y)) - s)
    return dst


def ring(dst, x, y, r, color, alpha=1.0, width=1.2):
    s = int(r + 6)
    yy, xx = np.mgrid[-s:s + 1, -s:s + 1].astype(np.float32)
    fx, fy = x - math.floor(x), y - math.floor(y)
    d = np.sqrt((xx - fx) ** 2 + (yy - fy) ** 2)
    a = np.clip(width / 2 + 0.5 - np.abs(d - r), 0, 1) * alpha
    over_color(dst, color, a, int(math.floor(x)) - s, int(math.floor(y)) - s)
    return dst
