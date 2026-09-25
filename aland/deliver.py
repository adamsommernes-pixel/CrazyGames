# -*- coding: utf-8 -*-
"""Kodar om varje färdigt renderblock till 720p direkt (medan resten renderas),
och sätter ihop en liten delbar fil (< 30 MB) så fort sista blocket är klart.
Därefter görs 1080p-mastern."""
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from render import _bounds  # noqa: E402

PARTS = os.path.join(HERE, "build/parts")
SMALL = os.path.join(HERE, "build/small")
TARGET_MIB = 27.5
AUDIO_K = 96


def frames(path):
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets",
                              "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", path],
                             capture_output=True, text=True, timeout=60).stdout.strip()
        return int(out) if out else -1
    except Exception:
        return -1


def main():
    os.makedirs(SMALL, exist_ok=True)
    bounds, parts = _bounds(4, 0.0, None)
    total = (bounds[-1] - bounds[0]) / 25.0
    vk = int(TARGET_MIB * 1024 * 1024 * 8 / total / 1000 - AUDIO_K - 8)
    print(f"720p video bitrate {vk}k over {total:.1f}s", flush=True)
    outs = []
    for k, p in enumerate(parts):
        need = bounds[k + 1] - bounds[k]
        while not (os.path.exists(p) and frames(p) == need):
            time.sleep(5)
        o = os.path.join(SMALL, f"s{k:03d}.mp4")
        subprocess.run(["nice", "-n", "10", "ffmpeg", "-v", "error", "-y", "-i", p,
                        "-vf", "hqdn3d=2.5:2.5:5:5,scale=1280:720:flags=lanczos",
                        "-c:v", "libx264", "-preset", "medium", "-b:v", f"{vk}k",
                        "-maxrate", f"{int(vk * 1.6)}k", "-bufsize", f"{vk * 2}k", "-tune", "film",
                        "-x264-params", "keyint=50:min-keyint=25:scenecut=0", "-pix_fmt", "yuv420p", "-an", o],
                       check=True)
        outs.append(o)
        print(f"part {k} encoded", flush=True)
    lst = os.path.join(SMALL, "list.txt")
    with open(lst, "w") as f:
        for o in outs:
            f.write(f"file '{o}'\n")
    small = os.path.join(HERE, "Aland_Mellan_tva_riken_720p.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst,
                    "-i", os.path.join(HERE, "build/mix.wav"), "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", f"{AUDIO_K}k", "-movflags", "+faststart",
                    "-shortest", small], check=True)
    print(f"SMALL DONE {os.path.getsize(small) / 1024 / 1024:.1f} MiB", flush=True)
    # 1080p-master (inte bråttom)
    ins = []
    fc = ""
    for k, p in enumerate(parts):
        ins += ["-i", p]
        fc += f"[{k}:v]"
    n = len(parts)
    subprocess.run(["ffmpeg", "-v", "error", "-y", *ins, "-i", os.path.join(HERE, "build/mix.wav"),
                    "-filter_complex", f"{fc}concat=n={n}:v=1:a=0[v]", "-map", "[v]", "-map", f"{n}:a",
                    "-c:v", "libx264", "-preset", "fast", "-crf", "21", "-tune", "film", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", "-shortest",
                    os.path.join(HERE, "Aland_Mellan_tva_riken.mp4")], check=True)
    print("MASTER DONE", flush=True)


if __name__ == "__main__":
    main()
