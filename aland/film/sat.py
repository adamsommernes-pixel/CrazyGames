# -*- coding: utf-8 -*-
"""Sentinel-2-mosaik (UTM 34N, 10 m): pyramid, färgbehandling, kamerarendering."""
import functools
import os

import cv2
import numpy as np

from .common import ASSETS, BUILD, H, W

S2 = os.path.join(ASSETS, "s2")
PYR = os.path.join(BUILD, "s2pyr")
X0, Y0, X1, Y1 = [int(v) for v in np.load(os.path.join(S2, "mosaic_meta.npy"))]
RES = [10, 20, 40, 80, 160, 320]

# L1C TCI har blått dis; ta bort offset och sträck ut.
HAZE = np.array([16.0, 29.0, 46.0])
GAIN = np.array([2.75, 2.55, 2.6])


def _lut():
    v = np.arange(256, dtype=np.float64)
    luts = []
    for c in range(3):
        x = np.clip((v - HAZE[c]) * GAIN[c] / 255.0, 0, 1)
        x = x ** 0.92
        # mjuk axel i högdagrar
        x = x / (1 + 0.35 * x) * 1.35
        luts.append(np.clip(x * 255, 0, 255).astype(np.uint8))
    return luts


def build_pyramid():
    os.makedirs(PYR, exist_ok=True)
    src = np.load(os.path.join(S2, "mosaic_tci.npy"), mmap_mode="r")
    nir = np.load(os.path.join(S2, "mosaic_nir.npy"), mmap_mode="r")
    luts = _lut()
    Hs, Ws = src.shape[:2]
    lvl0 = np.lib.format.open_memmap(os.path.join(PYR, "tci_0.npy"), mode="w+", dtype=np.uint8, shape=src.shape)
    step = 2048
    for y in range(0, Hs, step):
        blk = np.asarray(src[y:y + step])
        out = np.empty_like(blk)
        for c in range(3):
            out[..., c] = luts[c][blk[..., c]]
        # ingen data -> mörkt hav
        nod = blk.max(axis=2) == 0
        out[nod] = (7, 12, 18)
        lvl0[y:y + step] = out
    lvl0.flush()
    prev = lvl0
    for i in range(1, len(RES)):
        h, w = prev.shape[0] // 2, prev.shape[1] // 2
        cur = cv2.resize(np.asarray(prev), (w, h), interpolation=cv2.INTER_AREA)
        np.save(os.path.join(PYR, f"tci_{i}.npy"), cur)
        prev = cur
    # landmask (NIR > tröskel), mjukad
    m = (np.asarray(nir) > 750).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    np.save(os.path.join(PYR, "land_0.npy"), m)
    prev = m
    for i in range(1, len(RES)):
        cur = cv2.resize(prev, (prev.shape[1] // 2, prev.shape[0] // 2), interpolation=cv2.INTER_AREA)
        np.save(os.path.join(PYR, f"land_{i}.npy"), cur)
        prev = cur
    # "höjd"-proxy: avstånd till kusten inom land (för landhöjningsanimationen), 40 m-nivå
    lm = np.load(os.path.join(PYR, "land_2.npy"))
    b = (lm > 127).astype(np.uint8)
    dist = cv2.distanceTransform(b, cv2.DIST_L2, 5).astype(np.float32)
    # lägg till brus så öarna inte växer som perfekta konturer
    rng = np.random.default_rng(4)
    n = rng.random((dist.shape[0] // 64 + 2, dist.shape[1] // 64 + 2)).astype(np.float32)
    n = cv2.resize(n, (dist.shape[1], dist.shape[0]), interpolation=cv2.INTER_CUBIC)
    elev = dist * (0.65 + 0.7 * n)
    elev = cv2.GaussianBlur(elev, (0, 0), 1.5)
    np.save(os.path.join(PYR, "elev_2.npy"), elev.astype(np.float32))
    print("pyramid built")


@functools.lru_cache(maxsize=None)
def level(i, kind="tci"):
    return np.load(os.path.join(PYR, f"{kind}_{i}.npy"), mmap_mode="r")


def world_to_px(x, y, lvl=0):
    r = RES[lvl]
    return (x - X0) / r - 0.5, (Y1 - y) / r - 0.5


def render(cam, kind="tci", interp=cv2.INTER_LINEAR, lvl_bias=0.0, out_shape=(H, W)):
    """Returnerar float32-bild (H,W,3) eller (H,W) för mask."""
    mpp = cam.mpp
    li = 0
    for i, r in enumerate(RES):
        if r <= mpp * (1.0 + lvl_bias) + 1e-6:
            li = i
    if kind == "elev":
        li = 2
    src = level(li, kind)
    r = RES[li]
    A = cam.affine_from_world()
    P = np.array([[r, 0, X0 + 0.5 * r], [0, -r, Y1 - 0.5 * r], [0, 0, 1.0]])
    M = A @ P  # level-px -> skärm
    Mi = cv2.invertAffineTransform(M)
    hh, ww = out_shape
    corners = np.array([[0, 0, 1], [ww, 0, 1], [0, hh, 1], [ww, hh, 1]], np.float64).T
    pc = Mi @ corners
    c0 = int(max(0, np.floor(pc[0].min()) - 3))
    c1 = int(min(src.shape[1], np.ceil(pc[0].max()) + 3))
    r0 = int(max(0, np.floor(pc[1].min()) - 3))
    r1 = int(min(src.shape[0], np.ceil(pc[1].max()) + 3))
    chans = 1 if src.ndim == 2 else 3
    if c1 <= c0 or r1 <= r0:
        return np.zeros((hh, ww, 3) if chans == 3 else (hh, ww), np.float32)
    crop = np.ascontiguousarray(src[r0:r1, c0:c1])
    T = np.array([[1, 0, c0], [0, 1, r0], [0, 0, 1.0]])
    M2 = (np.vstack([M, [0, 0, 1]]) @ T)[:2]
    if kind == "elev":
        out = cv2.warpAffine(crop, M2, (ww, hh), flags=interp, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
        return out
    border = (7, 12, 18) if chans == 3 else 0
    out = cv2.warpAffine(crop, M2, (ww, hh), flags=interp, borderMode=cv2.BORDER_CONSTANT, borderValue=border)
    return out.astype(np.float32) / 255.0


def look(img, sat=0.85, gamma=1.0, gain=1.0, tint=(1.0, 1.0, 1.0)):
    """Mörk dokumentär ton för satellitbild."""
    luma = img @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    x = luma[..., None] + (img - luma[..., None]) * sat
    if gamma != 1.0:
        x = np.clip(x, 0, None) ** gamma
    return x * gain * np.asarray(tint, np.float32)


if __name__ == "__main__":
    build_pyramid()
