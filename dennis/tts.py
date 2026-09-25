# -*- coding: utf-8 -*-
"""Syntetiserar varje replik i narration.py till build/vo_raw/<id>_<mening>.wav (Piper, svensk NST-röst)."""
import os
import re
import sys
import wave

from piper import PiperVoice, SynthesisConfig

from narration import LINES, spoken

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(HERE, "../aland/assets/voice/sv-se-nst-medium.onnx")
OUT = os.path.join(HERE, "build/vo_raw")

LENGTH_SCALE = float(os.environ.get("LS", "1.1"))
NOISE = float(os.environ.get("NS", "0.6"))
NOISE_W = float(os.environ.get("NW", "0.8"))
TAKES = 3

# Repliker som läses lite långsammare (tyngd, eftertanke, poänger).
SLOW = {"o3": 1.05, "a1": 1.08, "a4": 1.06, "b3": 1.06, "b4": 1.08, "c2": 1.08, "c4": 1.12,
        "d7": 1.2, "e5": 1.1, "f4": 1.06, "g2": 1.15, "g7": 1.03, "h4": 1.05,
        "i4": 1.1, "i5": 1.18, "i6": 1.18}


def sentences(text):
    return [p for p in re.split(r"(?<=[.!?])\s+", text.strip()) if p]


def main():
    os.makedirs(OUT, exist_ok=True)
    voice = PiperVoice.load(MODEL, config_path=MODEL + ".json")
    only = set(sys.argv[1:])
    total = 0.0
    for lid, text, pause in LINES:
        if only and lid not in only:
            continue
        cfg = SynthesisConfig(length_scale=LENGTH_SCALE * SLOW.get(lid, 1.0),
                              noise_scale=NOISE, noise_w_scale=NOISE_W, normalize_audio=False)
        dur = 0.0
        for si, sent in enumerate(sentences(text)):
            # flera tagningar; behåll den med mediantid
            takes = []
            for k in range(TAKES):
                p = os.path.join(OUT, f"{lid}_{si}.take{k}.wav")
                with wave.open(p, "wb") as wf:
                    voice.synthesize_wav(spoken(sent), wf, syn_config=cfg)
                with wave.open(p, "rb") as wf:
                    takes.append((wf.getnframes() / wf.getframerate(), p))
            takes.sort()
            d, best = takes[len(takes) // 2]
            os.replace(best, os.path.join(OUT, f"{lid}_{si}.wav"))
            for _, p in takes:
                if os.path.exists(p):
                    os.remove(p)
            dur += d
        total += dur + pause
        print(f"{lid}: {dur:5.2f}s  {text[:60]}", flush=True)
    print(f"total incl. pauses: {total:.1f}s")


if __name__ == "__main__":
    main()
