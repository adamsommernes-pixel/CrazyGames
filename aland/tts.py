# -*- coding: utf-8 -*-
"""Syntetiserar varje replik i narration.py till build/vo_raw/<id>.wav."""
import os
import sys
import wave

from piper import PiperVoice, SynthesisConfig

import re

from narration import LINES, spoken


def sentences(text):
    """Dela repliken i meningar (behåller skiljetecken)."""
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p for p in parts if p]

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(HERE, "assets/voice/sv-se-nst-medium.onnx")
OUT = os.path.join(HERE, "build/vo_raw")

LENGTH_SCALE = float(os.environ.get("LS", "0.98"))
NOISE = float(os.environ.get("NS", "0.62"))
NOISE_W = float(os.environ.get("NW", "0.8"))
TAKES = 3

# Tyngre repliker läses långsammare.
SLOW = {"o4": 1.06, "a5": 1.08, "c3": 1.15, "d4": 1.08, "e3": 1.08, "e9": 1.1,
        "g5": 1.1, "g7": 1.04, "h5": 1.06, "h6": 1.1, "h7": 1.15}


def main():
    os.makedirs(OUT, exist_ok=True)
    voice = PiperVoice.load(MODEL, config_path=MODEL + ".json")
    only = set(sys.argv[1:])
    total = 0.0
    for lid, text, pause in LINES:
        if only and lid not in only:
            continue
        cfg = SynthesisConfig(length_scale=LENGTH_SCALE * SLOW.get(lid, 1.0),
                              noise_scale=NOISE, noise_w_scale=NOISE_W,
                              normalize_audio=False)
        dur = 0.0
        for si, sent in enumerate(sentences(text)):
            # Flera tagningar; behåll den med mediantid (sållar bort udda tagningar).
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
        print(f"{lid}: {dur:5.2f}s  {text[:60]}")
    print(f"total incl. pauses: {total:.1f}s")


if __name__ == "__main__":
    main()
