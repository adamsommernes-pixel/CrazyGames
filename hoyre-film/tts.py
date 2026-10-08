# -*- coding: utf-8 -*-
"""Synthesizes each sentence of manus.py to build/vo_raw/<id>_<k>.wav (Piper, Norwegian voice)."""
import os
import sys
import wave

from piper import PiperVoice, SynthesisConfig

from manus import LINES, sentences, spoken

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(HERE, "assets/voice/no-talesyntese-medium.onnx")
OUT = os.path.join(HERE, "build/vo_raw")

LENGTH_SCALE = float(os.environ.get("LS", "1.0"))
NOISE = float(os.environ.get("NS", "0.6"))
NOISE_W = float(os.environ.get("NW", "0.75"))
TAKES = 3

# Lines that carry weight are read a little slower.
SLOW = {"o1": 1.12, "o5": 1.05, "k1": 1.15, "k2": 1.15, "k3": 1.15, "s1": 1.12, "s3": 1.04,
        "e1": 1.12, "e2": 1.18}


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
            # Several takes; keep the median-length one (drops odd takes).
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
