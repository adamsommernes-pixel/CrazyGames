# -*- coding: utf-8 -*-
"""Renders the picture.

  python3 render.py stills t1 t2 ...         -> build/stills/*.jpg
  python3 render.py sheet [S01 S02 ...]      -> contact sheet (one frame per shot)
  python3 render.py video [--jobs 4] [--from s --to s] [--ss 2]
  python3 render.py srt                      -> Tre_vinduer.no.srt
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

import config  # noqa: E402
from film.common import BUILD, FPS, H, W, smooth, lin, to_u8  # noqa: E402

SS = config.SUPERSAMPLE


def frame(t, fi):
    from film import overlay as O
    from film.post import finish
    from film.raster import render
    from film import mesh as M
    from film.shots import Card, shot_at
    s = shot_at(t)
    fr = s.fn(t, t - s.t0, s.t1 - s.t0)
    if isinstance(fr, Card):
        img = np.zeros((H, W, 3), np.float32)
        fr.draw(img)
    else:
        hdr, z = render(M.build(fr.parts), fr.cam, fr.env, W, H, ss=SS, decals=fr.decals)
        if fr.pre:
            fr.pre(hdr, fr.cam)
        img = finish(hdr, z, fi, focus=fr.focus, aperture=fr.aperture, tilt=fr.tilt, exposure=fr.exposure,
                     warm=fr.warm, bloom_amt=fr.bloom)
        if fr.post:
            fr.post(img, fr.cam)
        if fr.illus:
            O.illustration(img)
    img *= smooth(lin(t, 0.0, 0.8))
    O.draft(img)
    return to_u8(img)


def stills(times):
    os.makedirs(os.path.join(BUILD, "stills"), exist_ok=True)
    for t in times:
        t0 = time.time()
        im = frame(float(t), int(float(t) * FPS))
        p = os.path.join(BUILD, "stills", f"{float(t):07.2f}.jpg")
        cv2.imwrite(p, cv2.cvtColor(im, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 90])
        print(p, f"{time.time() - t0:.2f}s", flush=True)


def sheet(which=None, per=1, cols=4, out=None):
    from film.shots import SHOTS
    tiles = []
    for s in SHOTS:
        if which and s.name not in which:
            continue
        for k in range(per):
            t = s.t0 + (s.t1 - s.t0) * (k + 1) / (per + 1)
            im = frame(t, int(t * FPS))
            im = cv2.resize(im, (640, 360), interpolation=cv2.INTER_AREA)
            cv2.putText(im, f"{s.name} {t:.1f}", (8, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 0), 1, cv2.LINE_AA)
            tiles.append(im)
            print(s.name, f"{t:.1f}", flush=True)
    while len(tiles) % cols:
        tiles.append(np.zeros_like(tiles[0]))
    rows = [np.hstack(tiles[i:i + cols]) for i in range(0, len(tiles), cols)]
    out = out or os.path.join(BUILD, "sheet.jpg")
    cv2.imwrite(out, cv2.cvtColor(np.vstack(rows), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 85])
    print(out)


def write_srt(path):
    from manus import LINES, sentences
    from film.shots import LINES as TL

    def ts(x):
        h, r_ = divmod(max(0.0, x), 3600)
        m, s_ = divmod(r_, 60)
        return f"{int(h):02d}:{int(m):02d}:{int(s_):02d},{int(round((s_ % 1) * 1000)) % 1000:03d}"
    cues = []
    for lid, text, _ in LINES:
        for k, s in enumerate(sentences(text)):
            a, b = TL[lid]["sents"][k]
            cues.append([a - 0.08, b + 0.4, s])
    for i in range(len(cues) - 1):
        cues[i][1] = min(cues[i][1], cues[i + 1][0] - 0.06)
    with open(path, "w", encoding="utf-8") as f:
        for i, (a, b, s) in enumerate(cues, 1):
            words, lines, cur = s.split(), [], ""
            for w in words:
                if len(cur) + len(w) + 1 > 42 and cur:
                    lines.append(cur)
                    cur = w
                else:
                    cur = (cur + " " + w).strip()
            lines.append(cur)
            f.write(f"{i}\n{ts(a)} --> {ts(b)}\n" + "\n".join(lines) + "\n\n")
    print(path)


PRESET, CRF = "medium", "16"


def worker(idx, f0, f1, path):
    cv2.setNumThreads(1)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", PRESET, "-crf", CRF,
           "-pix_fmt", "yuv420p", "-x264-params", "keyint=50:min-keyint=25", path]
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        print(f"[w{idx}] exists, skipping", flush=True)
        return
    tmp = path + ".part.mp4"
    cmd[-1] = tmp
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t0 = time.time()
    for fi in range(f0, f1):
        im = frame(fi / FPS, fi)
        p.stdin.write(im.tobytes())
        if (fi - f0) % 100 == 0:
            el = time.time() - t0
            print(f"[w{idx}] {fi - f0 + 1}/{f1 - f0}  {el / (fi - f0 + 1):.2f}s/f", flush=True)
    p.stdin.close()
    p.wait()
    os.replace(tmp, path)


def video(jobs, t_from, t_to, out):
    from film.shots import TOTAL
    t_to = TOTAL if t_to is None else t_to
    f0, f1 = int(t_from * FPS), int(t_to * FPS)
    os.makedirs(os.path.join(BUILD, "parts"), exist_ok=True)
    n = f1 - f0
    nblk = max(1, n // 250)          # 10-second blocks: resumable, good load balance
    bounds = [f0 + n * k // nblk for k in range(nblk + 1)]
    parts = [os.path.join(BUILD, "parts", f"p{bounds[k]:06d}_{bounds[k + 1]:06d}.mp4") for k in range(nblk)]
    queue = list(range(nblk))
    running = []
    while queue or running:
        while queue and len(running) < jobs:
            k = queue.pop(0)
            pr = Process(target=worker, args=(k, bounds[k], bounds[k + 1], parts[k]))
            pr.start()
            running.append(pr)
        running = [pr for pr in running if pr.is_alive()]
        time.sleep(0.5)
    lst = os.path.join(BUILD, "parts", "list.txt")
    with open(lst, "w") as f:
        for p in parts:
            f.write(f"file '{p}'\n")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst,
                    "-c", "copy", out], check=True)
    print("video ->", out, flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("mode")
    ap.add_argument("args", nargs="*")
    ap.add_argument("--jobs", type=int, default=4)
    ap.add_argument("--from", dest="t_from", type=float, default=0.0)
    ap.add_argument("--to", dest="t_to", type=float, default=None)
    ap.add_argument("--out", default=os.path.join(BUILD, "video_only.mp4"))
    ap.add_argument("--ss", type=int, default=None)
    ap.add_argument("--per", type=int, default=1)
    a = ap.parse_args()
    if a.ss:
        SS = a.ss
    if a.mode == "stills":
        stills(a.args)
    elif a.mode == "sheet":
        sheet(set(a.args) if a.args else None, a.per,
              out=os.path.join(BUILD, f"sheet_{'_'.join(a.args)[:40] or 'all'}.jpg"))
    elif a.mode == "srt":
        write_srt(a.args[0] if a.args else os.path.join(HERE, "Tre_vinduer.no.srt"))
    elif a.mode == "video":
        video(a.jobs, a.t_from, a.t_to, a.out)
