# -*- coding: utf-8 -*-
"""HDR -> display: bloom, depth of field, tone map, gentle grade, vignette, grain."""
import numpy as np

from .common import grain_bank, vignette_mask
from .raster import bloom, dof


def aces(x):
    x = np.maximum(x, 0)
    return np.clip((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0, 1)


def finish(hdr, z, fi, focus=None, aperture=0.9, tilt=None, bloom_amt=0.35, thr=0.9,
           exposure=1.0, vign=0.42, grain=0.016, warm=0.0):
    img = bloom(hdr * exposure, thr, bloom_amt)
    if focus is not None:
        img = dof(img, z, focus, aperture, tilt=tilt)
    x = aces(img) ** (1 / 2.2)
    luma = (x[..., 0] * 0.2126 + x[..., 1] * 0.7152 + x[..., 2] * 0.0722)[..., None]
    # cool shadows, slightly warm highlights (warm > 0 pushes the whole image warmer)
    x = x + (1 - luma) ** 2 * np.array([-0.008, 0.002, 0.014], np.float32) \
          + luma ** 2 * np.array([0.012 + warm, 0.005 + warm * 0.4, -0.012 - warm], np.float32)
    x = x * vignette_mask(vign)
    if grain > 0:
        g = grain_bank()[fi % len(grain_bank())]
        g = np.roll(g, ((fi * 53) % 64, (fi * 37) % 64), axis=(0, 1))
        x = x + g[..., None] * grain * (0.25 + 1.2 * luma * (1 - luma) * 2.5)
    return np.clip(x, 0, 1).astype(np.float32)
