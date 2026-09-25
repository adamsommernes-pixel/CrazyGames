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
sys.path.insert(1, os.path.join(os.path.dirname(HERE), "aland"))

from film.common import FPS, H, W, grade, to_u8  # noqa: E402

BUILD = os.path.join(HERE, "build")


_CUES = None


def cues():
    """Undertexter: en post per mening, från tidslinjen och visningstexten."""
    global _CUES
    if _CUES is None:
        import re
        from narration import LINES, display
        from film_d.base import LINES as TLL
        out = []
        for lid, text, _ in LINES:
            sents = [p for p in re.split(r"(?<=[.!?])\s+", text.strip()) if p]
            for k, s in enumerate(sents):
                a, b = TLL[lid]["sents"][k]
                out.append([a - 0.08, b + 0.45, display(s)])
        for i in range(len(out) - 1):
            out[i][1] = min(out[i][1], out[i + 1][0] - 0.06)
        _CUES = out
    return _CUES


def wrap(text, maxw=1400, size=40):
    from film.common import text_width
    words, lines, cur = text.split(), [], ""
    for w in words:
        cand = (cur + " " + w).strip()
        if text_width(cand, "sans_m", size, 0.01) > maxw and cur:
            lines.append(cur)
            cur = w
        else:
            cur = cand
    lines.append(cur)
    if len(lines) == 2:
        # jämnare radbrytning
        ws = text.split()
        best = None
        for k in range(1, len(ws)):
            l1, l2 = " ".join(ws[:k]), " ".join(ws[k:])
            d = max(text_width(l1, "sans_m", size, 0.01), text_width(l2, "sans_m", size, 0.01))
            if text_width(l1, "sans_m", size, 0.01) <= maxw and text_width(l2, "sans_m", size, 0.01) <= maxw:
                if best is None or d < best[0]:
                    best = (d, [l1, l2])
        if best:
            lines = best[1]
    return lines


def subtitles(img, t):
    from film.common import draw_text, smooth, lin
    for a, b, text in cues():
        if a <= t < b:
            al = smooth(lin(t, a, a + 0.15)) * (1 - smooth(lin(t, b - 0.15, b)))
            lines = wrap(text)
            y0 = H - 62 - 52 * (len(lines) - 1)
            for i, ln in enumerate(lines):
                y = y0 + i * 52
                draw_text(img, ln, W / 2, y, name="sans_m", size=40, tracking=0.01, anchor="c",
                          color=(0.96, 0.95, 0.92), alpha=al, shadow=1.3)
                draw_text(img, ln, W / 2, y, name="sans_m", size=40, tracking=0.01, anchor="c",
                          color=(0.96, 0.95, 0.92), alpha=al * 0.35)
    return img


def write_srt(path):
    def ts(x):
        h, r_ = divmod(max(0.0, x), 3600)
        mnt, s_ = divmod(r_, 60)
        return f"{int(h):02d}:{int(mnt):02d}:{int(s_):02d},{int(round((s_ % 1) * 1000)) % 1000:03d}"
    with open(path, "w", encoding="utf-8") as f:
        for i, (a, b, text) in enumerate(cues(), 1):
            f.write(f"{i}\n{ts(a)} --> {ts(b)}\n" + "\n".join(wrap(text)) + "\n\n")


def frame(t, fi):
    from film_d.shots import compose
    img = compose(t)
    img = grade(img, fi, grain=0.022, vign=0.5)
    img = subtitles(img, t)
    return to_u8(img)


def stills(times):
    os.makedirs(os.path.join(BUILD, "stills"), exist_ok=True)
    for t in times:
        t0 = time.time()
        im = frame(float(t), int(float(t) * FPS))
        p = os.path.join(BUILD, "stills", f"{float(t):07.2f}.jpg")
        cv2.imwrite(p, cv2.cvtColor(im, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 90])
        print(p, f"{time.time() - t0:.2f}s")


def sheet(per=1, cols=4, out=None, which=None):
    from film_d.shots import SHOTS
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


PRESET = "slow"
CRF = "15"


def worker(idx, f0, f1, path):
    cv2.setNumThreads(1)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", PRESET, "-crf", CRF,
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


def _bounds(jobs, t_from, t_to):
    from film_d.shots import TOTAL
    t_to = TOTAL if t_to is None else t_to
    f0, f1 = int(t_from * FPS), int(t_to * FPS)
    n = f1 - f0
    nblk = jobs * 3
    bounds = [f0 + n * k // nblk for k in range(nblk + 1)]
    parts = [os.path.join(BUILD, "parts", f"p{k:03d}.mp4") for k in range(nblk)]
    return bounds, parts


def _alive(pid):
    try:
        os.kill(pid, 0)
        with open(f"/proc/{pid}/stat") as f:
            return f.read().split()[2] != "Z"
    except (OSError, FileNotFoundError):
        return False


def blocks(ids, jobs, wait_pids):
    """Rendera valda block; startar nya först när gamla arbetare (wait_pids) blivit klara."""
    bounds, parts = _bounds(4, 0.0, None)
    queue = list(ids)
    running = []
    while queue or running:
        old = sum(1 for p in wait_pids if _alive(p))
        running = [pr for pr in running if pr.is_alive()]
        while queue and len(running) + old < jobs:
            k = queue.pop(0)
            pr = Process(target=worker, args=(k, bounds[k], bounds[k + 1], parts[k]))
            pr.start()
            running.append(pr)
            print(f"start block {k}", flush=True)
        time.sleep(1.0)
    while any(_alive(p) for p in wait_pids):
        time.sleep(1.0)
    concat(parts, os.path.join(BUILD, "video_only.mp4"))


def concat(parts, out):
    lst = os.path.join(BUILD, "parts", "list.txt")
    with open(lst, "w") as f:
        for p in parts:
            f.write(f"file '{p}'\n")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst,
                    "-c", "copy", out], check=True)
    print("video ->", out, flush=True)


def video(jobs, t_from, t_to, out):
    from film_d.shots import TOTAL
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
    ap.add_argument("--preset", default="slow")
    ap.add_argument("--crf", default="15")
    ap.add_argument("--wait-pids", default="")
    a = ap.parse_args()
    PRESET, CRF = a.preset, a.crf
    if a.mode == "stills":
        stills(a.args)
    elif a.mode == "sheet":
        sheet(a.per, which=set(a.args) if a.args else None,
              out=os.path.join(BUILD, f"sheet_{'_'.join(a.args)[:40] or 'all'}.jpg"))
    elif a.mode == "srt":
        write_srt(a.args[0] if a.args else os.path.join(HERE, "Dennis.sv.srt"))
    elif a.mode == "blocks":
        blocks([int(x) for x in a.args], a.jobs, [int(p) for p in a.wait_pids.split(",") if p])
    elif a.mode == "video":
        video(a.jobs, a.t_from, a.t_to, a.out)
