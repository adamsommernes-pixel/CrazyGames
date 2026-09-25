# -*- coding: utf-8 -*-
"""Bearbetar rå TTS till en varm, mörk berättarröst och lägger ut tidslinjen.

Ut: build/vo/<id>.wav, build/vo_track.wav, build/timeline.json
"""
import json
import os

import librosa
import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from pedalboard import (Compressor, Gain, HighpassFilter, HighShelfFilter,
                        LowpassFilter, LowShelfFilter, PeakFilter, Pedalboard)

from narration import LINES
from tts import sentences

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "build/vo_raw")
OUT = os.path.join(HERE, "build/vo")
SR = 48000

SENT_GAP = 0.7
SENT_GAP_LINE = {"a3": 0.75, "b3": 0.8, "c4": 0.9, "c5": 0.62, "d3": 0.72, "d5": 0.62,
                 "g3": 0.8, "g5": 0.85, "i2": 0.85, "i5": 0.8}
INTRO = 3.2
OUTRO = 13.0
# Extra luft vid kapitelskiften (efter repliken)
EXTRA = {"o3": 1.8, "a4": 2.4, "b4": 2.4, "c6": 2.6, "d8": 2.2, "e5": 2.6, "f3": 2.2, "f5": 2.4,
         "g2": 0.4, "g7": 0.0, "h4": 2.6, "i3": 1.2, "i5": 0.4}

# Varm, nära röst: lite mer kropp, mindre nasalt/vasst, jämn dynamik. Ingen tonhöjdsändring.
CHAIN = Pedalboard([
    HighpassFilter(cutoff_frequency_hz=60),
    LowShelfFilter(cutoff_frequency_hz=160, gain_db=2.5, q=0.7),
    PeakFilter(cutoff_frequency_hz=380, gain_db=-2.0, q=1.1),
    PeakFilter(cutoff_frequency_hz=1100, gain_db=-1.0, q=1.0),
    PeakFilter(cutoff_frequency_hz=3000, gain_db=1.2, q=0.9),
    HighShelfFilter(cutoff_frequency_hz=7000, gain_db=-3.0, q=0.7),
    LowpassFilter(cutoff_frequency_hz=11000),
    Compressor(threshold_db=-24, ratio=2.6, attack_ms=6, release_ms=110),
    Gain(gain_db=3),
])


def trim(y, sr, pad=0.04):
    env = np.abs(y)
    thr = 0.02 * env.max()
    nz = np.where(env > thr)[0]
    a = max(0, nz[0] - int(pad * sr))
    b = min(len(y), nz[-1] + int(pad * 2 * sr))
    out = y[a:b].copy()
    f = int(0.012 * sr)
    out[:f] *= np.linspace(0, 1, f)
    out[-f:] *= np.linspace(1, 0, f)
    return out


def breath(rng, dur=0.42):
    n = int(dur * SR)
    noise = rng.standard_normal(n + 2048)
    spec = np.fft.rfft(noise)
    f = np.fft.rfftfreq(len(noise), 1 / SR)
    shape = (np.exp(-((f - 1400) / 900) ** 2) + 0.5 * np.exp(-((f - 3200) / 700) ** 2)
             + 0.25 * np.exp(-((f - 600) / 300) ** 2))
    y = np.fft.irfft(spec * shape)[:n]
    t = np.linspace(0, 1, n)
    y = y * np.sin(np.pi * np.clip(t * 1.15, 0, 1)) ** 1.6
    return y / (np.abs(y).max() + 1e-9)


def main():
    os.makedirs(OUT, exist_ok=True)
    meter = pyln.Meter(SR)
    rng = np.random.default_rng(7)
    clips, sent_spans = {}, {}
    for lid, text, _ in LINES:
        parts, spans, pos = [], [], 0
        for si, _ in enumerate(sentences(text)):
            y, sr = sf.read(os.path.join(RAW, f"{lid}_{si}.wav"))
            y = trim(y.astype(np.float32), sr)
            y = librosa.resample(y, orig_sr=sr, target_sr=SR, res_type="soxr_vhq")
            if parts:
                g = int(SENT_GAP_LINE.get(lid, SENT_GAP) * SR)
                parts.append(np.zeros(g, np.float32))
                pos += g
            parts.append(y)
            spans.append((pos / SR, (pos + len(y)) / SR))
            pos += len(y)
        sent_spans[lid] = spans
        y = np.concatenate(parts)
        y = CHAIN(y[None, :].astype(np.float32), SR)[0]
        loud = meter.integrated_loudness(y) if len(y) > SR * 0.5 else meter.integrated_loudness(np.pad(y, (0, SR)))
        y = y * 10 ** ((-19.0 - loud) / 20)
        clips[lid] = y
        sf.write(os.path.join(OUT, lid + ".wav"), y, SR, subtype="FLOAT")

    t = INTRO
    timeline = {}
    for lid, text, pause in LINES:
        d = len(clips[lid]) / SR
        timeline[lid] = {"start": round(t, 3), "end": round(t + d, 3), "text": text,
                         "sents": [[round(t + a, 3), round(t + b, 3)] for a, b in sent_spans[lid]]}
        t += d + pause + EXTRA.get(lid, 0.0)
    total = timeline[LINES[-1][0]]["end"] + OUTRO
    track = np.zeros(int(total * SR) + SR, np.float32)
    for i, (lid, _, _) in enumerate(LINES):
        s = int(timeline[lid]["start"] * SR)
        y = clips[lid]
        track[s:s + len(y)] += y
        prev_gap = timeline[lid]["start"] - (timeline[LINES[i - 1][0]]["end"] if i else 0)
        if prev_gap > 0.75 and rng.random() < 0.5:
            b = breath(rng, rng.uniform(0.34, 0.48)) * 10 ** (-42 / 20)
            bs = s - len(b) - int(0.07 * SR)
            if bs > 0:
                track[bs:bs + len(b)] += b.astype(np.float32)
    sf.write(os.path.join(HERE, "build/vo_track.wav"), track, SR, subtype="FLOAT")
    json.dump({"lines": timeline, "total": round(total, 3)},
              open(os.path.join(HERE, "build/timeline.json"), "w"), ensure_ascii=False, indent=1)
    print(f"total length {total:.1f}s ({int(total // 60)}:{total % 60:04.1f})")


if __name__ == "__main__":
    main()
