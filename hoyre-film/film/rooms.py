# -*- coding: utf-8 -*-
"""The three windows as cut-away rooms. Each room is built at the origin with its
window in the front wall (z = 0, facing +z), so the camera can dolly from the street
side straight through the window. Night and day variants share all geometry."""
import functools
import math

import numpy as np

from . import kit as K
from . import mesh as M
from .mesh import GRAIN, NOSHADOW, PANELS, UNLIT, box, cylinder, merge
from .raster import Env, Light

RW, RD, RH = 3.6, 3.0, 2.2          # room width, depth, height
WIN_X, WIN_Y, WIN_W, WIN_H = 0.0, 0.85, 1.1, 1.05
FIG_H = 1.25


def shell(wall=(0.86, 0.83, 0.77), floor=K.LIGHTWOOD, facade=K.OCHRE, win_x=WIN_X):
    x0, x1, z0 = -RW / 2, RW / 2, -RD
    t = 0.12
    p = [box(x0, -0.1, z0, x1, 0.0, 0.0, floor, flags=GRAIN | PANELS),
         box(x0, 0, z0 - t, x1, RH, z0, wall, flags=GRAIN),
         box(x0 - t, 0, z0 - t, x0, RH, 0.0, wall, flags=GRAIN),
         box(x1, 0, z0 - t, x1 + t, RH, 0.0, wall, flags=GRAIN),
         box(x0 - t, RH, z0 - t, x1 + t, RH + 0.08, 0.0, (0.9, 0.9, 0.88))]
    # front wall with the window opening; exterior face in the facade colour
    a, b = win_x - WIN_W / 2, win_x + WIN_W / 2
    for (u0, v0, u1, v1) in ((x0 - t, 0, a, RH), (b, 0, x1 + t, RH), (a, 0, b, WIN_Y), (a, WIN_Y + WIN_H, b, RH)):
        p.append(box(u0, v0, 0.0, u1, v1, 0.04, wall, flags=GRAIN))
        p.append(box(u0, v0, 0.04, u1, v1, t + 0.04, facade, flags=GRAIN | PANELS))
    fr = K.TRIM
    z1 = t + 0.09
    p += [box(a - 0.08, WIN_Y - 0.12, 0.0, b + 0.08, WIN_Y, z1 + 0.06, fr),
          box(a - 0.08, WIN_Y + WIN_H, 0.0, b + 0.08, WIN_Y + WIN_H + 0.08, z1, fr),
          box(a - 0.08, WIN_Y, 0.0, a, WIN_Y + WIN_H, z1, fr),
          box(b, WIN_Y, 0.0, b + 0.08, WIN_Y + WIN_H, z1, fr)]
    # skirting
    p.append(box(x0, 0, z0, x1, 0.08, z0 + 0.02, (0.92, 0.92, 0.9)))
    return merge(p)


# --------------------------------------------------------------------------
@functools.lru_cache(maxsize=4)
def kitchen(day=False):
    p = [shell((0.88, 0.84, 0.76), K.LIGHTWOOD, K.OCHRE)]
    # counter + cupboards along the back wall
    p.append(box(-1.75, 0, -2.98, 0.6, 0.85, -2.45, (0.82, 0.80, 0.76), flags=GRAIN))
    p.append(box(-1.78, 0.85, -3.0, 0.62, 0.9, -2.42, (0.42, 0.43, 0.45)))
    p.append(box(-1.75, 1.35, -2.98, 0.6, 1.9, -2.7, (0.82, 0.80, 0.76), flags=GRAIN))
    p.append(box(0.75, 0, -2.98, 1.35, 1.75, -2.4, (0.90, 0.90, 0.88)))           # fridge
    p.append(K.wall_clock(1.2, 1.55, -2.98))
    p.append(K.table(0.0, -1.3, 1.2, 0.8, 0.75))
    p.append(K.chair(-0.2, -1.95, 0.0))
    p.append(K.chair(0.5, -0.6, math.pi))
    p.append(K.mug(0.32, 0.75, -1.15))
    # pendant lamp
    p.append(box(-0.01, 1.55, -1.31, 0.01, RH, -1.29, (0.2, 0.2, 0.2)))
    p.append(cylinder(0.0, 1.38, -1.3, 0.26, 0.08, 0.18, (0.32, 0.36, 0.34), n=10))
    p.append(cylinder(0.0, 1.375, -1.3, 0.2, 0.2, 0.01, (1, 0.9, 0.7), emit=(4, 3, 1.8), flags=UNLIT | NOSHADOW))
    # plant on the sill
    p.append(cylinder(-0.35, WIN_Y, -0.1, 0.07, 0.09, 0.12, (0.62, 0.42, 0.32), n=8))
    p.append(M.sphere(-0.35, WIN_Y + 0.2, -0.1, 0.11, K.MOSS, nu=6, nv=4))
    return merge(p)


def kitchen_dyn(t_glow=0.4, day=False, stand=0.0):
    """Mother at the table; the phone glows faintly (night) or with a new message (day)."""
    s = K.figure(-0.2, -1.95 + 0.3 * stand, FIG_H, (0.80, 0.76, 0.72), "stand" if stand > 0.5 else "sit",
                 face=0.0)
    ph = K.phone(-0.05, 0.75, -1.25, glow=t_glow, ang=0.3, obj=7)
    return [s, ph]


def kitchen_env(day=False, glow=0.4):
    if day:
        return Env(sky=(0.42, 0.42, 0.44), gnd=(0.16, 0.13, 0.10), sun=(-0.3, 0.6, 1.0), sun_col=(1.7, 1.5, 1.2),
                   bg_top=(0.75, 0.80, 0.86), bg_bot=(0.85, 0.82, 0.76), lights=[], shadow_res=2048)
    return Env(sky=(0.05, 0.05, 0.06), gnd=(0.02, 0.018, 0.015), sun=(0.3, 0.6, 1.0), sun_col=(0.03, 0.04, 0.07),
               bg_top=(0.02, 0.025, 0.04), bg_bot=(0.01, 0.01, 0.015),
               lights=[Light((0.0, 1.3, -1.3), (1.0, 0.75, 0.48), 0.9, 2.6),
                       Light((-0.05, 0.85, -1.25), (0.6, 0.7, 0.9), 0.12, 0.6 * glow)],
               shadow_res=2048)


# --------------------------------------------------------------------------
@functools.lru_cache(maxsize=4)
def study(day=False, passed=False):
    p = [shell((0.80, 0.82, 0.80), (0.58, 0.48, 0.38), K.SAND)]
    p.append(K.table(0.0, -1.35, 1.5, 0.75, 0.75, col=(0.62, 0.52, 0.42)))
    p.append(K.chair(0.0, -2.0, 0.0))
    # jacket with reflective vest on the chair back
    p.append(box(-0.24, 0.55, -2.27, 0.24, 0.98, -2.19, (0.30, 0.33, 0.36)))
    p.append(box(-0.25, 0.6, -2.29, 0.25, 0.94, -2.27, (0.80, 0.85, 0.30)))
    p.append(box(-0.255, 0.7, -2.3, 0.255, 0.74, -2.285, (0.85, 0.85, 0.85), emit=(0.15, 0.15, 0.15)))
    p.append(box(-0.255, 0.82, -2.3, 0.255, 0.86, -2.285, (0.85, 0.85, 0.85), emit=(0.15, 0.15, 0.15)))
    # stacks of blank word cards, a sheet, a notebook, a lunchbox
    rng = np.random.default_rng(5)
    for i, (x, z) in enumerate(((-0.45, -1.2), (-0.25, -1.45), (0.4, -1.5))):
        for k in range(rng.integers(3, 7)):
            p.append(box(-0.09, 0, -0.06, 0.09, 0.012, 0.06, (0.95, 0.94, 0.9)).roty(rng.uniform(-0.3, 0.3))
                     .move(x, 0.75 + k * 0.013, z))
    p.append(box(-0.15, 0.75, -1.3, 0.15, 0.753, -0.9, (0.96, 0.96, 0.94), obj=21))         # glossary sheet
    p.append(box(0.15, 0.75, -1.25, 0.45, 0.77, -1.0, (0.35, 0.42, 0.55)))                   # notebook
    p.append(box(0.5, 0.75, -1.65, 0.7, 0.85, -1.5, (0.55, 0.6, 0.5)))                       # lunchbox
    p.append(K.desk_lamp(-0.6, 0.75, -1.6, on=not day, ang=-0.6))
    p.append(K.poster(-1.0, 1.2, -2.98, 0.6, 0.45, (0.85, 0.82, 0.70)))
    p.append(box(1.0, 0, -2.95, 1.7, 1.6, -2.55, (0.62, 0.52, 0.42), flags=GRAIN))           # shelf
    for k in range(4):
        p.append(box(1.05, 0.3 + k * 0.4, -2.93, 1.65, 0.33 + k * 0.4, -2.57, (0.5, 0.4, 0.32)))
    if passed:
        p.append(box(-0.1, 0.755, -1.05, 0.2, 0.757, -0.65, (0.98, 0.98, 0.96)).roty(0.15, about=(0.05, 0, -0.85)))
        p.append(cylinder(0.12, 0.757, -0.75, 0.04, 0.04, 0.002, K.BLUE_S, n=10))
    return merge(p)


def study_dyn(day=False):
    if day:
        return []
    return [K.figure(0.0, -2.0, FIG_H, (0.70, 0.66, 0.62), "sit", face=0.0)]


def study_env(day=False):
    if day:
        return kitchen_env(True)
    return Env(sky=(0.04, 0.045, 0.05), gnd=(0.015, 0.015, 0.012), sun=(0.3, 0.6, 1.0), sun_col=(0.03, 0.04, 0.07),
               bg_top=(0.02, 0.025, 0.04), bg_bot=(0.01, 0.01, 0.015),
               lights=[Light((-0.52, 1.0, -1.6), (1.0, 0.78, 0.5), 0.55, 3.2, direction=(0.2, -1, 0.15), cone=(40, 85)),
                       Light((0.6, 2.0, -1.0), (0.5, 0.45, 0.4), 1.5, 0.35)],
               shadow_res=2048)


# --------------------------------------------------------------------------
@functools.lru_cache(maxsize=4)
def bedroom(day=False):
    p = [shell((0.62, 0.68, 0.74), (0.55, 0.50, 0.46), K.OFFWHITE, win_x=0.6)]
    p.append(K.bed(-0.9, -1.5, (0.36, 0.44, 0.56)))
    # poster: blank sheet with a simple ball shape (no logo)
    p.append(K.poster(-0.9, 1.15, -2.98, 0.7, 0.5, (0.86, 0.88, 0.86)))
    p.append(cylinder(-0.9, 1.4, -2.955, 0.13, 0.13, 0.012, (0.62, 0.66, 0.62), n=12).rotx(math.pi / 2, about=(-0.9, 1.4, -2.955)))
    p.append(box(0.9, 0, -2.95, 1.7, 0.75, -2.5, (0.62, 0.55, 0.48), flags=GRAIN))           # desk
    p.append(box(1.0, 0.75, -2.9, 1.5, 1.05, -2.85, (0.15, 0.15, 0.17)))                      # dark monitor
    p.append(box(-1.75, 0, -0.6, -1.3, 1.6, -0.1, (0.70, 0.66, 0.60), flags=GRAIN))           # wardrobe
    p.append(box(-0.3, 0, -0.2, 0.6, 0.012, 0.0, (0.4, 0.48, 0.6)))                           # rug edge
    return merge(p)


def bedroom_dyn(glow=0.0, day=False, shoes=True):
    out = []
    if not day:
        out.append(K.figure(-0.55, -1.2, FIG_H, (0.66, 0.68, 0.72), "sit", face=math.pi / 2 + 0.25))
        out.append(K.phone(-0.05, 0.62, -1.0, glow=glow, ang=0.5, obj=8).rotx(-0.5, about=(-0.05, 0.62, -1.0)))
    else:
        out.append(K.phone(-0.7, 0.57, -1.3, glow=0.0, ang=0.9))
    if shoes:
        for dx in (0.0, 0.16):
            out.append(box(0.2 + dx, 0, -0.85, 0.3 + dx, 0.08, -0.6, (0.12, 0.12, 0.14)))
            out.append(box(0.2 + dx, 0, -0.85, 0.3 + dx, 0.015, -0.6, (0.92, 0.92, 0.9)))
    return out


def bedroom_env(day=False, glow=0.0):
    if day:
        return kitchen_env(True)
    return Env(sky=(0.06, 0.08, 0.13), gnd=(0.015, 0.02, 0.03), sun=(0.4, 0.5, 1.0), sun_col=(0.12, 0.16, 0.28),
               bg_top=(0.02, 0.03, 0.05), bg_bot=(0.01, 0.012, 0.02),
               lights=[Light((-0.05, 0.9, -1.0), (0.7, 0.8, 1.0), 0.35, 2.2 * glow),
                       Light((0.6, 1.4, 0.6), (0.4, 0.5, 0.8), 1.5, 0.8, direction=(0, -0.4, -1), cone=(30, 60))],
               shadow_res=2048)
