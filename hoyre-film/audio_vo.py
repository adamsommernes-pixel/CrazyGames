# -*- coding: utf-8 -*-
"""Processes raw TTS into a warm, close narration voice and lays out the timeline.

Out: build/vo/<id>.wav, build/vo_track.wav, build/timeline.json
Every shot, caption, music cue and sound effect is timed from timeline.json.
"""
import json
import os

import librosa
import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from pedalboard import (Compressor, Gain, HighpassFilter, LowpassFilter,
                        LowShelfFilter, PeakFilter, Pedalboard)

from manus import LINES, sentences

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "build/vo_raw")
OUT = os.path.join(HERE, "build/vo")
SR = 48000

SENT_GAP = 0.55                 # between sentences in a line
SENT_GAP_LINE = {"o4": 0.75, "o5": 0.7, "a5": 0.6, "a7": 0.75, "b6": 0.75, "s1": 0.8, "s3": 0.7,
                 "e1": 0.9, "e2": 0.9}
INTRO = 1.6                     # street ambience before the first line
OUTRO = 7.0                     # end card after the last line
# Extra air (s) after a line: title card, chapter cards, before Høyre's answers.
EXTRA = {"o5": 6.2, "r2": 0.8, "a8": 1.2, "b7": 1.2, "c3": 1.0, "k1": 0.6, "k2": 0.6, "k3": 0.6,
         "a6": 0.4, "a7": 0.6, "b6": 0.6, "s3": 0.6}

CHAIN = Pedalboard([
    HighpassFilter(cutoff_frequency_hz=70),
    LowShelfFilter(cutoff_frequency_hz=180, gain_db=2.0, q=0.7),
    PeakFilter(cutoff_frequency_hz=320, gain_db=-1.5, q=1.0),
    PeakFilter(cutoff_frequency_hz=3200, gain_db=1.5, q=0.8),
    PeakFilter(cutoff_frequency_hz=7200, gain_db=-2.0, q=2.0),
    LowpassFilter(cutoff_frequency_hz=11000),
    Compressor(threshold_db=-24, ratio=2.5, attack_ms=6, release_ms=110),
    Gain(gain_db=3),
])


def trim(y, sr, pad=0.04):
    env = np.abs(y)
    nz = np.where(env > 0.02 * env.max())[0]
    a = max(0, nz[0] - int(pad * sr))
    b = min(len(y), nz[-1] + int(pad * 2 * sr))
    out = y[a:b].copy()
    f = int(0.012 * sr)
    out[:f] *= np.linspace(0, 1, f)
    out[-f:] *= np.linspace(1, 0, f)
    return out


def segments(y):
    """Voiced stretches separated by pauses > 0.13 s (used to time on-screen text)."""
    hop = int(0.01 * SR)
    fr = np.array([np.sqrt(np.mean(y[i:i + hop] ** 2)) for i in range(0, len(y) - hop, hop)])
    voiced = fr > fr.max() * 10 ** (-38 / 20)
    segs, i, n = [], 0, len(voiced)
    while i < n:
        if voiced[i]:
            j = i
            while j < n:
                if not voiced[j]:
                    k = j
                    while k < n and not voiced[k]:
                        k += 1
                    if k - j >= 13 or k == n:
                        break
                    j = k
                else:
                    j += 1
            segs.append((i * 0.01, j * 0.01))
            i = j
        else:
            i += 1
    return segs


def main():
    os.makedirs(OUT, exist_ok=True)
    meter = pyln.Meter(SR)
    clips, spans = {}, {}
    for lid, text, _ in LINES:
        parts, sp, pos = [], [], 0
        for si, _ in enumerate(sentences(text)):
            y, sr = sf.read(os.path.join(RAW, f"{lid}_{si}.wav"))
            y = trim(y.astype(np.float32), sr)
            y = librosa.resample(y, orig_sr=sr, target_sr=SR, res_type="soxr_vhq")
            if parts:
                g = int(SENT_GAP_LINE.get(lid, SENT_GAP) * SR)
                parts.append(np.zeros(g, np.float32))
                pos += g
            parts.append(y)
            sp.append((pos / SR, (pos + len(y)) / SR))
            pos += len(y)
        y = CHAIN(np.concatenate(parts)[None, :].astype(np.float32), SR)[0]
        y = y * 10 ** ((-19.0 - meter.integrated_loudness(y)) / 20)
        clips[lid], spans[lid] = y, sp
        sf.write(os.path.join(OUT, lid + ".wav"), y, SR, subtype="FLOAT")

    t, timeline = INTRO, {}
    for lid, text, pause in LINES:
        d = len(clips[lid]) / SR
        timeline[lid] = {"start": round(t, 3), "end": round(t + d, 3), "text": text,
                         "segs": [[round(t + a, 3), round(t + b, 3)] for a, b in segments(clips[lid])],
                         "sents": [[round(t + a, 3), round(t + b, 3)] for a, b in spans[lid]]}
        t += d + pause + EXTRA.get(lid, 0.0)
    total = timeline[LINES[-1][0]]["end"] + OUTRO
    track = np.zeros(int(total * SR) + SR, np.float32)
    for lid, _, _ in LINES:
        s = int(timeline[lid]["start"] * SR)
        track[s:s + len(clips[lid])] += clips[lid]
    sf.write(os.path.join(HERE, "build/vo_track.wav"), track, SR, subtype="FLOAT")
    json.dump({"lines": timeline, "total": round(total, 3)},
              open(os.path.join(HERE, "build/timeline.json"), "w"), ensure_ascii=False, indent=1)
    for lid, _, _ in LINES:
        print(f"{lid} {timeline[lid]['start']:7.2f}")
    print(f"total length {total:.1f}s ({int(total // 60)}:{total % 60:04.1f})")


if __name__ == "__main__":
    main()
