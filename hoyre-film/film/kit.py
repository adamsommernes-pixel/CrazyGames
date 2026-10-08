# -*- coding: utf-8 -*-
"""Reusable diorama pieces. One kit feeds every set, so a house, a figure or a bar
is modelled once and reused in all 34 shots."""
import functools
import math

import numpy as np

from . import mesh as M
from .common import BLUE
from .mesh import GRAIN, NOSHADOW, PANELS, UNLIT, WET, box, cbox, cylinder, gable_roof, merge, sphere
from .raster import Light

# Materials (sRGB)
OFFWHITE = (0.89, 0.87, 0.82)
OCHRE = (0.78, 0.60, 0.33)
SAND = (0.80, 0.73, 0.60)
MOSS = (0.47, 0.53, 0.41)
SLATE = (0.29, 0.31, 0.34)
WARMGREY = (0.56, 0.54, 0.51)
ASPHALT = (0.25, 0.26, 0.28)
CURB = (0.52, 0.51, 0.49)
GRASS = (0.40, 0.46, 0.36)
WATER = (0.20, 0.30, 0.36)
WOOD = (0.55, 0.42, 0.30)
LIGHTWOOD = (0.76, 0.64, 0.48)
FIG = (0.84, 0.82, 0.78)       # default figure clay
FIG_DARK = (0.42, 0.44, 0.48)
GLASS = (0.07, 0.08, 0.10)
TRIM = (0.93, 0.92, 0.89)
PLINTH = (0.62, 0.63, 0.64)
BLUE_S = tuple(float(c) for c in BLUE)     # sRGB Høyre blue

WARM_LIGHT = np.array([2.6, 1.75, 0.85], np.float32)
COOL_LIGHT = np.array([0.55, 0.75, 1.5], np.float32)


def blue_emit(k=1.0):
    from .mesh import lin_rgb
    return lin_rgb(BLUE_S) * k


# --------------------------------------------------------------------------
# Buildings
# --------------------------------------------------------------------------
def window(x, y, z, w, h, facing=1, lit=None, frame=TRIM, mullion=True, obj=0):
    """Window on a wall facing +z (facing=1) or -z (facing=-1) at plane z.
    lit: emission colour (linear) or None."""
    s = facing
    t = 0.04
    out = []
    glass_emit = (0, 0, 0) if lit is None else lit
    out.append(box(x - w / 2, y, min(z, z + s * 0.01), x + w / 2, y + h, max(z, z + s * 0.01),
                   GLASS if lit is None else (0.30, 0.26, 0.2), emit=glass_emit,
                   flags=UNLIT if lit is not None else 0, obj=obj))
    z0, z1 = sorted((z, z + s * t))
    out += [box(x - w / 2 - 0.06, y - 0.06, z0, x + w / 2 + 0.06, y, z1, frame),
            box(x - w / 2 - 0.06, y + h, z0, x + w / 2 + 0.06, y + h + 0.06, z1, frame),
            box(x - w / 2 - 0.06, y, z0, x - w / 2, y + h, z1, frame),
            box(x + w / 2, y, z0, x + w / 2 + 0.06, y + h, z1, frame),
            box(x - w / 2 - 0.1, y - 0.1, min(z, z + s * 0.09), x + w / 2 + 0.1, y - 0.04, max(z, z + s * 0.09), frame)]
    if mullion:
        out += [box(x - 0.025, y, z0, x + 0.025, y + h, z1, frame),
                box(x - w / 2, y + h * 0.55, z0, x + w / 2, y + h * 0.55 + 0.04, z1, frame)]
    return out


def house(x, z, w=3.4, d=3.6, floors=2, col=OFFWHITE, roof=SLATE, facing=1, lit=None, door=True,
          chimney=True, seed=0, wins=2, obj=0):
    """Wooden house on a stone foundation. lit: {(floor, col): emission} for lit windows.
    Front wall is at z + facing*d/2."""
    rng = np.random.default_rng(seed)
    fh = 1.35
    h = 0.25 + floors * fh
    z0, z1 = z - d / 2, z + d / 2
    parts = [box(x - w / 2 - 0.05, 0, z0 - 0.05, x + w / 2 + 0.05, 0.25, z1 + 0.05, (0.42, 0.42, 0.43), flags=GRAIN),
             box(x - w / 2, 0.25, z0, x + w / 2, h, z1, col, flags=GRAIN | PANELS, obj=obj),
             gable_roof(x - w / 2, x + w / 2, z0, z1, h, 1.25 + 0.2 * rng.random(), roof, over=0.18)]
    # corner boards
    for cx_ in (x - w / 2, x + w / 2 - 0.08):
        for cz_ in (z0 - 0.01, z1 - 0.07):
            parts.append(box(cx_, 0.25, cz_, cx_ + 0.08, h, cz_ + 0.08, TRIM))
    fz = z1 if facing > 0 else z0
    lit = lit or {}
    xs = np.linspace(x - w / 2, x + w / 2, wins + 2)[1:-1]
    for fl in range(floors):
        for ci, wx in enumerate(xs):
            if fl == 0 and door and ci == 0 and wins > 1:
                continue
            parts += window(wx, 0.25 + fl * fh + 0.45, fz, 0.62, 0.78, facing, lit.get((fl, ci)), obj=obj + 1 + fl * 10 + ci)
    if door:
        dx = xs[0] if wins > 1 else x - w / 4
        a, b = sorted((fz, fz + facing * 0.05))
        parts.append(box(dx - 0.32, 0.25, a, dx + 0.32, 1.45, b, (0.36, 0.34, 0.33)))
        parts.append(box(dx - 0.42, 0.18, min(fz, fz + facing * 0.4), dx + 0.42, 0.25, max(fz, fz + facing * 0.4), (0.5, 0.5, 0.5)))
    if chimney:
        cxp = x + w * (0.2 - 0.4 * rng.random())
        parts.append(box(cxp - 0.2, h + 0.4, z - 0.2, cxp + 0.2, h + 1.7, z + 0.2, (0.45, 0.42, 0.40)))
    return merge(parts)


def flat_building(x, z, w, d, h, col=SAND, facing=1, rows=2, cols=4, lit=None, roof=(0.4, 0.4, 0.42),
                  win_w=0.6, win_h=0.75, sign=None, obj=0):
    """Box building with a flat roof and a grid of windows (school, clinic, office...)."""
    z0, z1 = z - d / 2, z + d / 2
    parts = [box(x - w / 2, 0, z0, x + w / 2, h, z1, col, flags=GRAIN, obj=obj),
             box(x - w / 2 - 0.12, h, z0 - 0.12, x + w / 2 + 0.12, h + 0.18, z1 + 0.12, roof)]
    fz = z1 if facing > 0 else z0
    lit = lit or {}
    xs = np.linspace(x - w / 2, x + w / 2, cols + 2)[1:-1]
    ys = np.linspace(0, h, rows + 2)[1:-1]
    for r, wy in enumerate(ys):
        for c, wx in enumerate(xs):
            parts += window(wx, wy - win_h / 2 + 0.1, fz, win_w, win_h, facing, lit.get((r, c)), mullion=False)
    return merge(parts)


def tree(x, z, h=2.4, kind="spruce", col=MOSS, seed=0):
    rng = np.random.default_rng(seed)
    h *= 0.85 + 0.3 * rng.random()
    parts = [cylinder(x, 0, z, 0.09, 0.07, h * 0.3, (0.35, 0.28, 0.22), n=6)]
    c = tuple(np.clip(np.asarray(col) * (0.85 + 0.25 * rng.random()), 0, 1))
    if kind == "spruce":
        for k in range(3):
            y = h * (0.22 + 0.24 * k)
            r = h * (0.32 - 0.08 * k)
            parts.append(cylinder(x, y, z, r, 0.0, h * 0.42, c, n=7, phase=rng.random()))
    else:
        parts.append(sphere(x, h * 0.62, z, h * 0.32, c, nu=7, nv=5, sy=1.1))
    return merge(parts)


def street_lamp(x, z, h=3.6, arm=0.6, side=1, on=True, obj=0):
    parts = [cylinder(x, 0, z, 0.07, 0.05, h, (0.18, 0.19, 0.2), n=6),
             box(x - 0.03, h - 0.06, z - 0.03, x + 0.03, h, z + side * arm, (0.18, 0.19, 0.2)),
             cylinder(x, h - 0.28, z + side * arm, 0.2, 0.08, 0.22, (0.18, 0.19, 0.2), n=8)]
    if on:
        parts.append(cylinder(x, h - 0.3, z + side * arm, 0.13, 0.13, 0.03, (1, 0.9, 0.7),
                              emit=(6.0, 4.6, 2.8), flags=UNLIT | NOSHADOW))
    return merge(parts)


def lamp_light(x, z, h=3.6, arm=0.6, side=1, power=7.0):
    return Light((x, h - 0.45, z + side * arm), (1.0, 0.78, 0.5), 1.6, power)


def window_light(x, y, z, facing=1, col=WARM_LIGHT, power=1.0, spread=(30, 75)):
    """Light spilling out of a lit window onto the street."""
    return Light((x, y, z - facing * 0.3), col, 1.4, power, direction=(0, -0.35, facing), cone=spread, spec=0.8)


# --------------------------------------------------------------------------
# Figures (faceless peg figures)
# --------------------------------------------------------------------------
def figure(x, z, h=0.9, col=FIG, pose="stand", face=0.0, head=None, bob=0.0, cap=None, bag=None, obj=0):
    """Smooth, featureless peg figure. face: heading angle (radians, 0 = +z)."""
    head = col if head is None else head
    parts = []
    y0 = bob
    if pose == "sit":
        seat = 0.42 * h
        parts.append(cylinder(0, seat, 0, 0.17 * h, 0.12 * h, 0.4 * h, col, n=8))
        parts.append(box(-0.13 * h, seat - 0.02, 0, 0.13 * h, seat + 0.12 * h, 0.32 * h, col))
        parts.append(box(-0.12 * h, 0, 0.24 * h, 0.12 * h, seat, 0.34 * h, col))
        hy = seat + 0.4 * h + 0.12 * h
    else:
        parts.append(cylinder(0, y0, 0, 0.2 * h, 0.12 * h, 0.66 * h, col, n=8))
        hy = y0 + 0.66 * h + 0.125 * h
    parts.append(sphere(0, hy, 0, 0.13 * h, head, nu=12, nv=8, stagger=False))
    if cap == "student":
        parts.append(cylinder(0, hy + 0.1 * h, 0, 0.15 * h, 0.15 * h, 0.05 * h, (0.96, 0.96, 0.95), n=10))
        parts.append(cylinder(0, hy + 0.15 * h, 0, 0.16 * h, 0.16 * h, 0.02 * h, (0.08, 0.08, 0.1), n=10))
    elif cap == "police":
        parts.append(cylinder(0, hy + 0.06 * h, 0, 0.16 * h, 0.17 * h, 0.08 * h, (0.12, 0.14, 0.22), n=10))
    if bag == "suitcase":
        parts.append(box(0.2 * h, y0, -0.08 * h, 0.3 * h, y0 + 0.32 * h, 0.14 * h, (0.45, 0.38, 0.32)))
    elif bag == "diploma":
        parts.append(cylinder(0.18 * h, y0 + 0.36 * h, 0.05, 0.025 * h, 0.025 * h, 0.22 * h, (0.96, 0.95, 0.9), n=6))
    m = merge(parts).roty(face).move(x, 0, z)
    m.O[:] = obj
    return m


def figure_grid(x0, z0, nx, nz, sp, h, n_blue, order_seed=3, blue=BLUE_S, base=FIG, blue_amount=1.0):
    """Grid of figures; the first n_blue (in a shuffled order) are tinted Høyre blue."""
    rng = np.random.default_rng(order_seed)
    order = rng.permutation(nx * nz)
    rank = np.empty_like(order)
    rank[order] = np.arange(nx * nz)
    out = []
    for j in range(nz):
        for i in range(nx):
            k = j * nx + i
            amt = np.clip(n_blue - rank[k], 0, 1) * blue_amount
            c = tuple(np.asarray(base) * (1 - amt) + np.asarray(blue) * amt)
            out.append(figure(x0 + i * sp, z0 + j * sp, h, c))
    return merge(out)


# --------------------------------------------------------------------------
# Props
# --------------------------------------------------------------------------
def table(x, z, w=1.2, d=0.8, h=0.75, col=LIGHTWOOD):
    p = [box(x - w / 2, h - 0.05, z - d / 2, x + w / 2, h, z + d / 2, col, flags=GRAIN)]
    for sx in (-1, 1):
        for sz in (-1, 1):
            p.append(box(x + sx * (w / 2 - 0.08) - 0.03, 0, z + sz * (d / 2 - 0.08) - 0.03,
                         x + sx * (w / 2 - 0.08) + 0.03, h - 0.05, z + sz * (d / 2 - 0.08) + 0.03, col))
    return merge(p)


def chair(x, z, face=0.0, col=WOOD):
    p = [box(-0.22, 0.42, -0.22, 0.22, 0.47, 0.22, col, flags=GRAIN),
         box(-0.22, 0.47, -0.24, 0.22, 0.95, -0.2, col, flags=GRAIN)]
    for sx in (-1, 1):
        for sz in (-1, 1):
            p.append(box(sx * 0.18 - 0.025, 0, sz * 0.18 - 0.025, sx * 0.18 + 0.025, 0.42, sz * 0.18 + 0.025, col))
    return merge(p).roty(face).move(x, 0, z)


def phone(x, y, z, glow=0.0, ang=0.0, col=(0.12, 0.12, 0.14), obj=0):
    p = [box(-0.06, 0, -0.11, 0.06, 0.015, 0.11, col),
         box(-0.05, 0.015, -0.1, 0.05, 0.017, 0.1, (0.9, 0.93, 1.0),
             emit=np.array([1.2, 1.35, 1.6]) * glow, flags=UNLIT if glow > 0 else 0, obj=obj)]
    return merge(p).roty(ang).move(x, y, z)


def mug(x, y, z, col=OFFWHITE):
    return cylinder(x, y, z, 0.05, 0.05, 0.1, col, n=8)


def wall_clock(x, y, z, facing=1):
    m = cylinder(0, 0, 0, 0.2, 0.2, 0.04, OFFWHITE, n=12).rotx(math.pi / 2 * facing)
    hands = box(-0.01, 0, 0.03, 0.01, 0.13, 0.045, (0.1, 0.1, 0.1))
    hands2 = box(-0.01, -0.01, 0.03, 0.09, 0.01, 0.045, (0.1, 0.1, 0.1))
    return merge([m, hands, hands2]).move(x, y, z)


def desk_lamp(x, y, z, on=True, ang=0.0):
    p = [cylinder(0, 0, 0, 0.09, 0.09, 0.02, (0.2, 0.2, 0.22), n=8),
         box(-0.015, 0.02, -0.015, 0.015, 0.38, 0.015, (0.2, 0.2, 0.22)),
         cylinder(0.08, 0.3, 0, 0.12, 0.05, 0.12, (0.2, 0.22, 0.25), n=8)]
    if on:
        p.append(cylinder(0.08, 0.295, 0, 0.1, 0.1, 0.01, (1, 0.9, 0.7), emit=(5, 3.8, 2.2), flags=UNLIT | NOSHADOW))
    return merge(p).roty(ang).move(x, y, z)


def bed(x, z, col=(0.42, 0.50, 0.58), face=0.0):
    p = [box(-0.5, 0, -1.0, 0.5, 0.35, 1.0, WOOD, flags=GRAIN),
         box(-0.48, 0.35, -0.98, 0.48, 0.5, 0.98, (0.86, 0.86, 0.84)),
         box(-0.49, 0.42, -0.4, 0.49, 0.56, 0.99, col),
         box(-0.35, 0.5, -0.95, 0.35, 0.62, -0.6, (0.92, 0.92, 0.9)),
         box(-0.5, 0, -1.08, 0.5, 0.8, -1.0, WOOD, flags=GRAIN)]
    return merge(p).roty(face).move(x, 0, z)


def poster(x, y, z, w, h, col, facing=1, obj=0):
    a, b = sorted((z, z + 0.02 * facing))
    return box(x - w / 2, y, a, x + w / 2, y + h, b, col, obj=obj)


def bar(x, z, w, d, h, col, emit=0.0, obj=0, y0=0.0):
    if h <= 0.001:
        return None
    from .mesh import lin_rgb
    e = lin_rgb(col) * emit
    return box(x - w / 2, y0, z - d / 2, x + w / 2, y0 + h, z + d / 2, col, emit=e, obj=obj)


def platform(x, z, r, h, col=(0.36, 0.37, 0.39), n=32):
    return cylinder(x, 0, z, r, r, h, col, n=n)


def plinth(x, z, w=1.1, h=1.2, col=PLINTH, glow=0.0):
    e = np.array([0.5, 0.52, 0.56]) * glow
    return merge([box(x - w / 2, 0, z - w / 2, x + w / 2, h, z + w / 2, col, flags=GRAIN),
                  box(x - w / 2 - 0.06, h, z - w / 2 - 0.06, x + w / 2 + 0.06, h + 0.08, z + w / 2 + 0.06,
                      tuple(np.asarray(col) * 1.05), emit=e)])


# neutral plinth symbols (all grey)
def sym_scale(x, y, z, col=(0.78, 0.78, 0.8)):
    p = [cylinder(x, y, z, 0.03, 0.03, 0.6, col, n=6),
         box(x - 0.36, y + 0.56, z - 0.02, x + 0.36, y + 0.6, z + 0.02, col),
         cylinder(x - 0.32, y + 0.32, z, 0.13, 0.13, 0.03, col, n=10),
         cylinder(x + 0.32, y + 0.32, z, 0.13, 0.13, 0.03, col, n=10),
         box(x - 0.33, y + 0.34, z - 0.005, x - 0.31, y + 0.57, z + 0.005, col),
         box(x + 0.31, y + 0.34, z - 0.005, x + 0.33, y + 0.57, z + 0.005, col),
         cylinder(x, y, z, 0.15, 0.1, 0.05, col, n=10)]
    return merge(p)


def sym_door(x, y, z, col=(0.78, 0.78, 0.8)):
    p = [box(x - 0.3, y, z - 0.04, x - 0.25, y + 0.8, z + 0.04, col),
         box(x + 0.25, y, z - 0.04, x + 0.3, y + 0.8, z + 0.04, col),
         box(x - 0.3, y + 0.8, z - 0.04, x + 0.3, y + 0.85, z + 0.04, col),
         box(-0.25, 0, -0.02, 0.25, 0.78, 0.02, tuple(np.asarray(col) * 0.85)).roty(-0.7, about=(-0.25, 0, 0)).move(x, y, z)]
    return merge(p)


def sym_sign(x, y, z, col=(0.78, 0.78, 0.8)):
    p = [cylinder(x, y, z, 0.025, 0.025, 0.85, col, n=6)]
    for k, s in enumerate((1, -1)):
        yy = y + 0.55 - k * 0.2
        p.append(box(min(x, x + s * 0.4), yy, z - 0.02, max(x, x + s * 0.4), yy + 0.12, z + 0.02, col))
        tip = M.prism([(x + s * 0.4, z - 0.02), (x + s * 0.48, z - 0.02), (x + s * 0.48, z + 0.02), (x + s * 0.4, z + 0.02)],
                      yy, yy + 0.12, col)
        p.append(tip)
    return merge(p)


def sym_house(x, y, z, col=(0.78, 0.78, 0.8)):
    p = [box(x - 0.3, y, z - 0.25, x - 0.26, y + 0.4, z + 0.25, col),
         box(x + 0.26, y, z - 0.25, x + 0.3, y + 0.4, z + 0.25, col),
         box(x - 0.3, y, z - 0.25, x + 0.3, y + 0.4, z - 0.21, col),
         gable_roof(x - 0.32, x + 0.32, z - 0.27, z + 0.27, y + 0.4, 0.28, col, over=0.04, along="z")]
    return merge(p)


# --------------------------------------------------------------------------
# Diorama base and backdrop
# --------------------------------------------------------------------------
def diorama_base(x0, z0, x1, z1, top=0.0, depth=0.6, col=(0.33, 0.27, 0.22)):
    """Thick wooden plinth the whole diorama stands on."""
    return merge([box(x0, top - depth, z0, x1, top - 0.02, z1, col, flags=GRAIN),
                  box(x0 - 0.15, top - depth - 0.12, z0 - 0.15, x1 + 0.15, top - depth, z1 + 0.15,
                      tuple(np.asarray(col) * 0.8), flags=GRAIN)])
