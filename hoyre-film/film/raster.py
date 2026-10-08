# -*- coding: utf-8 -*-
"""Small software renderer for the low-poly diorama look.

Flat-shaded triangles, z-buffer, one shadow-casting sun (shadow map with PCF),
point/spot lights, a "wet" specular flag for asphalt, procedural grain on some
materials, and decals (2D images warped onto a quad, masked by object id).
Post: fog, bloom, depth-of-field (tilt-shift), grade, grain.
"""
import math

import cv2
import numpy as np
from numba import njit

# triangle flags
UNLIT = 1      # emission only (backdrops, screens)
WET = 2        # glossy highlights from lights (wet asphalt, water)
GRAIN = 4      # procedural material grain (wood, asphalt, cork, paper)
NOSHADOW = 8   # does not cast shadow
PANELS = 16    # horizontal wooden cladding lines


# --------------------------------------------------------------------------
# Rasterization
# --------------------------------------------------------------------------
@njit(cache=True, fastmath=True, inline="always")
def _draw(zb, ib, t, x0, y0, w0, x1, y1, w1, x2, y2, w2, persp):
    H, W = zb.shape
    area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
    if abs(area) < 1e-10:
        return
    xmin = max(int(math.floor(min(x0, min(x1, x2)))), 0)
    xmax = min(int(math.ceil(max(x0, max(x1, x2)))), W - 1)
    ymin = max(int(math.floor(min(y0, min(y1, y2)))), 0)
    ymax = min(int(math.ceil(max(y0, max(y1, y2)))), H - 1)
    if xmin > xmax or ymin > ymax:
        return
    inv = 1.0 / area
    eps = -1e-6
    for y in range(ymin, ymax + 1):
        fy = y + 0.5
        # barycentrics are linear in x: l = a + b*x
        a0 = ((x2 - x1) * (fy - y1) + (y2 - y1) * x1) * inv
        b0 = -(y2 - y1) * inv
        a1 = ((x0 - x2) * (fy - y2) + (y0 - y2) * x2) * inv
        b1 = -(y0 - y2) * inv
        for x in range(xmin, xmax + 1):
            fx = x + 0.5
            l0 = a0 + b0 * fx
            if l0 < eps:
                continue
            l1 = a1 + b1 * fx
            if l1 < eps:
                continue
            l2 = 1.0 - l0 - l1
            if l2 < eps:
                continue
            w = l0 * w0 + l1 * w1 + l2 * w2
            d = 1.0 / w if persp else w
            if d < zb[y, x]:
                zb[y, x] = d
                ib[y, x] = t


@njit(cache=True, fastmath=True)
def raster(Vv, F, zb, ib, f, cx, cy, near, persp, skip):
    """Vv: (n,3) view-space vertices (x right, y up, z forward). F: (m,3).
    persp: perspective with near clipping; else orthographic (f = px per unit).
    skip: (m,) bool, triangles to leave out (e.g. non-casters in the shadow pass)."""
    px = np.empty(4)
    py = np.empty(4)
    pz = np.empty(4)
    for t in range(F.shape[0]):
        if skip[t]:
            continue
        i0, i1, i2 = F[t, 0], F[t, 1], F[t, 2]
        if not persp:
            _draw(zb, ib, t,
                  cx + f * Vv[i0, 0], cy - f * Vv[i0, 1], Vv[i0, 2],
                  cx + f * Vv[i1, 0], cy - f * Vv[i1, 1], Vv[i1, 2],
                  cx + f * Vv[i2, 0], cy - f * Vv[i2, 1], Vv[i2, 2], False)
            continue
        za, zb_, zc = Vv[i0, 2], Vv[i1, 2], Vv[i2, 2]
        nb = (za < near) + (zb_ < near) + (zc < near)
        if nb == 3:
            continue
        if nb == 0:
            _draw(zb, ib, t,
                  cx + f * Vv[i0, 0] / za, cy - f * Vv[i0, 1] / za, 1.0 / za,
                  cx + f * Vv[i1, 0] / zb_, cy - f * Vv[i1, 1] / zb_, 1.0 / zb_,
                  cx + f * Vv[i2, 0] / zc, cy - f * Vv[i2, 1] / zc, 1.0 / zc, True)
            continue
        # clip against z = near (Sutherland-Hodgman, max 4 vertices out)
        idx = (i0, i1, i2)
        k = 0
        for e in range(3):
            a = idx[e]
            b = idx[(e + 1) % 3]
            ina = Vv[a, 2] >= near
            inb = Vv[b, 2] >= near
            if ina:
                px[k] = Vv[a, 0]
                py[k] = Vv[a, 1]
                pz[k] = Vv[a, 2]
                k += 1
            if ina != inb:
                u = (near - Vv[a, 2]) / (Vv[b, 2] - Vv[a, 2])
                px[k] = Vv[a, 0] + (Vv[b, 0] - Vv[a, 0]) * u
                py[k] = Vv[a, 1] + (Vv[b, 1] - Vv[a, 1]) * u
                pz[k] = near
                k += 1
        for j in range(1, k - 1):
            _draw(zb, ib, t,
                  cx + f * px[0] / pz[0], cy - f * py[0] / pz[0], 1.0 / pz[0],
                  cx + f * px[j] / pz[j], cy - f * py[j] / pz[j], 1.0 / pz[j],
                  cx + f * px[j + 1] / pz[j + 1], cy - f * py[j + 1] / pz[j + 1], 1.0 / pz[j + 1], True)


@njit(cache=True, fastmath=True, inline="always")
def _hash(i, j, k):
    h = (i * 374761393 + j * 668265263 + k * 1274126177) & 0x7FFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0x7FFFFFFF
    return (h & 0xFFFF) / 65535.0


@njit(cache=True, fastmath=True, inline="always")
def _vnoise(x, y, z):
    ix, iy, iz = math.floor(x), math.floor(y), math.floor(z)
    fx, fy, fz = x - ix, y - iy, z - iz
    fx = fx * fx * (3 - 2 * fx)
    fy = fy * fy * (3 - 2 * fy)
    fz = fz * fz * (3 - 2 * fz)
    i, j, k = int(ix), int(iy), int(iz)
    c000 = _hash(i, j, k)
    c100 = _hash(i + 1, j, k)
    c010 = _hash(i, j + 1, k)
    c110 = _hash(i + 1, j + 1, k)
    c001 = _hash(i, j, k + 1)
    c101 = _hash(i + 1, j, k + 1)
    c011 = _hash(i, j + 1, k + 1)
    c111 = _hash(i + 1, j + 1, k + 1)
    x00 = c000 + (c100 - c000) * fx
    x10 = c010 + (c110 - c010) * fx
    x01 = c001 + (c101 - c001) * fx
    x11 = c011 + (c111 - c011) * fx
    y0 = x00 + (x10 - x00) * fy
    y1 = x01 + (x11 - x01) * fy
    return y0 + (y1 - y0) * fz


@njit(cache=True, fastmath=True)
def shade(zb, ib, alb, emi, out, tri_n, tri_flag, cam, sky, gnd, sun, sun_col,
          sm, smc, L, grain_scale):
    """Deferred shading. cam: [eye3, R3, U3, F3, f, cx, cy].
    smc: shadow camera [o3, R3, U3, F3, f, cx, cy, bias, enabled].
    L: (k, 13) lights [pos3, col3, radius, dir3, cos_inner, cos_outer, spec]."""
    H, W = zb.shape
    ex, ey, ez = cam[0], cam[1], cam[2]
    f, cx, cy = cam[12], cam[13], cam[14]
    shH, shW = sm.shape
    use_sm = smc[16] > 0.5
    for y in range(H):
        for x in range(W):
            t = ib[y, x]
            if t < 0:
                continue
            z = zb[y, x]
            xv = (x + 0.5 - cx) * z / f
            yv = -(y + 0.5 - cy) * z / f
            Px = ex + cam[3] * xv + cam[6] * yv + cam[9] * z
            Py = ey + cam[4] * xv + cam[7] * yv + cam[10] * z
            Pz = ez + cam[5] * xv + cam[8] * yv + cam[11] * z
            fl = tri_flag[t]
            ar, ag, ab = alb[y, x, 0], alb[y, x, 1], alb[y, x, 2]
            if fl & 1:
                out[y, x, 0] = ar + emi[y, x, 0]
                out[y, x, 1] = ag + emi[y, x, 1]
                out[y, x, 2] = ab + emi[y, x, 2]
                continue
            Nx, Ny, Nz = tri_n[t, 0], tri_n[t, 1], tri_n[t, 2]
            vx, vy, vz = ex - Px, ey - Py, ez - Pz
            vl = math.sqrt(vx * vx + vy * vy + vz * vz) + 1e-9
            vx /= vl
            vy /= vl
            vz /= vl
            if Nx * vx + Ny * vy + Nz * vz < 0:
                Nx, Ny, Nz = -Nx, -Ny, -Nz
            if fl & 4:
                g = (_vnoise(Px * grain_scale, Py * grain_scale, Pz * grain_scale) * 0.6
                     + _vnoise(Px * grain_scale * 4.1, Py * grain_scale * 4.1, Pz * grain_scale * 4.1) * 0.4)
                m = 0.82 + 0.36 * g
                if fl & 16:
                    fr = Py * 6.5 - math.floor(Py * 6.5)
                    if fr < 0.12:
                        m *= 0.72 + 2.0 * fr
                ar *= m
                ag *= m
                ab *= m
            hu = 0.5 + 0.5 * Ny
            cr = sky[0] * hu + gnd[0] * (1 - hu)
            cg = sky[1] * hu + gnd[1] * (1 - hu)
            cb = sky[2] * hu + gnd[2] * (1 - hu)
            ndl = Nx * sun[0] + Ny * sun[1] + Nz * sun[2]
            if ndl > 0:
                sh = 1.0
                if use_sm:
                    qx, qy, qz = Px - smc[0], Py - smc[1], Pz - smc[2]
                    lx = smc[13] + smc[12] * (qx * smc[3] + qy * smc[4] + qz * smc[5])
                    ly = smc[14] - smc[12] * (qx * smc[6] + qy * smc[7] + qz * smc[8])
                    lz = qx * smc[9] + qy * smc[10] + qz * smc[11]
                    ix, iy = int(lx), int(ly)
                    bias = smc[15] * (1.5 - ndl)
                    acc = 0.0
                    for dy in range(-1, 2):
                        for dx in range(-1, 2):
                            sx, sy = ix + dx, iy + dy
                            if 0 <= sx < shW and 0 <= sy < shH:
                                if lz - bias <= sm[sy, sx]:
                                    acc += 1.0
                            else:
                                acc += 1.0
                    sh = acc / 9.0
                k = ndl * sh
                cr += sun_col[0] * k
                cg += sun_col[1] * k
                cb += sun_col[2] * k
            sr = 0.0
            sg = 0.0
            sb = 0.0
            for i in range(L.shape[0]):
                lx_, ly_, lz_ = L[i, 0] - Px, L[i, 1] - Py, L[i, 2] - Pz
                d2 = lx_ * lx_ + ly_ * ly_ + lz_ * lz_
                rad = L[i, 6]
                if d2 > rad * rad * 64:
                    continue
                d = math.sqrt(d2) + 1e-9
                lx_ /= d
                ly_ /= d
                lz_ /= d
                nl = Nx * lx_ + Ny * ly_ + Nz * lz_
                if nl <= 0:
                    continue
                att = 1.0 / (1.0 + d2 / (rad * rad))
                u = d2 / (rad * rad * 64)
                att *= (1 - u) * (1 - u)
                ci, co = L[i, 10], L[i, 11]
                if co < 0.999:
                    c = -(lx_ * L[i, 7] + ly_ * L[i, 8] + lz_ * L[i, 9])
                    s = (c - co) / max(ci - co, 1e-4)
                    if s <= 0:
                        continue
                    if s < 1:
                        att *= s * s * (3 - 2 * s)
                cr += L[i, 3] * nl * att
                cg += L[i, 4] * nl * att
                cb += L[i, 5] * nl * att
                if fl & 2:
                    hx, hy, hz = lx_ + vx, ly_ + vy, lz_ + vz
                    hl = math.sqrt(hx * hx + hy * hy + hz * hz) + 1e-9
                    nh = (Nx * hx + Ny * hy + Nz * hz) / hl
                    if nh > 0:
                        sp = nh ** 90 * L[i, 12] * att * 6.0
                        sr += L[i, 3] * sp
                        sg += L[i, 4] * sp
                        sb += L[i, 5] * sp
            out[y, x, 0] = ar * cr + sr + emi[y, x, 0]
            out[y, x, 1] = ag * cg + sg + emi[y, x, 1]
            out[y, x, 2] = ab * cb + sb + emi[y, x, 2]


@njit(cache=True)
def gather(ib, tri_c, tri_e, alb, emi):
    H, W = ib.shape
    for y in range(H):
        for x in range(W):
            t = ib[y, x]
            if t >= 0:
                alb[y, x, 0] = tri_c[t, 0]
                alb[y, x, 1] = tri_c[t, 1]
                alb[y, x, 2] = tri_c[t, 2]
                emi[y, x, 0] = tri_e[t, 0]
                emi[y, x, 1] = tri_e[t, 1]
                emi[y, x, 2] = tri_e[t, 2]


# --------------------------------------------------------------------------
# Camera
# --------------------------------------------------------------------------
class Camera:
    def __init__(self, eye, target, fov=35.0, roll=0.0):
        self.eye = np.asarray(eye, np.float64)
        self.target = np.asarray(target, np.float64)
        self.fov = fov
        F = self.target - self.eye
        F /= np.linalg.norm(F)
        up = np.array([0.0, 1.0, 0.0])
        if abs(F @ up) > 0.999:
            up = np.array([0.0, 0.0, -1.0])
        R = np.cross(F, up)
        R /= np.linalg.norm(R)
        U = np.cross(R, F)
        if roll:
            c, s = math.cos(roll), math.sin(roll)
            R, U = R * c + U * s, -R * s + U * c
        self.R, self.U, self.F = R, U, F

    def focal(self, h):
        return (h / 2) / math.tan(math.radians(self.fov) / 2)

    def to_view(self, P):
        Q = np.asarray(P, np.float64) - self.eye
        return np.stack([Q @ self.R, Q @ self.U, Q @ self.F], -1)

    def project(self, P, w, h):
        """World points -> (x, y, depth) in pixels."""
        v = self.to_view(np.atleast_2d(P))
        f = self.focal(h)
        z = np.maximum(v[:, 2], 1e-6)
        return np.stack([w / 2 + f * v[:, 0] / z, h / 2 - f * v[:, 1] / z, v[:, 2]], -1)


def lerp_cam(a, b, u):
    """Interpolate two cameras (eye, target, fov)."""
    return Camera(a.eye + (b.eye - a.eye) * u, a.target + (b.target - a.target) * u, a.fov + (b.fov - a.fov) * u)


# --------------------------------------------------------------------------
# Frame rendering
# --------------------------------------------------------------------------
class Light:
    def __init__(self, pos, col, radius=1.0, power=1.0, direction=None, cone=(30, 50), spec=1.0):
        self.pos = np.asarray(pos, np.float32)
        self.col = np.asarray(col, np.float32) * power
        self.radius = radius
        self.dir = np.asarray(direction if direction is not None else (0, -1, 0), np.float32)
        self.dir /= np.linalg.norm(self.dir) + 1e-9
        if direction is None:
            self.ci, self.co = 1.0, 1.0
        else:
            self.ci, self.co = math.cos(math.radians(cone[0])), math.cos(math.radians(cone[1]))
        self.spec = spec

    def row(self):
        return np.concatenate([self.pos, self.col, [self.radius], self.dir, [self.ci, self.co, self.spec]])


class Env:
    """Lighting environment for a shot."""
    def __init__(self, sky=(0.25, 0.28, 0.33), gnd=(0.10, 0.09, 0.08), sun=(0.5, 0.8, 0.3),
                 sun_col=(0.0, 0.0, 0.0), bg_top=(0.05, 0.06, 0.08), bg_bot=(0.02, 0.02, 0.03),
                 fog=(0.05, 0.06, 0.08), fog_density=0.0, fog_start=0.0, lights=(), exposure=1.0,
                 shadow_res=2048, grain_scale=3.0, bloom=0.35, bloom_thr=0.85):
        self.sky = np.asarray(sky, np.float32)
        self.gnd = np.asarray(gnd, np.float32)
        s = np.asarray(sun, np.float64)
        self.sun = (s / np.linalg.norm(s)).astype(np.float32)
        self.sun_col = np.asarray(sun_col, np.float32)
        self.bg_top, self.bg_bot = np.asarray(bg_top, np.float32), np.asarray(bg_bot, np.float32)
        self.fog = np.asarray(fog, np.float32)
        self.fog_density, self.fog_start = fog_density, fog_start
        self.lights = list(lights)
        self.exposure = exposure
        self.shadow_res = shadow_res
        self.grain_scale = grain_scale
        self.bloom, self.bloom_thr = bloom, bloom_thr


_SHADOW_CACHE = {}
_BUFFERS = {}


def _buf(name, shape, dtype):
    """Per-process frame buffers, reused instead of reallocated every frame."""
    b = _BUFFERS.get(name)
    if b is None or b.shape != shape:
        b = _BUFFERS[name] = np.empty(shape, dtype)
    return b


def _shadow_map(V, F, noshadow, env, res, static=None, static_key=None):
    """Orthographic depth map along the sun direction, fit to the scene bounds.
    static/static_key: triangles that did not change since the last frame. Their depth map
    is cached and only the moving triangles are rasterized on top. Depth-only, so the
    result is identical to rasterizing everything."""
    d = -env.sun.astype(np.float64)
    lo, hi = V.min(0), V.max(0)
    ck = None
    if static is not None and static_key is not None:
        ck = (static_key, tuple(np.round(env.sun, 6)), res)
        hit = _SHADOW_CACHE.get(ck)
        if hit is not None and np.array_equal(hit[0], lo) and np.array_equal(hit[1], hi):
            zb, smc = hit[2].copy(), hit[3]
            o, R, U, F_, f = smc[0:3], smc[3:6], smc[6:9], smc[9:12], smc[12]
            Q = V - o
            Vv = np.stack([Q @ R, Q @ U, Q @ F_], -1).astype(np.float32)
            ib = _buf("sm_ib", (res, res), np.int32)
            raster(Vv, F, zb, ib, f, res / 2, res / 2, 0.0, False, noshadow | static)
            return zb, smc
    c = (lo + hi) / 2
    r = np.linalg.norm(hi - lo) / 2 + 1e-3
    F_ = d / np.linalg.norm(d)
    up = np.array([0.0, 0.0, -1.0]) if abs(F_[1]) > 0.95 else np.array([0.0, 1.0, 0.0])
    R = np.cross(F_, up)
    R /= np.linalg.norm(R)
    U = np.cross(R, F_)
    o = c - F_ * r * 2
    Q = V - o
    Vv = np.stack([Q @ R, Q @ U, Q @ F_], -1).astype(np.float32)
    f = res / (2 * r)
    zb = np.full((res, res), np.inf, np.float32)
    ib = _buf("sm_ib", (res, res), np.int32)
    smc = np.array([*o, *R, *U, *F_, f, res / 2, res / 2, 1.6 / f + r * 2e-4, 1.0], np.float64)
    if ck is not None:
        raster(Vv, F, zb, ib, f, res / 2, res / 2, 0.0, False, noshadow | ~static)
        if len(_SHADOW_CACHE) > 6:
            _SHADOW_CACHE.clear()
        _SHADOW_CACHE[ck] = (lo.copy(), hi.copy(), zb.copy(), smc)
        raster(Vv, F, zb, ib, f, res / 2, res / 2, 0.0, False, noshadow | static)
    else:
        raster(Vv, F, zb, ib, f, res / 2, res / 2, 0.0, False, noshadow)
    return zb, smc


def render(scene, cam, env, w, h, ss=2, decals=(), return_ids=False, static=None, static_key=None):
    """scene: dict from mesh.build(). Returns HDR (h, w, 3) float32 and depth (h, w).
    static/static_key (optional): mask of triangles unchanged since the last frame, for the
    shadow-map cache."""
    W2, H2 = w * ss, h * ss
    V = scene["V"]
    F = scene["F"]
    f = cam.focal(H2)
    Vv = cam.to_view(V).astype(np.float32)
    zb = _buf("zb", (H2, W2), np.float32)
    zb.fill(np.inf)
    ib = _buf("ib", (H2, W2), np.int32)
    ib.fill(-1)
    noskip = np.zeros(len(F), np.bool_)
    raster(Vv, F, zb, ib, f, W2 / 2, H2 / 2, 0.02, True, noskip)

    # only pixels with ib >= 0 are read from alb/emi, so no clearing is needed
    alb = _buf("alb", (H2, W2, 3), np.float32)
    emi = _buf("emi", (H2, W2, 3), np.float32)
    gather(ib, scene["C"], scene["E"], alb, emi)
    if decals:
        obj = np.where(ib >= 0, scene["O"][np.maximum(ib, 0)], -1)
        for dc in decals:
            dc.apply(alb, emi, obj, cam, W2, H2)

    if np.any(env.sun_col > 0):
        sm, smc = _shadow_map(V.astype(np.float64), F, scene["G"] & NOSHADOW > 0, env, env.shadow_res,
                              static, static_key)
    else:
        sm, smc = np.zeros((1, 1), np.float32), np.zeros(17, np.float64)
    camv = np.array([*cam.eye, *cam.R, *cam.U, *cam.F, f, W2 / 2, H2 / 2], np.float64)
    L = np.array([l.row() for l in env.lights], np.float32).reshape(-1, 13)
    out = _buf("out", (H2, W2, 3), np.float32)
    g = np.linspace(0, 1, H2, dtype=np.float32)[:, None, None]
    out[:] = env.bg_top * (1 - g) + env.bg_bot * g
    shade(zb, ib, alb, emi, out, scene["N"], scene["G"], camv, env.sky, env.gnd, env.sun,
          env.sun_col, sm, smc, L, env.grain_scale)

    if ss > 1:
        out = cv2.resize(out, (w, h), interpolation=cv2.INTER_AREA)
        zfin = np.where(np.isfinite(zb), zb, 1e4).astype(np.float32)
        z = cv2.resize(zfin, (w, h), interpolation=cv2.INTER_AREA)
        if return_ids:
            ids = ib[::ss, ::ss]
    else:
        out = out.copy()
        z = np.where(np.isfinite(zb), zb, 1e4).astype(np.float32)
        ids = ib.copy()
    out *= env.exposure
    if env.fog_density > 0:
        k = 1 - np.exp(-env.fog_density * np.maximum(z - env.fog_start, 0))
        out += (env.fog - out) * k[..., None]
    if return_ids:
        return out, z, ids
    return out, z


class Decal:
    """RGBA image (float 0..1) mapped onto a world quad (p00, p10, p11, p01), only on object `obj`."""
    def __init__(self, img, corners, obj, emissive=0.0, alpha=1.0):
        self.img = img
        self.corners = np.asarray(corners, np.float64)
        self.obj = obj
        self.emissive = emissive
        self.alpha = alpha

    def apply(self, alb, emi, objbuf, cam, W, H):
        if self.alpha <= 0.002:
            return
        P = cam.project(self.corners, W, H)
        if np.any(P[:, 2] <= 0.05):
            return
        x0, y0 = np.floor(P[:, :2].min(0)).astype(int)
        x1, y1 = np.ceil(P[:, :2].max(0)).astype(int)
        x0, y0 = max(x0, 0), max(y0, 0)
        x1, y1 = min(x1, W), min(y1, H)
        if x1 <= x0 or y1 <= y0:
            return
        ih, iw = self.img.shape[:2]
        src = np.float32([[0, 0], [iw, 0], [iw, ih], [0, ih]])
        dst = (P[:, :2] - [x0, y0]).astype(np.float32)
        M = cv2.getPerspectiveTransform(src, dst)
        warped = cv2.warpPerspective(self.img, M, (x1 - x0, y1 - y0), flags=cv2.INTER_LINEAR,
                                     borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
        a = warped[..., 3] * self.alpha * (objbuf[y0:y1, x0:x1] == self.obj)
        rgb = warped[..., :3]
        reg = alb[y0:y1, x0:x1]
        reg += (rgb - reg) * a[..., None]
        if self.emissive > 0:
            emi[y0:y1, x0:x1] += rgb * a[..., None] * self.emissive


# --------------------------------------------------------------------------
# Post
# --------------------------------------------------------------------------
def bloom(img, thr=0.85, amount=0.35):
    """Glow from bright pixels. The wide radii are blurred at lower resolution (same look, far cheaper)."""
    if amount <= 0:
        return img
    b = np.maximum(img - thr, 0)
    h, w = img.shape[:2]
    s2 = cv2.resize(b, (w // 2, h // 2), interpolation=cv2.INTER_AREA)
    s4 = cv2.resize(s2, (w // 4, h // 4), interpolation=cv2.INTER_AREA)
    s8 = cv2.resize(s4, (w // 8, h // 8), interpolation=cv2.INTER_AREA)
    acc = cv2.GaussianBlur(s2, (0, 0), 3) * 0.5
    acc += cv2.resize(cv2.GaussianBlur(s4, (0, 0), 4.5) * 0.35, (w // 2, h // 2), interpolation=cv2.INTER_LINEAR)
    acc += cv2.resize(cv2.GaussianBlur(s8, (0, 0), 6) * 0.25, (w // 2, h // 2), interpolation=cv2.INTER_LINEAR)
    return img + cv2.resize(acc, (w, h), interpolation=cv2.INTER_LINEAR) * amount


def dof(img, z, focus, aperture=1.0, max_blur=7.0, tilt=None):
    """Depth of field with blur levels blended by circle of confusion (in px).
    tilt: optional (y_center, half_band) in 0..1 for an extra tilt-shift falloff by screen row."""
    if aperture <= 0:
        return img
    coc = aperture * np.abs(1.0 - focus / np.maximum(z, 1e-3)) * 6.0
    if tilt is not None:
        h = img.shape[0]
        yy = np.linspace(0, 1, h, dtype=np.float32)[:, None]
        coc = coc + np.clip((np.abs(yy - tilt[0]) - tilt[1]) / 0.35, 0, 1) * max_blur * 0.8
    coc = np.clip(coc, 0, max_blur)
    coc = cv2.GaussianBlur(coc, (0, 0), 2.0)
    levels = [0.0, 1.5, 3.5, 7.0]
    h, w = img.shape[:2]
    half = cv2.resize(img, (w // 2, h // 2), interpolation=cv2.INTER_AREA)
    blurs = [img, cv2.GaussianBlur(img, (0, 0), 1.5)] + [
        cv2.resize(cv2.GaussianBlur(half, (0, 0), s / 2), (w, h), interpolation=cv2.INTER_LINEAR) for s in levels[2:]]
    out = np.zeros_like(img)
    wsum = np.zeros(z.shape, np.float32)
    for i, s in enumerate(levels):
        lo = levels[i - 1] if i > 0 else -1.0
        hi = levels[i + 1] if i + 1 < len(levels) else 1e9
        wgt = np.where(coc < s, np.clip((coc - lo) / max(s - lo, 1e-3), 0, 1),
                       np.clip((hi - coc) / max(hi - s, 1e-3), 0, 1)).astype(np.float32)
        out += blurs[i] * wgt[..., None]
        wsum += wgt
    return out / np.maximum(wsum, 1e-4)[..., None]


def tonemap(x):
    """Soft filmic shoulder, keeps mid-tones."""
    x = np.maximum(x, 0)
    return x * (1 + x / 6.0) / (1 + x)
