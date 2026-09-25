# -*- coding: utf-8 -*-
"""Bearbetar rå TTS till en mörk, nära "PSA"-röst och lägger ut tidslinjen.

Ut: build/vo/<id>.wav (48 kHz mono), build/vo_track.wav, build/timeline.json
"""
import json
import os

import librosa
import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from pedalboard import (Compressor, Distortion, Gain, HighpassFilter,
                        LowpassFilter, LowShelfFilter, PeakFilter, Pedalboard)

from narration import LINES
from tts import sentences

# Paus mellan meningar inom en replik (s). Tyngre repliker får längre andrum.
SENT_GAP = 0.42
SENT_GAP_LINE = {"o4": 0.55, "a3": 0.5, "a5": 0.6, "c2": 0.45, "d3": 0.55, "e9": 0.6,
                 "g3": 0.5, "g6": 0.5, "g7": 0.55, "h6": 0.65}

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "build/vo_raw")
OUT = os.path.join(HERE, "build/vo")
SR = 48000

INTRO = 3.6          # tystnad/atmosfär innan första repliken
OUTRO = 6.5          # efter sista repliken
PAUSE_SCALE = 0.65
# Extra luft vid kapitelskiften (sekunder efter repliken).
EXTRA = {"o4": 1.8, "a5": 0.4, "b4": 0.4, "c3": 0.6, "d6": 0.4, "e9": 0.6,
         "f6": 0.4, "g8": 0.4}

CHAIN = Pedalboard([
    HighpassFilter(cutoff_frequency_hz=65),
    LowShelfFilter(cutoff_frequency_hz=150, gain_db=3.5, q=0.7),
    PeakFilter(cutoff_frequency_hz=330, gain_db=-2.5, q=1.0),
    PeakFilter(cutoff_frequency_hz=2900, gain_db=2.0, q=0.8),
    PeakFilter(cutoff_frequency_hz=6800, gain_db=-2.5, q=2.0),
    LowpassFilter(cutoff_frequency_hz=10500),
    Compressor(threshold_db=-24, ratio=3.0, attack_ms=4, release_ms=90),
    Gain(gain_db=4),
    Distortion(drive_db=2.5),
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
    """Mycket diskret inandning: bandpassat brus med mjuk kurva."""
    n = int(dur * SR)
    noise = rng.standard_normal(n + 2048)
    spec = np.fft.rfft(noise)
    f = np.fft.rfftfreq(len(noise), 1 / SR)
    shape = (np.exp(-((f - 1400) / 900) ** 2) + 0.5 * np.exp(-((f - 3200) / 700) ** 2)
             + 0.25 * np.exp(-((f - 600) / 300) ** 2))
    y = np.fft.irfft(spec * shape)[:n]
    t = np.linspace(0, 1, n)
    env = np.sin(np.pi * np.clip(t * 1.15, 0, 1)) ** 1.6
    y = y * env
    return y / (np.abs(y).max() + 1e-9)


def main():
    os.makedirs(OUT, exist_ok=True)
    meter = pyln.Meter(SR)
    rng = np.random.default_rng(7)
    clips = {}
    sent_spans = {}
    for lid, text, _ in LINES:
        parts = []
        spans = []
        pos = 0
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
        loud = meter.integrated_loudness(y)
        y = y * 10 ** ((-19.0 - loud) / 20)
        clips[lid] = y
        sf.write(os.path.join(OUT, lid + ".wav"), y, SR, subtype="FLOAT")

    # Tidslinje
    def segments(y):
        """Röstade segment åtskilda av pauser > 0.13 s."""
        hop = int(0.01 * SR)
        fr = np.array([np.sqrt(np.mean(y[i:i + hop] ** 2)) for i in range(0, len(y) - hop, hop)])
        thr = fr.max() * 10 ** (-38 / 20)
        voiced = fr > thr
        segs = []
        i = 0
        n = len(voiced)
        while i < n:
            if voiced[i]:
                j = i
                while j < n:
                    # sök nästa tysta sträcka >= 13 frames
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

    t = INTRO
    timeline = {}
    for i, (lid, text, pause) in enumerate(LINES):
        d = len(clips[lid]) / SR
        timeline[lid] = {"start": round(t, 3), "end": round(t + d, 3), "text": text,
                         "segs": [[round(t + a, 3), round(t + b, 3)] for a, b in segments(clips[lid])],
                         "sents": [[round(t + a, 3), round(t + b, 3)] for a, b in sent_spans[lid]]}
        t += d + pause * PAUSE_SCALE + EXTRA.get(lid, 0.0)
    total = timeline[LINES[-1][0]]["end"] + OUTRO
    track = np.zeros(int(total * SR) + SR, np.float32)
    for i, (lid, _, _) in enumerate(LINES):
        s = int(timeline[lid]["start"] * SR)
        y = clips[lid]
        track[s:s + len(y)] += y
        # andning före repliker som följer en tydlig paus
        prev_gap = timeline[lid]["start"] - (timeline[LINES[i - 1][0]]["end"] if i else 0)
        if prev_gap > 0.75 and rng.random() < 0.55:
            b = breath(rng, rng.uniform(0.34, 0.5)) * 10 ** (-41 / 20)
            bs = s - len(b) - int(0.07 * SR)
            if bs > 0:
                track[bs:bs + len(b)] += b.astype(np.float32)
    sf.write(os.path.join(HERE, "build/vo_track.wav"), track, SR, subtype="FLOAT")
    json.dump({"lines": timeline, "total": round(total, 3)},
              open(os.path.join(HERE, "build/timeline.json"), "w"), ensure_ascii=False, indent=1)
    print(f"total length {total:.1f}s ({int(total // 60)}:{total % 60:04.1f})")


if __name__ == "__main__":
    main()
