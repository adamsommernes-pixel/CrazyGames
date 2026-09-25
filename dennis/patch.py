# -*- coding: utf-8 -*-
"""Renderar om ett kort tidsfönster till en separat fil (läggs över huvudrenderingen i finalize.sh).

  python3 patch.py 35.0 40.6 build/patch_a2.mp4
"""
import subprocess
import sys

from render import FPS, H, W, frame

t0, t1, out = float(sys.argv[1]), float(sys.argv[2]), sys.argv[3]
f0, f1 = int(round(t0 * FPS)), int(round(t1 * FPS))
cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
       "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", out]
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
for fi in range(f0, f1):
    p.stdin.write(frame(fi / FPS, fi).tobytes())
p.stdin.close()
p.wait()
print("patch ->", out, f0 / FPS, f1 / FPS)
