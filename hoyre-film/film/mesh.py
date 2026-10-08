# -*- coding: utf-8 -*-
"""Low-poly mesh primitives and scene assembly. y is up; units are diorama metres."""
import math

import numpy as np

from .raster import GRAIN, NOSHADOW, PANELS, UNLIT, WET  # noqa: F401


def hexc(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], np.float32)


def lin_rgb(c):
    """sRGB 0..1 -> linear (materials are given in sRGB)."""
    c = np.asarray(c, np.float32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4).astype(np.float32)


class Mesh:
    def __init__(self, V, F, col, emit=(0, 0, 0), flags=0, obj=0):
        self.V = np.asarray(V, np.float64).reshape(-1, 3)
        self.F = np.asarray(F, np.int32).reshape(-1, 3)
        m = len(self.F)
        c = np.asarray(col, np.float32)
        self.C = np.tile(lin_rgb(c), (m, 1)) if c.ndim == 1 else lin_rgb(c)
        e = np.asarray(emit, np.float32)
        self.E = np.tile(e, (m, 1)) if e.ndim == 1 else e.astype(np.float32)
        self.G = np.full(m, flags, np.uint8) if np.ndim(flags) == 0 else np.asarray(flags, np.uint8)
        self.O = np.full(m, obj, np.int32) if np.ndim(obj) == 0 else np.asarray(obj, np.int32)

    def copy(self):
        m = Mesh.__new__(Mesh)
        m.V, m.F, m.C, m.E, m.G, m.O = self.V.copy(), self.F.copy(), self.C.copy(), self.E.copy(), self.G.copy(), self.O.copy()
        return m

    # transforms (in place, chainable)
    def move(self, dx=0.0, dy=0.0, dz=0.0):
        self.V = self.V + np.array([dx, dy, dz])
        return self

    def scale(self, sx, sy=None, sz=None, about=(0, 0, 0)):
        sy = sx if sy is None else sy
        sz = sx if sz is None else sz
        a = np.asarray(about, np.float64)
        self.V = (self.V - a) * np.array([sx, sy, sz]) + a
        return self

    def roty(self, ang, about=(0, 0, 0)):
        c, s = math.cos(ang), math.sin(ang)
        a = np.asarray(about, np.float64)
        q = self.V - a
        self.V = np.stack([q[:, 0] * c + q[:, 2] * s, q[:, 1], -q[:, 0] * s + q[:, 2] * c], 1) + a
        return self

    def rotx(self, ang, about=(0, 0, 0)):
        c, s = math.cos(ang), math.sin(ang)
        a = np.asarray(about, np.float64)
        q = self.V - a
        self.V = np.stack([q[:, 0], q[:, 1] * c - q[:, 2] * s, q[:, 1] * s + q[:, 2] * c], 1) + a
        return self

    def rotz(self, ang, about=(0, 0, 0)):
        c, s = math.cos(ang), math.sin(ang)
        a = np.asarray(about, np.float64)
        q = self.V - a
        self.V = np.stack([q[:, 0] * c - q[:, 1] * s, q[:, 0] * s + q[:, 1] * c, q[:, 2]], 1) + a
        return self

    def paint(self, col=None, emit=None, flags=None, obj=None):
        if col is not None:
            self.C[:] = lin_rgb(col)
        if emit is not None:
            self.E[:] = np.asarray(emit, np.float32)
        if flags is not None:
            self.G[:] = flags
        if obj is not None:
            self.O[:] = obj
        return self


def merge(meshes):
    meshes = [m for m in meshes if m is not None and len(m.F)]
    if not meshes:
        return Mesh(np.zeros((3, 3)), np.zeros((0, 3)), (0, 0, 0))
    out = Mesh.__new__(Mesh)
    offs = np.cumsum([0] + [len(m.V) for m in meshes[:-1]])
    out.V = np.concatenate([m.V for m in meshes])
    out.F = np.concatenate([m.F + o for m, o in zip(meshes, offs)]).astype(np.int32)
    out.C = np.concatenate([m.C for m in meshes])
    out.E = np.concatenate([m.E for m in meshes])
    out.G = np.concatenate([m.G for m in meshes])
    out.O = np.concatenate([m.O for m in meshes])
    return out


def build(meshes):
    """-> dict of arrays for raster.render (normals per face)."""
    m = merge(meshes) if isinstance(meshes, (list, tuple)) else meshes
    V = m.V
    a, b, c = V[m.F[:, 0]], V[m.F[:, 1]], V[m.F[:, 2]]
    n = np.cross(b - a, c - a)
    n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    return {"V": V, "F": m.F, "C": m.C, "E": m.E, "G": m.G, "O": m.O, "N": n.astype(np.float32)}


# --------------------------------------------------------------------------
# Primitives
# --------------------------------------------------------------------------
_BOX_F = np.array([[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4],
                   [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]])


def box(x0, y0, z0, x1, y1, z1, col, **kw):
    V = [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1),
         (x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)]
    return Mesh(V, _BOX_F, col, **kw)


def cbox(cx, cy, cz, sx, sy, sz, col, **kw):
    """Box by centre of its bottom face and size."""
    return box(cx - sx / 2, cy, cz - sz / 2, cx + sx / 2, cy + sy, cz + sz / 2, col, **kw)


def quad(p0, p1, p2, p3, col, **kw):
    return Mesh([p0, p1, p2, p3], [[0, 1, 2], [0, 2, 3]], col, **kw)


def ground(x0, z0, x1, z1, y, col, nx=8, nz=8, jitter=0.0, seed=0, **kw):
    """Subdivided plane (so near-plane clipping and lights behave)."""
    xs = np.linspace(x0, x1, nx + 1)
    zs = np.linspace(z0, z1, nz + 1)
    X, Z = np.meshgrid(xs, zs)
    Y = np.full_like(X, y)
    if jitter:
        Y = Y + np.random.default_rng(seed).uniform(-jitter, jitter, X.shape)
    V = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
    F = []
    for j in range(nz):
        for i in range(nx):
            a = j * (nx + 1) + i
            F += [[a, a + nx + 1, a + 1], [a + 1, a + nx + 1, a + nx + 2]]
    return Mesh(V, F, col, **kw)


def cylinder(cx, cy, cz, r0, r1, h, col, n=8, cap=True, phase=0.0, **kw):
    ang = np.linspace(0, 2 * np.pi, n, endpoint=False) + phase
    bot = np.stack([cx + r0 * np.cos(ang), np.full(n, cy), cz + r0 * np.sin(ang)], 1)
    top = np.stack([cx + r1 * np.cos(ang), np.full(n, cy + h), cz + r1 * np.sin(ang)], 1)
    V = list(bot) + list(top) + [(cx, cy, cz), (cx, cy + h, cz)]
    F = []
    for i in range(n):
        j = (i + 1) % n
        F += [[i, n + i, j], [j, n + i, n + j]]
        if cap:
            F += [[2 * n, i, j], [2 * n + 1, n + j, n + i]]
    return Mesh(V, F, col, **kw)


def sphere(cx, cy, cz, r, col, nu=8, nv=6, sy=1.0, stagger=True, **kw):
    V = [(cx, cy - r * sy, cz)]
    for j in range(1, nv):
        th = math.pi * j / nv
        for i in range(nu):
            ph = 2 * math.pi * i / nu + (0.5 * 2 * math.pi / nu if (j % 2 and stagger) else 0)
            V.append((cx + r * math.sin(th) * math.cos(ph), cy - r * math.cos(th) * sy, cz + r * math.sin(th) * math.sin(ph)))
    V.append((cx, cy + r * sy, cz))
    F = []
    top = len(V) - 1
    for i in range(nu):
        F.append([0, 1 + (i + 1) % nu, 1 + i])
    for j in range(nv - 2):
        a0 = 1 + j * nu
        a1 = 1 + (j + 1) * nu
        for i in range(nu):
            i2 = (i + 1) % nu
            F += [[a0 + i, a0 + i2, a1 + i], [a0 + i2, a1 + i2, a1 + i]]
    last = 1 + (nv - 2) * nu
    for i in range(nu):
        F.append([last + i, last + (i + 1) % nu, top])
    return Mesh(V, F, col, **kw)


def prism(pts2d, y0, y1, col, **kw):
    """Extrude a convex 2D polygon (x, z) between heights y0..y1."""
    p = np.asarray(pts2d, np.float64)
    n = len(p)
    V = [(x, y0, z) for x, z in p] + [(x, y1, z) for x, z in p]
    F = []
    for i in range(n):
        j = (i + 1) % n
        F += [[i, j, n + i], [j, n + j, n + i]]
    for i in range(1, n - 1):
        F += [[0, i + 1, i], [n, n + i, n + i + 1]]
    return Mesh(V, F, col, **kw)


def gable_roof(x0, x1, z0, z1, y, h, col, over=0.12, along="x", **kw):
    """Pitched roof: ridge along x (or z), with overhang."""
    if along == "x":
        x0, x1, z0, z1 = x0 - over, x1 + over, z0 - over, z1 + over
        zm = (z0 + z1) / 2
        V = [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1), (x0, y + h, zm), (x1, y + h, zm)]
        F = [[0, 1, 5], [0, 5, 4], [2, 3, 4], [2, 4, 5], [0, 4, 3], [1, 2, 5], [0, 3, 2], [0, 2, 1]]
    else:
        x0, x1, z0, z1 = x0 - over, x1 + over, z0 - over, z1 + over
        xm = (x0 + x1) / 2
        V = [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1), (xm, y + h, z0), (xm, y + h, z1)]
        F = [[0, 4, 5], [0, 5, 3], [1, 2, 5], [1, 5, 4], [0, 1, 4], [3, 5, 2], [0, 3, 2], [0, 2, 1]]
    return Mesh(V, F, col, **kw)


def extrude_polygon(poly, y0, y1, col, side_col=None, **kw):
    """Extrude a shapely Polygon (in x, z) – used for letters and map pieces."""
    import shapely
    tris = shapely.constrained_delaunay_triangles(poly)
    V, F = [], []
    for g in tris.geoms:
        c = np.asarray(g.exterior.coords)[:3]
        k = len(V)
        V += [(x, y1, z) for x, z in c]
        F.append([k, k + 2, k + 1])
    top = Mesh(V, F, col, **kw)
    # make top faces point up
    tv = top.V[top.F]
    nrm = np.cross(tv[:, 1] - tv[:, 0], tv[:, 2] - tv[:, 0])[:, 1]
    top.F[nrm < 0] = top.F[nrm < 0][:, ::-1]
    sides = []
    rings = [poly.exterior] + list(poly.interiors)
    for r in rings:
        c = np.asarray(r.coords)
        n = len(c) - 1
        Vs = [(x, y0, z) for x, z in c[:n]] + [(x, y1, z) for x, z in c[:n]]
        Fs = []
        for i in range(n):
            j = (i + 1) % n
            Fs += [[i, j, n + i], [j, n + j, n + i]]
        sides.append(Mesh(Vs, Fs, side_col if side_col is not None else col, **kw))
    return merge([top] + sides)
