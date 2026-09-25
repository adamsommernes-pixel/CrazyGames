# -*- coding: utf-8 -*-
"""Renderar filmen.

  python3 render.py stills t1 t2 ...         -> build/stills/*.jpg
  python3 render.py sheet [n]                 -> kontaktkarta över alla tagningar
  python3 render.py video [--jobs 4] [--from s --to s] [--out fil.mp4]
"""
import argparse
import os
import subprocess
import sys
import time
from multiprocessing import Process

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from film.common import BUILD, FPS, H, W, grade, to_u8  # noqa: E402


def frame(t, fi):
    from film.shots import compose
    img = compose(t)
    return to_u8(grade(img, fi, grain=0.022, vign=0.5))


def stills(times):
    os.makedirs(os.path.join(BUILD, "stills"), exist_ok=True)
    for t in times:
        t0 = time.time()
        im = frame(float(t), int(float(t) * FPS))
        p = os.path.join(BUILD, "stills", f"{float(t):07.2f}.jpg")
        cv2.imwrite(p, cv2.cvtColor(im, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 90])
        print(p, f"{time.time() - t0:.2f}s")


def sheet(per=1, cols=4, out=None, which=None):
    from film.shots import SHOTS
    tiles = []
    names = []
    for s in SHOTS:
        if which and s.name not in which:
            continue
        for k in range(per):
            t = s.t0 + (s.t1 - s.t0) * (k + 1) / (per + 1)
            im = frame(t, int(t * FPS))
            im = cv2.resize(im, (480, 270), interpolation=cv2.INTER_AREA)
            cv2.putText(im, f"{s.name} {t:.1f}", (8, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1, cv2.LINE_AA)
            tiles.append(im)
    while len(tiles) % cols:
        tiles.append(np.zeros_like(tiles[0]))
    rows = [np.hstack(tiles[i:i + cols]) for i in range(0, len(tiles), cols)]
    out = out or os.path.join(BUILD, "sheet.jpg")
    cv2.imwrite(out, cv2.cvtColor(np.vstack(rows), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 85])
    print(out)


def worker(idx, f0, f1, path):
    cv2.setNumThreads(1)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "15",
           "-pix_fmt", "yuv420p", "-x264-params", "keyint=50:min-keyint=25", path]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t0 = time.time()
    for fi in range(f0, f1):
        im = frame(fi / FPS, fi)
        p.stdin.write(im.tobytes())
        if (fi - f0) % 100 == 0:
            el = time.time() - t0
            done = fi - f0 + 1
            print(f"[w{idx}] {done}/{f1 - f0}  {el / done:.2f}s/f", flush=True)
    p.stdin.close()
    p.wait()


def video(jobs, t_from, t_to, out):
    from film.shots import TOTAL
    t_to = TOTAL if t_to is None else t_to
    f0, f1 = int(t_from * FPS), int(t_to * FPS)
    os.makedirs(os.path.join(BUILD, "parts"), exist_ok=True)
    n = f1 - f0
    # dela i jämna block, fler block än jobb för bättre lastbalans
    nblk = jobs * 3
    bounds = [f0 + n * k // nblk for k in range(nblk + 1)]
    parts = [os.path.join(BUILD, "parts", f"p{k:03d}.mp4") for k in range(nblk)]
    queue = list(range(nblk))
    running = []
    while queue or running:
        while queue and len(running) < jobs:
            k = queue.pop(0)
            pr = Process(target=worker, args=(k, bounds[k], bounds[k + 1], parts[k]))
            pr.start()
            running.append(pr)
        for pr in running[:]:
            if not pr.is_alive():
                running.remove(pr)
        time.sleep(0.5)
    lst = os.path.join(BUILD, "parts", "list.txt")
    with open(lst, "w") as f:
        for p in parts:
            f.write(f"file '{p}'\n")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst,
                    "-c", "copy", out], check=True)
    print("video ->", out)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("mode")
    ap.add_argument("args", nargs="*")
    ap.add_argument("--jobs", type=int, default=4)
    ap.add_argument("--from", dest="t_from", type=float, default=0.0)
    ap.add_argument("--to", dest="t_to", type=float, default=None)
    ap.add_argument("--out", default=os.path.join(BUILD, "video_only.mp4"))
    ap.add_argument("--per", type=int, default=1)
    a = ap.parse_args()
    if a.mode == "stills":
        stills(a.args)
    elif a.mode == "sheet":
        sheet(a.per, which=set(a.args) if a.args else None,
              out=os.path.join(BUILD, f"sheet_{'_'.join(a.args)[:40] or 'all'}.jpg"))
    elif a.mode == "video":
        video(a.jobs, a.t_from, a.t_to, a.out)
