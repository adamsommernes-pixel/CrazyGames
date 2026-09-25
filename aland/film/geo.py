# -*- coding: utf-8 -*-
"""Kartdata (Natural Earth), projektioner och kartrendering."""
import functools
import json
import os
import pickle

import cv2
import numpy as np
from pyproj import Transformer
from shapely.geometry import box, shape

from .common import (ASSETS, BUILD, COAST, H, INK, INK_DIM, LAND, LAND2, SEA,
                     SEA2, W, draw_text, fill_polys, over_color, paper_texture,
                     poly_lines, value_noise)

GEO = os.path.join(ASSETS, "geo")

PROJ = {
    # UTM 34N – samma som Sentinel-2-mosaiken, så karta och satellit linjerar.
    "utm": "EPSG:32634",
    # Europa: konform konisk centrerad över Östersjön.
    "eur": "+proj=lcc +lat_1=45 +lat_2=65 +lat_0=55 +lon_0=15 +datum=WGS84 +units=m",
}


@functools.lru_cache(maxsize=None)
def transformer(pname):
    return Transformer.from_crs("EPSG:4326", PROJ[pname], always_xy=True)


def project(pname, lon, lat):
    x, y = transformer(pname).transform(lon, lat)
    return np.array([x, y])


PLACES = {
    "Mariehamn": (19.9348, 60.0973),
    "Kastelholm": (20.0808, 60.2266),
    "Bomarsund": (20.2358, 60.2117),
    "Jomala": (19.9481, 60.1528),
    "Eckerö": (19.5720, 60.2230),
    "Grisslehamn": (18.8167, 60.1000),
    "Stockholm": (18.0686, 59.3293),
    "Åbo": (22.2666, 60.4518),
    "Helsingfors": (24.9384, 60.1699),
    "S:t Petersburg": (30.3351, 59.9343),
    "Genève": (6.1432, 46.2044),
    "Paris": (2.3522, 48.8566),
    "Birka": (17.545, 59.335),
    "Novgorod": (31.27, 58.52),
    "Vårdö": (20.37, 60.24),
    "Pommern": (19.9296, 60.0985),
    "Kumlinge": (20.78, 60.26),
    "Kökar": (20.91, 59.92),
    "Föglö": (20.42, 60.03),
    "Tallinn": (24.7536, 59.4370),
    "Riga": (24.1052, 56.9496),
    "Köpenhamn": (12.5683, 55.6761),
    "Berlin": (13.405, 52.52),
    "Warszawa": (21.0122, 52.2297),
    "London": (-0.1276, 51.5072),
    "Rom": (12.4964, 41.9028),
    "Kiel": (10.1228, 54.3233),
}


def place(pname, name):
    lon, lat = PLACES[name]
    return project(pname, lon, lat)


# --------------------------------------------------------------------------
# Lager
# --------------------------------------------------------------------------
def _rings(geom):
    out = []
    gs = getattr(geom, "geoms", [geom])
    for g in gs:
        if g.geom_type == "Polygon":
            out.append([np.asarray(g.exterior.coords)] + [np.asarray(r.coords) for r in g.interiors])
        elif g.geom_type in ("LineString",):
            out.append([np.asarray(g.coords)])
        elif g.geom_type in ("MultiLineString", "MultiPolygon", "GeometryCollection"):
            out.extend(_rings(g))
    return out


def load_layer(fname, bbox, pname, filt=None, key=None):
    """Läser geojson, klipper mot bbox (lon/lat), projicerar. Cache i build/."""
    os.makedirs(os.path.join(BUILD, "geocache"), exist_ok=True)
    tag = f"{fname}_{pname}_{'_'.join(str(round(b, 2)) for b in bbox)}_{key or ''}"
    cp = os.path.join(BUILD, "geocache", tag + ".pkl")
    if os.path.exists(cp):
        return pickle.load(open(cp, "rb"))
    d = json.load(open(os.path.join(GEO, fname + ".geojson")))
    clip = box(*bbox)
    tr = transformer(pname)
    feats = []
    for f in d["features"]:
        if filt and not filt(f["properties"]):
            continue
        g = shape(f["geometry"])
        if not g.intersects(clip):
            continue
        g = g.intersection(clip)
        if g.is_empty:
            continue
        rings = []
        for poly in _rings(g):
            pr = []
            for r in poly:
                x, y = tr.transform(r[:, 0], r[:, 1])
                pr.append(np.stack([x, y], 1))
            rings.append(pr)
        feats.append((f["properties"], rings))
    pickle.dump(feats, open(cp, "wb"))
    return feats


class Camera:
    """Kamera i projicerade meter: centrum, meter/pixel, rotation (grader)."""

    def __init__(self, cx, cy, mpp, rot=0.0):
        self.cx, self.cy, self.mpp, self.rot = cx, cy, mpp, rot

    def to_screen(self, xy):
        xy = np.asarray(xy, np.float64)
        dx = (xy[..., 0] - self.cx) / self.mpp
        dy = (xy[..., 1] - self.cy) / self.mpp
        if self.rot:
            c, s = np.cos(np.radians(self.rot)), np.sin(np.radians(self.rot))
            dx, dy = dx * c - dy * s, dx * s + dy * c
        return np.stack([dx + W / 2, -dy + H / 2], -1)

    def affine_from_world(self):
        """2x3-matris world(m)->skärm(px)."""
        c, s = np.cos(np.radians(self.rot)), np.sin(np.radians(self.rot))
        k = 1.0 / self.mpp
        # u = k*(c*(x-cx) - s*(y-cy)) + W/2 ; v = -k*(s*(x-cx) + c*(y-cy)) + H/2
        return np.array([[k * c, -k * s, W / 2 - k * (c * self.cx - s * self.cy)],
                         [-k * s, -k * c, H / 2 + k * (s * self.cx + c * self.cy)]])

    @staticmethod
    def lerp(a, b, x):
        """Log-interpolation av zoom för jämn upplevd fart."""
        mpp = np.exp(np.log(a.mpp) + (np.log(b.mpp) - np.log(a.mpp)) * x)
        # centrum interpoleras i skärmrum för att undvika "sväng"
        cx = a.cx + (b.cx - a.cx) * x
        cy = a.cy + (b.cy - a.cy) * x
        return Camera(cx, cy, mpp, a.rot + (b.rot - a.rot) * x)


def zoom_path(a, b, x):
    """Kamera som zoomar mellan a och b där centrum följer zoom i skärmrum
    (van Wijk-lik, förenklad): centrum rör sig så att målpunkten står stilla
    relativt skärmen när mpp ändras."""
    la, lb = np.log(a.mpp), np.log(b.mpp)
    if abs(lb - la) < 1e-6:
        return Camera.lerp(a, b, x)
    mpp = np.exp(la + (lb - la) * x)
    # andel av centrumförflyttning ~ andel av zoom i 1/mpp-rum
    u = (1 / mpp - 1 / a.mpp) / (1 / b.mpp - 1 / a.mpp)
    cx = a.cx + (b.cx - a.cx) * u
    cy = a.cy + (b.cy - a.cy) * u
    return Camera(cx, cy, mpp, a.rot + (b.rot - a.rot) * x)


# --------------------------------------------------------------------------
# Kartstil
# --------------------------------------------------------------------------
@functools.lru_cache(maxsize=None)
def sea_backdrop():
    img = np.empty((H, W, 3), np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H / 2) / H) ** 2)
    g = np.clip(1 - r * 1.2, 0, 1)[..., None]
    img[:] = SEA
    img += (SEA2 - SEA) * g
    img += paper_texture(5)[..., None] * 0.01
    return img


@functools.lru_cache(maxsize=None)
def land_texture():
    n = value_noise(H, W, 160, 11, 5)
    return ((n - 0.5) * 0.035)[..., None]


class MapLayers:
    def __init__(self, pname, bbox, detail="10m", with_borders=True):
        self.pname = pname
        self.land = load_layer(f"ne_{detail}_land", bbox, pname)
        self.lakes = load_layer(f"ne_{detail}_lakes", bbox, pname,
                                filt=lambda p: (p.get("scalerank") or 0) <= 6, key="sr6")
        self.countries = load_layer(f"ne_{detail}_admin_0_countries", bbox, pname)
        self.borders = load_layer(f"ne_{detail}_admin_0_boundary_lines_land", bbox, pname) if with_borders else []

    def country(self, *codes):
        polys = []
        for props, rings in self.countries:
            if props.get("ADM0_A3") in codes:
                polys.extend(rings)
        return polys


def flat(feats):
    return [poly for _, polys in feats for poly in polys]


def _screen_polys(cam, polys, holes=True):
    out = []
    for rings in polys:
        for i, r in enumerate(rings):
            if i > 0 and not holes:
                break
            out.append(cam.to_screen(r))
    return out


def _cull(cam, polys, margin=200):
    """Släng polygoner helt utanför bild (grov bbox)."""
    out = []
    for rings in polys:
        r = rings[0]
        s = cam.to_screen(r)
        if (s[:, 0].max() < -margin or s[:, 0].min() > W + margin or
                s[:, 1].max() < -margin or s[:, 1].min() > H + margin):
            continue
        # minimera antalet punkter när de blir subpixel
        out.append(rings)
    return out


def polys_mask(cam, polys):
    m = np.zeros((H, W), np.float32)
    pts = []
    for rings in _cull(cam, polys):
        s = [cam.to_screen(r) for r in rings]
        pts.extend(s)
    if pts:
        # jämn-udda fyllning hanterar hål
        arrs = [np.round(p * 16).astype(np.int32) for p in pts if len(p) >= 3]
        cv2.fillPoly(m, arrs, 1.0, cv2.LINE_AA, 4)
    return m


def polys_outline(cam, polys, thickness=1):
    m = np.zeros((H, W), np.float32)
    pts = []
    for rings in _cull(cam, polys):
        pts.extend(cam.to_screen(r) for r in rings)
    poly_lines(m, pts, thickness, closed=False)
    return m


def render_map(cam, layers, land_alpha=1.0, coast_alpha=0.55, border_alpha=0.5,
               land_color=LAND, base=None, water_lines=True):
    img = sea_backdrop().copy() if base is None else base
    lm = polys_mask(cam, flat(layers.land))
    lk = polys_mask(cam, flat(layers.lakes)) if layers.lakes else None
    if lk is not None:
        lm = np.clip(lm - lk, 0, 1)
    land_rgb = np.asarray(land_color, np.float32)[None, None, :] + land_texture()
    img += (land_rgb - img) * (lm * land_alpha)[..., None]
    if water_lines:
        # kustnära ljusare vatten ("water lining")
        k = cv2.GaussianBlur(lm, (0, 0), 7)
        halo = np.clip(k - lm, 0, 1) * 0.16
        img += halo[..., None] * np.array([0.35, 0.5, 0.55], np.float32)
    if coast_alpha > 0:
        cm = polys_outline(cam, flat(layers.land))
        over_color(img, COAST, cm * coast_alpha * land_alpha)
    if border_alpha > 0 and layers.borders:
        bm = np.zeros((H, W), np.float32)
        from .common import dashed
        for poly in flat(layers.borders):
            for r in poly:
                s = cam.to_screen(r)
                poly_lines(bm, dashed(s, 5, 4), 1)
        over_color(img, INK_DIM, bm * border_alpha * land_alpha)
    return img, lm


def label(img, cam, xy, text, style="country", alpha=1.0, dx=0, dy=0, anchor="c", color=None):
    p = cam.to_screen(np.asarray(xy))
    x, y = p[0] + dx, p[1] + dy
    if style == "country":
        draw_text(img, text.upper(), x, y, name="sans_m", size=22, tracking=0.42,
                  color=INK if color is None else color, alpha=alpha * 0.8, anchor=anchor)
    elif style == "sea":
        draw_text(img, text, x, y, name="serif_it", size=30, tracking=0.12, weight=400,
                  color=np.array([0.55, 0.66, 0.72], np.float32) if color is None else color,
                  alpha=alpha * 0.75, anchor=anchor)
    elif style == "city":
        draw_text(img, text, x, y, name="sans", size=24, tracking=0.04,
                  color=INK if color is None else color, alpha=alpha * 0.92, anchor=anchor)
    elif style == "big":
        draw_text(img, text.upper(), x, y, name="sans_m", size=30, tracking=0.5,
                  color=INK if color is None else color, alpha=alpha * 0.9, anchor=anchor)
    return x, y
