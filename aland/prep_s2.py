"""Bygger en mosaik av Sentinel-2 TCI-rutor (UTM 34N, 10 m) + landmask från B08."""
import os, re, numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets/s2")
tiles = ["DM", "EM", "DN", "EN"]
ul = {}
for t in tiles:
    x = open(f"{D}/T34V{t}_MTD_TL.xml").read()
    ul[t] = (int(re.search(r"<ULX>(\d+)", x).group(1)), int(re.search(r"<ULY>(\d+)", x).group(1)))
print(ul)
# mosaic bounds (UTM meters)
X0 = 399960; X1 = max(v[0] for v in ul.values()) + 109800
Y1 = max(v[1] for v in ul.values()); Y0 = min(v[1] for v in ul.values()) - 109800
W = (X1 - X0) // 10; H = (Y1 - Y0) // 10
print("mosaic", W, H, (X0, Y0, X1, Y1))
mos = np.lib.format.open_memmap(f"{D}/mosaic_tci.npy", mode="w+", dtype=np.uint8, shape=(H, W, 3))
# paint N tiles first then M tiles on top (M row = Åland core)
for t in ["EN", "DN", "EM", "DM"]:
    im = np.asarray(Image.open(f"{D}/T34V{t}_TCI.jp2").convert("RGB"))
    ox = (ul[t][0] - X0) // 10; oy = (Y1 - ul[t][1]) // 10
    valid = im.max(axis=2) > 0
    sub = mos[oy:oy + im.shape[0], ox:ox + im.shape[1]]
    sub[valid] = im[valid]
    print("placed", t, ox, oy, valid.mean())
mos.flush()
np.save(f"{D}/mosaic_meta.npy", np.array([X0, Y0, X1, Y1]))
# small preview
prev = Image.fromarray(np.asarray(mos[::20, ::20]))
prev.save(f"{D}/preview.jpg", quality=85)
# NIR land mask for DM+EM
nir = np.zeros((H, W), np.uint16)
for t in ["EM", "DM"]:
    im = np.asarray(Image.open(f"{D}/T34V{t}_B08.jp2"))
    ox = (ul[t][0] - X0) // 10; oy = (Y1 - ul[t][1]) // 10
    sub = nir[oy:oy + im.shape[0], ox:ox + im.shape[1]]
    m = im > 0
    sub[m] = im[m]
np.save(f"{D}/mosaic_nir.npy", nir)
Image.fromarray((np.clip(nir[::20, ::20] / 4000.0, 0, 1) * 255).astype(np.uint8)).save(f"{D}/preview_nir.jpg")
print("done")
