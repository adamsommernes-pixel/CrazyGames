# -*- coding: utf-8 -*-
"""Procedurellt hav: perspektiv-plan med vågsumma, himmel, sol, dimma.
Renderas i halv upplösning och skalas upp."""
import functools
import math

import cv2
import numpy as np

from .common import H, W, value_noise

RW, RH = 960, 540


def self_exp(n):
    return 1.0


class Waves:
    def __init__(self, n=18, seed=1, amp=0.35, wl=(3.0, 60.0), wind=0.0, spread=0.7, chop=1.0):
        rng = np.random.default_rng(seed)
        wls = np.exp(rng.uniform(np.log(wl[0]), np.log(wl[1]), n))
        ang = wind + rng.normal(0, spread, n)
        self.k = 2 * np.pi / wls
        self.dir = np.stack([np.cos(ang), np.sin(ang)], 1)
        self.omega = np.sqrt(9.81 * self.k)
        # amplitud ~ våglängd (brant vågor)
        self.amp = amp * (wls / wl[1]) ** self_exp(n) * rng.uniform(0.5, 1.0, n)
        self.phase = rng.uniform(0, 2 * np.pi, n)
        self.chop = chop

    def height_grad(self, x, z, t, footprint=None):
        h = np.zeros_like(x)
        gx = np.zeros_like(x)
        gz = np.zeros_like(x)
        for i in range(len(self.k)):
            kx, kz = self.k[i] * self.dir[i]
            ph = kx * x + kz * z - self.omega[i] * t + self.phase[i]
            a = self.amp[i]
            if footprint is not None:
                a = a * np.exp(-(self.k[i] * footprint * 0.6) ** 2)
            s = np.sin(ph)
            c = np.cos(ph)
            h += a * s
            gx += a * kx * c * self.chop
            gz += a * kz * c * self.chop
        return h, gx, gz

    def height_at(self, x, z, t):
        h, _, _ = self.height_grad(np.array([x], float), np.array([z], float), t)
        return float(h[0])


@functools.lru_cache(maxsize=None)
def _rays(fov_deg, pitch_deg):
    """Strålriktningar för varje pixel i låg upplösning (kamera tittar längs +z)."""
    f = 0.5 * RW / math.tan(math.radians(fov_deg) / 2)
    yy, xx = np.mgrid[0:RH, 0:RW].astype(np.float64)
    dx = (xx - RW / 2 + 0.5) / f
    dy = -(yy - RH / 2 + 0.5) / f
    dz = np.ones_like(dx)
    p = math.radians(pitch_deg)
    # rotera kring x-axeln (pitch nedåt positivt)
    dy2 = dy * math.cos(p) - dz * math.sin(p)
    dz2 = dy * math.sin(p) + dz * math.cos(p)
    n = np.sqrt(dx * dx + dy2 * dy2 + dz2 * dz2)
    return dx / n, dy2 / n, dz2 / n, f


def horizon_y(fov_deg, pitch_deg, full=True):
    f = 0.5 * RW / math.tan(math.radians(fov_deg) / 2)
    y = RH / 2 - f * math.tan(math.radians(pitch_deg))
    return y * (H / RH) if full else y


def project_point(x, y, z, cam_h, fov_deg, pitch_deg, cam_x=0.0):
    """Världspunkt -> skärmkoordinat (full upplösning)."""
    f = 0.5 * RW / math.tan(math.radians(fov_deg) / 2)
    p = math.radians(pitch_deg)
    X = x - cam_x
    Y = y - cam_h
    Z = z
    # invers pitch
    yc = Y * math.cos(p) + Z * math.sin(p)
    zc = -Y * math.sin(p) + Z * math.cos(p)
    u = RW / 2 + f * X / zc
    v = RH / 2 - f * yc / zc
    return u * W / RW, v * H / RH, f * W / RW / zc  # sista: pixlar per meter


class SeaStyle:
    def __init__(self, **kw):
        self.sky_top = np.array([0.02, 0.03, 0.05])
        self.sky_hor = np.array([0.20, 0.22, 0.25])
        self.water = np.array([0.01, 0.02, 0.03])
        self.sun_dir = np.array([0.0, 0.06, 1.0])
        self.sun_col = np.array([1.0, 0.7, 0.4])
        self.sun_size = 0.012
        self.sun_glow = 0.3
        self.spec_pow = 120.0
        self.spec = 1.0
        self.fog = np.array([0.2, 0.22, 0.25])
        self.fog_dist = 900.0
        self.clouds = 0.0
        self.cloud_col = np.array([0.1, 0.1, 0.12])
        self.cloud_light = np.array([0.6, 0.4, 0.3])
        self.foam = 0.0
        self.cloud_thr = 0.45
        self.__dict__.update(kw)
        s = np.asarray(self.sun_dir, float)
        self.sun_dir = s / np.linalg.norm(s)


def sky_color(style, dx, dy, dz, t, cloud_tex=None):
    el = np.clip(dy, -0.2, 1)
    g = np.clip(el / 0.45, 0, 1) ** 0.55
    col = style.sky_hor[None, :] * (1 - g[..., None]) + style.sky_top[None, :] * g[..., None]
    sd = style.sun_dir
    cosang = dx * sd[0] + dy * sd[1] + dz * sd[2]
    ang = np.arccos(np.clip(cosang, -1, 1))
    glow = np.exp(-(ang / 0.35) ** 2) * style.sun_glow + np.exp(-(ang / 0.08) ** 2) * style.sun_glow * 1.5
    disc = np.clip((style.sun_size - ang) / 0.002, 0, 1)
    col = col + style.sun_col[None, :] * (glow[..., None] + disc[..., None] * 3.0)
    return col


def render_sea(t, style, waves, cam_h=3.0, fov=48.0, pitch=4.0, cam_x=0.0, cam_z=0.0,
               cloud_tex=None, cloud_shift=0.0):
    dx, dy, dz, f = _rays(fov, pitch)
    out = np.zeros((RH, RW, 3), np.float64)
    sky = dy > -0.0005
    # himmel
    sc = sky_color(style, dx[sky], dy[sky], dz[sky], t)
    if cloud_tex is not None and style.clouds > 0:
        # moln projicerade på ett högt plan
        yy = np.maximum(dy[sky], 0.012)
        cu = dx[sky] / yy * 0.08 + cloud_shift
        cv = dz[sky] / yy * 0.08
        th, tw = cloud_tex.shape
        ci = np.clip(cu * 70 + tw / 2, 0, tw - 1).astype(np.int32)
        cj = np.clip(cv * 70 * 0.35 + 20, 0, th - 1).astype(np.int32)
        cd = cloud_tex[cj, ci]
        fadeh = np.clip((dy[sky] - 0.004) / 0.05, 0, 1)
        cd = np.clip((cd - style.cloud_thr) * 2.5, 0, 1) * style.clouds * fadeh
        # molnkant belyst mot solen
        sd = style.sun_dir
        cosang = dx[sky] * sd[0] + dy[sky] * sd[1] + dz[sky] * sd[2]
        lit = np.clip(cosang, 0, 1) ** 8
        ccol = style.cloud_col[None, :] + style.cloud_light[None, :] * lit[:, None]
        sc = sc * (1 - cd[:, None]) + ccol * cd[:, None]
    out[sky] = sc
    # vatten
    wm = ~sky
    ddy = dy[wm]
    dist = cam_h / np.maximum(-ddy, 1e-4)
    x = dx[wm] * dist + cam_x
    z = dz[wm] * dist + cam_z
    footprint = dist / f / np.maximum(-ddy, 0.02) * 0.5
    h, gx, gz = waves.height_grad(x, z, t, footprint)
    nx, ny, nz = -gx, np.ones_like(gx), -gz
    nn = np.sqrt(nx * nx + ny * ny + nz * nz)
    nx, ny, nz = nx / nn, ny / nn, nz / nn
    vx, vy, vz = dx[wm], ddy, dz[wm]
    d = vx * nx + vy * ny + vz * nz
    rx, ry, rz = vx - 2 * d * nx, vy - 2 * d * ny, vz - 2 * d * nz
    ry = np.abs(ry)  # undvik att reflektera under horisonten
    cos_i = np.clip(-d, 0, 1)
    fres = 0.02 + 0.98 * (1 - cos_i) ** 5
    refl = sky_color(style, rx, ry, rz, t)
    sd = style.sun_dir
    rs = np.clip(rx * sd[0] + ry * sd[1] + rz * sd[2], 0, 1)
    spec = rs ** style.spec_pow * style.spec
    col = refl * fres[:, None] + style.water[None, :] * (1 - fres[:, None])
    col += style.sun_col[None, :] * spec[:, None] * 4
    # subsurface ljus på vågtoppar
    col += np.clip(h, 0, None)[:, None] * 0.03 * style.sky_hor[None, :]
    if style.foam > 0:
        steep = np.sqrt(gx * gx + gz * gz)
        fm = np.clip((steep - 0.9) * 2, 0, 1) * np.clip(h / (waves.amp.max() + 1e-6) - 0.2, 0, 1) * style.foam
        col = col * (1 - fm[:, None]) + np.array([0.45, 0.48, 0.5])[None, :] * fm[:, None]
    fogk = 1 - np.exp(-dist / style.fog_dist)
    col = col * (1 - fogk[:, None]) + style.fog[None, :] * fogk[:, None]
    out[wm] = col
    img = cv2.resize(out.astype(np.float32), (W, H), interpolation=cv2.INTER_CUBIC)
    return np.clip(img, 0, None)


@functools.lru_cache(maxsize=None)
def cloud_texture(seed=3):
    n = value_noise(1024, 2048, 150, seed, 6)
    lo, hi = np.percentile(n, 2), np.percentile(n, 98)
    n = np.clip((n - lo) / (hi - lo), 0, 1)
    return n.astype(np.float32)


# --------------------------------------------------------------------------
# Silhuetter
# --------------------------------------------------------------------------
def barque_polys(scale=1.0):
    """Fyrmastad bark i profil, koordinater i meter, x åt höger, y uppåt.
    Returnerar lista av polygoner."""
    polys = []
    L = 95.0
    # skrov
    hull = [(-L / 2, 2.0), (-L / 2 + 3, -3.5), (L / 2 - 10, -3.8), (L / 2 - 2, -1.0), (L / 2 + 6, 3.2),
            (L / 2 + 4, 4.2), (-L / 2 - 1.5, 4.0)]
    polys.append(hull)
    # bogspröt
    polys.append([(L / 2 + 4, 3.8), (L / 2 + 22, 9.0), (L / 2 + 22, 9.6), (L / 2 + 4, 4.6)])
    masts = [L / 2 - 20, L / 2 - 40, L / 2 - 60, L / 2 - 80]
    heights = [50, 52, 50, 40]
    for i, (mx, mh) in enumerate(zip(masts, heights)):
        polys.append([(mx - 0.5, 4), (mx + 0.5, 4), (mx + 0.35, 4 + mh), (mx - 0.35, 4 + mh)])
        if i < 3:
            # råsegel, sex per mast, smalnar uppåt
            ys = np.linspace(9, 4 + mh - 4, 6)
            for j in range(5):
                y0, y1 = ys[j], ys[j + 1] - 0.8
                w0 = 17 - j * 2.2
                w1 = 17 - (j + 1) * 2.2
                bulge = 1.2
                polys.append([(mx - w0, y0), (mx + w0, y0), (mx + w1 + bulge, (y0 + y1) / 2),
                              (mx + w1, y1), (mx - w1, y1), (mx - w1 + bulge, (y0 + y1) / 2)])
        else:
            # mesan: gaffelsegel
            polys.append([(mx - 1, 8), (mx - 18, 9), (mx - 16, 30), (mx - 1, 38)])
    # stagsegel för
    polys.append([(L / 2 + 20, 9.3), (masts[0] + 1, 30), (masts[0] + 2, 12)])
    polys.append([(L / 2 + 12, 7), (masts[0] + 1, 44), (masts[0] + 3, 26)])
    return [np.array(p, float) * scale for p in polys]


def barque_rigging(scale=1.0):
    """Tunna linjer: stag och vant."""
    L = 95.0
    masts = [L / 2 - 20, L / 2 - 40, L / 2 - 60, L / 2 - 80]
    heights = [50, 52, 50, 40]
    lines = []
    tops = [(m, 4 + h) for m, h in zip(masts, heights)]
    lines.append([(L / 2 + 22, 9.3), tops[0]])
    for a, b in zip(tops[:-1], tops[1:]):
        lines.append([a, (b[0], b[1] - 6)])
    lines.append([tops[-1], (-L / 2 - 1, 5)])
    for m, h in zip(masts, heights):
        lines.append([(m - 6, 4), (m, 4 + h * 0.8)])
        lines.append([(m + 6, 4), (m, 4 + h * 0.8)])
    return [np.array(l, float) * scale for l in lines]


def rowboat_polys():
    """Liten allmogebåt med fyra roddare (meter)."""
    polys = []
    hull = [(-4.2, 0.9), (-3.4, -0.2), (3.0, -0.25), (4.4, 1.1), (3.6, 0.55), (-3.6, 0.5)]
    polys.append(hull)
    for i, x in enumerate([-2.2, -0.7, 0.8, 2.1]):
        # kroppar (böjda framåt)
        polys.append([(x - 0.25, 0.5), (x + 0.25, 0.5), (x + 0.15, 1.25), (x - 0.05, 1.4), (x - 0.3, 1.2)])
        # huvud
        a = np.linspace(0, 2 * np.pi, 12)
        polys.append(np.stack([x - 0.05 + 0.17 * np.cos(a), 1.58 + 0.17 * np.sin(a)], 1))
    # posten: kista i aktern
    polys.append([(-3.5, 0.5), (-2.8, 0.5), (-2.8, 0.95), (-3.5, 0.95)])
    return [np.array(p, float) for p in polys]


def place_polys(polys, u, v, ppm, roll=0.0, flip=False):
    """Meterpolygoner -> skärm (u,v = vattenlinjens mittpunkt)."""
    c, s = math.cos(roll), math.sin(roll)
    out = []
    for p in polys:
        x = p[:, 0] * (-1 if flip else 1)
        y = p[:, 1]
        xr = x * c - y * s
        yr = x * s + y * c
        out.append(np.stack([u + xr * ppm, v - yr * ppm], 1))
    return out
