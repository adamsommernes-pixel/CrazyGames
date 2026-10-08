# -*- coding: utf-8 -*-
"""The town: one diorama that holds the street with the three windows, the harbour,
the station, the school, the clinic, the municipal offices and the police house.
Most shots are camera moves inside this one set (the biggest time saver)."""
import functools
import math

import numpy as np

from . import kit as K
from . import mesh as M
from .mesh import GRAIN, NOSHADOW, UNLIT, WET, box, cylinder, merge
from .raster import Env, Light

# --------------------------------------------------------------------------
# Street layout
# --------------------------------------------------------------------------
HOUSE_X = [-12.6, -8.8, -4.2, -0.4, 3.4, 7.2, 11.0]       # alley between 2nd and 3rd house
HOUSE_COL = [K.OFFWHITE, K.OCHRE, K.OFFWHITE, K.SAND, (0.66, 0.70, 0.66), K.OFFWHITE, K.OCHRE]
HOUSE_Z = -2.4
FRONT_Z = HOUSE_Z + 1.8          # front wall plane
# the three windows: (house index, floor, column)
WIN = {1: (1, 0, 1), 2: (3, 1, 0), 3: (5, 1, 1)}
WIN_W = {1: K.WARM_LIGHT * 1.0, 2: K.WARM_LIGHT * 0.9, 3: K.COOL_LIGHT * 1.1}
FH = 1.35


def win_center(k):
    """World centre of window k (1..3) on the street facade."""
    hi, fl, ci = WIN[k]
    x = HOUSE_X[hi]
    xs = np.linspace(x - 1.7, x + 1.7, 4)[1:-1]
    return np.array([xs[ci], 0.25 + fl * FH + 0.45 + 0.39, FRONT_Z])


ALLEY_X = (HOUSE_X[1] + HOUSE_X[2]) / 2

# other places in town
HARBOUR_X = 24.0
STATION = np.array([-30.0, 0.0, -4.0])
SCHOOL = np.array([-16.0, 0.0, -15.0])
OFFICE = np.array([-6.5, 0.0, -10.5])        # kommunens rustjeneste
CLINIC = np.array([2.5, 0.0, -13.0])
TOWNHALL = np.array([-4.0, 0.0, -20.5])
WORKPLACE = np.array([7.0, 0.0, -22.0])
HOME = np.array([13.8, 0.0, -23.5])
POLICE = np.array([13.5, 0.0, -12.0])
COURT = np.array([19.0, 0.0, -19.0])
CUSTOMS = np.array([21.0, 0.0, 6.0])
FIELD = np.array([-20.0, 0.0, 12.0])


def _street(lit_windows=True, day=False):
    parts = []
    for i, (x, col) in enumerate(zip(HOUSE_X, HOUSE_COL)):
        lit = {}
        if lit_windows:
            for k, (hi, fl, ci) in WIN.items():
                if hi == i:
                    lit[(fl, ci)] = WIN_W[k] * (0.35 if day else 1.0)
        parts.append(K.house(x, HOUSE_Z, 3.4, 3.6, 2, col, K.SLATE, 1, lit, seed=i, obj=100 + i * 100))
    # road, pavements, kerbs
    parts.append(M.ground(-40, 0.0, 40, 3.2, 0.0, K.ASPHALT, 40, 4, flags=WET | GRAIN))
    parts.append(box(-40, 0.0, FRONT_Z, 40, 0.1, 0.0, K.CURB, flags=GRAIN))
    parts.append(box(-40, 0.0, 3.2, 40, 0.1, 4.4, K.CURB, flags=GRAIN))
    # dashed centre line
    for x in np.arange(-38, 38, 2.0):
        parts.append(box(x, 0.0, 1.55, x + 1.0, 0.012, 1.65, (0.75, 0.74, 0.70), flags=NOSHADOW))
    # back gardens and the strip across the road
    parts.append(M.ground(-40, -30, 40, FRONT_Z, 0.0, K.GRASS, 20, 10, flags=GRAIN))
    parts.append(M.ground(-40, 4.4, 40, 20, 0.0, K.GRASS, 20, 6, flags=GRAIN))
    # alley path between house 2 and 3
    parts.append(box(ALLEY_X - 0.55, 0.0, -9.0, ALLEY_X + 0.55, 0.03, FRONT_Z, (0.6, 0.58, 0.55), flags=GRAIN))
    # fence + hedges across the road
    for x in np.arange(-24, 24, 0.5):
        parts.append(box(x, 0.0, 5.2, x + 0.08, 0.7, 5.28, (0.86, 0.85, 0.82)))
    parts.append(box(-24, 0.45, 5.18, 24, 0.52, 5.3, (0.86, 0.85, 0.82)))
    for i, x in enumerate((-17, -11.5, 9.0, 15.5)):
        parts.append(K.tree(x, 7.5 + (i % 2) * 1.5, 2.8, "round" if i % 2 else "spruce", seed=i))
    parts.append(K.street_lamp(-6.4, 3.8, side=-1))
    parts.append(K.street_lamp(5.2, 3.8, side=-1))
    return merge(parts)


def street_lights(power=1.0, windows=(1, 2, 3), lamps=True):
    L = []
    if lamps:
        L += [K.lamp_light(-6.4, 3.8, side=-1, power=6.0 * power), K.lamp_light(5.2, 3.8, side=-1, power=6.0 * power)]
    for k in windows:
        c = win_center(k)
        L.append(K.window_light(c[0], c[1], c[2] + 0.2, 1, WIN_W[k], 1.6 * power))
    return L


# --------------------------------------------------------------------------
# Rest of town
# --------------------------------------------------------------------------
def _harbour():
    parts = [box(HARBOUR_X - 6, -0.6, -30, HARBOUR_X + 0.0, 0.05, 20, (0.50, 0.49, 0.47), flags=GRAIN),
             M.ground(HARBOUR_X, -30, 46, 20, -0.35, K.WATER, 12, 25, flags=WET, jitter=0.03, seed=4)]
    # cranes
    for z in (-6.0, 2.0):
        x = HARBOUR_X - 1.5
        c = (0.70, 0.58, 0.36)
        for dx in (-0.6, 0.6):
            for dz in (-0.6, 0.6):
                parts.append(box(x + dx - 0.08, 0.05, z + dz - 0.08, x + dx + 0.08, 5.2, z + dz + 0.08, c))
        parts.append(box(x - 0.8, 5.2, z - 0.8, x + 0.8, 6.0, z + 0.8, c))
        parts.append(box(x - 2.5, 6.0, z - 0.2, x + 7.5, 6.35, z + 0.2, c))
        parts.append(box(x + 0.2, 6.0, z - 0.5, x + 1.2, 6.8, z + 0.5, (0.45, 0.45, 0.47)))
        parts.append(box(x + 5.8, 3.6, z - 0.02, x + 5.84, 6.0, z + 0.02, (0.15, 0.15, 0.15)))
    # container stacks on the quay
    cols = [(0.45, 0.52, 0.56), (0.62, 0.55, 0.45), (0.50, 0.56, 0.48), (0.58, 0.58, 0.60), (0.52, 0.46, 0.44)]
    rng = np.random.default_rng(2)
    for i in range(6):
        for j in range(3):
            for k in range(rng.integers(1, 4)):
                x = HARBOUR_X - 5.2 + j * 1.0
                z = -16 + i * 2.6
                parts.append(box(x, 0.05 + k * 0.9, z, x + 0.9, 0.05 + (k + 1) * 0.9 - 0.04, z + 2.4,
                                 cols[rng.integers(len(cols))], flags=GRAIN))
    # container ship
    sx, sz = HARBOUR_X + 6.0, -2.0
    hull = M.prism([(sx - 1.8, sz - 9), (sx + 1.8, sz - 9), (sx + 1.8, sz + 7), (sx, sz + 9.5), (sx - 1.8, sz + 7)],
                   -0.6, 1.2, (0.24, 0.27, 0.30))
    parts.append(hull)
    parts.append(box(sx - 1.6, 1.2, sz - 8.5, sx + 1.6, 3.4, sz - 6.0, (0.85, 0.85, 0.83)))
    parts.append(box(sx - 1.0, 3.4, sz - 8.0, sx + 1.0, 3.9, sz - 6.5, (0.85, 0.85, 0.83)))
    for i in range(5):
        for j in range(3):
            for k in range(2):
                x = sx - 1.5 + j * 1.0
                z = sz - 5.5 + i * 2.5
                parts.append(box(x, 1.2 + k * 0.9, z, x + 0.95, 1.2 + (k + 1) * 0.9 - 0.04, z + 2.4,
                                 cols[(i * 3 + j + k) % len(cols)], flags=GRAIN, obj=900 if (i, j, k) == (2, 1, 1) else 0))
    # bollards
    for z in np.arange(-24, 18, 3.0):
        parts.append(cylinder(HARBOUR_X - 0.3, 0.05, z, 0.12, 0.1, 0.3, (0.2, 0.2, 0.22), n=6))
    # customs booth
    parts.append(K.flat_building(CUSTOMS[0], CUSTOMS[2], 2.4, 2.0, 2.0, (0.80, 0.80, 0.78), 1, 1, 2, obj=950))
    parts.append(K.street_lamp(HARBOUR_X - 0.8, -10, side=1))
    parts.append(K.street_lamp(HARBOUR_X - 0.8, 10, side=1))
    return merge(parts)


def _station():
    x, z = STATION[0], STATION[2]
    parts = []
    for dx in (-2.5, -0.8):
        for r in (-0.35, 0.35):
            parts.append(box(x + dx + r - 0.05, 0.0, -30, x + dx + r + 0.05, 0.12, 20, (0.45, 0.45, 0.47)))
        for zz in np.arange(-30, 20, 0.7):
            parts.append(box(x + dx - 0.6, 0.0, zz, x + dx + 0.6, 0.06, zz + 0.25, (0.38, 0.32, 0.27)))
    parts.append(box(x + 0.4, 0.0, z - 10, x + 2.4, 0.4, z + 10, K.CURB, flags=GRAIN))
    parts.append(K.house(x + 5.0, z, 4.8, 3.6, 1, (0.72, 0.42, 0.33), K.SLATE, -1, {(0, 0): K.WARM_LIGHT, (0, 1): K.WARM_LIGHT},
                         wins=3, chimney=True, seed=11).roty(-math.pi / 2, about=(x + 5.0, 0, z)))
    # platform canopy
    for zz in (z - 6, z, z + 6):
        parts.append(box(x + 1.3, 0.4, zz - 0.05, x + 1.4, 2.6, zz + 0.05, (0.3, 0.3, 0.32)))
    parts.append(box(x + 0.5, 2.6, z - 7, x + 2.4, 2.75, z + 7, (0.40, 0.42, 0.45)))
    return merge(parts)


def _civic(lit=True):
    parts = []
    w = {(0, 0): K.WARM_LIGHT * 0.6, (1, 2): K.WARM_LIGHT * 0.5} if lit else {}
    parts.append(K.flat_building(SCHOOL[0], SCHOOL[2], 9.0, 5.0, 3.6, (0.80, 0.70, 0.55), 1, 2, 6, w, obj=1200))
    parts.append(box(SCHOOL[0] - 6, 0.0, SCHOOL[2] + 2.5, SCHOOL[0] + 6, 0.03, SCHOOL[2] + 10, (0.55, 0.54, 0.52), flags=GRAIN))
    parts.append(K.flat_building(OFFICE[0], OFFICE[2], 4.0, 3.0, 2.6, (0.72, 0.74, 0.72), 1, 1, 3, {(0, 1): K.WARM_LIGHT * 0.5}, obj=1300))
    parts.append(K.flat_building(CLINIC[0], CLINIC[2], 6.0, 3.6, 2.8, K.LIGHTWOOD, 1, 1, 4, {(0, 0): K.WARM_LIGHT * 0.5, (0, 3): K.WARM_LIGHT * 0.5}, obj=1400))
    parts.append(K.flat_building(TOWNHALL[0], TOWNHALL[2], 7.0, 4.0, 4.2, (0.84, 0.82, 0.76), 1, 2, 5, w, obj=1500))
    parts.append(K.flat_building(WORKPLACE[0], WORKPLACE[2], 8.0, 4.0, 3.2, (0.70, 0.72, 0.74), 1, 2, 6, w, obj=1600))
    parts.append(K.house(HOME[0], HOME[2], 3.2, 3.2, 2, K.OCHRE, K.SLATE, 1, {}, seed=21))
    # streets behind the main street
    parts.append(box(-30, 0.0, -17.6, 30, 0.02, -16.6, K.ASPHALT, flags=GRAIN))
    parts.append(box(-1.2, 0.0, -28, -0.2, 0.02, -2, K.ASPHALT, flags=GRAIN))
    # more houses and trees for density
    rng = np.random.default_rng(9)
    keep_out = [(c[0] - 5.5, c[2] - 4.0, c[0] + 5.5, c[2] + 5.0) for c in
                (SCHOOL, OFFICE, CLINIC, TOWNHALL, WORKPLACE, HOME, POLICE, COURT, STATION, FIELD, CUSTOMS)]
    keep_out += [(-40, -1.0, 40, 6.0), (-34, -30, -24, 20), (17, -30, 46, 20)]

    def free(x, z, pad=0.0):
        return not any(a - pad < x < c + pad and b - pad < z < d + pad for a, b, c, d in keep_out)

    for i, (x, z) in enumerate([(-24, -11), (-21, -24), (-9, -27), (13, -26), (25, -26), (17, -5), (-20, -4),
                                (-24, 4.0), (-30, 14), (16, 15)]):
        if not free(x, z):
            continue
        parts.append(K.house(x, z, 3.0, 3.0, 1 + (i % 2), HOUSE_COL[i % 7],
                             K.SLATE, 1, {}, seed=30 + i))
    for i in range(36):
        x, z = rng.uniform(-36, 20), rng.uniform(-29, 18)
        if not free(x, z, 1.0) or (-16 < x < 15 and -8 < z < 5) or (z > 4 and -14 < x < 14):
            continue
        parts.append(K.tree(x, z, 2.4, "spruce" if i % 3 else "round", seed=100 + i))
    return merge(parts)


def _field(lit=True):
    x, z = FIELD[0], FIELD[2]
    parts = [box(x - 5, 0.0, z - 3.5, x + 5, 0.03, z + 3.5, (0.38, 0.50, 0.36), flags=GRAIN)]
    c = (0.9, 0.9, 0.88)
    for a, b, cc, d in ((x - 4.6, x + 4.6, z - 3.1, z - 3.0), (x - 4.6, x + 4.6, z + 3.0, z + 3.1),
                        (x - 0.05, x + 0.05, z - 3.1, z + 3.1)):
        parts.append(box(a, 0.03, cc, b, 0.04, d, c, flags=NOSHADOW))
    for s in (-1, 1):
        parts.append(box(x + s * 4.6 - 0.05, 0.03, z - 3.1, x + s * 4.6 + 0.05, 0.04, z + 3.1, c, flags=NOSHADOW))
        gx = x + s * 4.4
        parts.append(box(gx - 0.04, 0.0, z - 0.8, gx + 0.04, 0.6, z - 0.72, c))
        parts.append(box(gx - 0.04, 0.0, z + 0.72, gx + 0.04, 0.6, z + 0.8, c))
        parts.append(box(gx - 0.04, 0.56, z - 0.8, gx + 0.04, 0.64, z + 0.8, c))
    for sx in (-1, 1):
        for sz in (-1, 1):
            px_, pz_ = x + sx * 5.4, z + sz * 3.9
            parts.append(cylinder(px_, 0, pz_, 0.07, 0.05, 4.2, (0.3, 0.3, 0.32), n=6))
            parts.append(box(px_ - 0.3, 4.1, pz_ - 0.1, px_ + 0.3, 4.4, pz_ + 0.1, (0.9, 0.9, 0.9),
                             emit=(5, 5, 4.6) if lit else (0, 0, 0), flags=UNLIT if lit else 0))
    return merge(parts)


def field_lights(power=1.0):
    x, z = FIELD[0], FIELD[2]
    return [Light((x + sx * 5.0, 4.0, z + sz * 3.5), (1, 1, 0.95), 4.0, 3.5 * power,
                  direction=(-sx * 0.6, -1, -sz * 0.6), cone=(40, 75))
            for sx in (-1, 1) for sz in (-1, 1)]


def police_court(blue=0.0, lit=True):
    """Police house and courthouse; blue > 0 lights their windows in Høyre blue (S29)."""
    w = {(0, 0): K.WARM_LIGHT * 0.6, (1, 2): K.WARM_LIGHT * 0.5} if lit else {}
    if blue > 0:
        b = K.blue_emit(2.2 * blue)
        w = {(r, c): b for r in range(2) for c in range(4)}
    parts = [K.flat_building(POLICE[0], POLICE[2], 6.0, 4.0, 3.4, (0.62, 0.66, 0.70), 1, 2, 4, w, obj=1700)]
    wc = {(r, c): K.blue_emit(2.2 * blue) for r in range(2) for c in range(3)} if blue > 0 else {}
    parts.append(K.flat_building(COURT[0], COURT[2], 6.0, 4.0, 3.8, (0.85, 0.84, 0.80), 1, 2, 3, wc, obj=1800))
    for dx in np.linspace(-2.2, 2.2, 5):
        parts.append(cylinder(COURT[0] + dx, 0, COURT[2] + 2.6, 0.18, 0.16, 3.2, (0.9, 0.9, 0.88), n=8))
    parts.append(box(COURT[0] - 2.8, 3.2, COURT[2] + 2.0, COURT[0] + 2.8, 3.5, COURT[2] + 3.0, (0.9, 0.9, 0.88)))
    parts.append(M.gable_roof(COURT[0] - 2.8, COURT[0] + 2.8, COURT[2] + 2.0, COURT[2] + 3.0, 3.5, 0.5, (0.9, 0.9, 0.88), over=0.05))
    return merge(parts)


@functools.lru_cache(maxsize=8)
def town(lit=True, day=False, with_street=True, police=True):
    parts = [_harbour(), _station(), _civic(lit and not day), _field(lit and not day),
             K.diorama_base(-40, -30, 46, 20)]
    if police:
        parts.append(police_court(0.0, lit and not day))
    if with_street:
        parts.append(_street(lit and not day, day))
    return parts


@functools.lru_cache(maxsize=4)
def street_only(lit=True, day=False):
    return [_street(lit, day), K.diorama_base(-40, -30, 46, 20)]


# --------------------------------------------------------------------------
# Lighting moods
# --------------------------------------------------------------------------
def night_env(lights=None, fog=0.012, exposure=1.0):
    return Env(sky=(0.075, 0.095, 0.15), gnd=(0.02, 0.02, 0.025), sun=(-0.45, 0.75, 0.5),
               sun_col=(0.07, 0.09, 0.15), bg_top=(0.035, 0.045, 0.075), bg_bot=(0.012, 0.014, 0.02),
               fog=(0.03, 0.04, 0.06), fog_density=fog, fog_start=8.0,
               lights=street_lights() if lights is None else lights, exposure=exposure, shadow_res=3072)


def dawn_env(u, lights=None):
    """u: 0 = blue hour, 1 = warm morning."""
    def mixc(a, b):
        return tuple(np.asarray(a) * (1 - u) + np.asarray(b) * u)
    return Env(sky=mixc((0.10, 0.13, 0.20), (0.42, 0.44, 0.48)), gnd=mixc((0.03, 0.03, 0.04), (0.12, 0.10, 0.08)),
               sun=(0.8 - 0.3 * u, 0.25 + 0.35 * u, 0.45), sun_col=mixc((0.15, 0.12, 0.14), (1.6, 1.25, 0.9)),
               bg_top=mixc((0.06, 0.08, 0.14), (0.40, 0.46, 0.55)), bg_bot=mixc((0.10, 0.08, 0.10), (0.62, 0.56, 0.48)),
               fog=mixc((0.10, 0.10, 0.14), (0.62, 0.60, 0.56)), fog_density=0.0025, fog_start=30,
               lights=lights or [], exposure=1.0, shadow_res=3072)


def day_env(lights=()):
    return Env(sky=(0.45, 0.48, 0.54), gnd=(0.13, 0.11, 0.09), sun=(0.55, 0.65, 0.55), sun_col=(1.55, 1.35, 1.05),
               bg_top=(0.50, 0.56, 0.64), bg_bot=(0.70, 0.66, 0.58), fog=(0.66, 0.67, 0.68), fog_density=0.003,
               fog_start=30, lights=list(lights), shadow_res=3072)
