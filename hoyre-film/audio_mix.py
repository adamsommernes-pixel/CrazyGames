# -*- coding: utf-8 -*-
"""Sound design + final mix: voice, music stems, synthesized foley and ambience.
Levels per 04-musikk-og-lyd.md: voice −16 LUFS (web), music ~18 dB under the voice with
ducking, foley quieter than the music. Out: build/mix.wav

DSP helpers and the mix chain are reused from the Åland film."""
import math
import os
import sys

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from pedalboard import Compressor, HighpassFilter, LowpassFilter, LowShelfFilter, Pedalboard, PeakFilter
from scipy.signal import butter, oaconvolve, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
SR = 48000

from film.shots import E_, LINES, S_, SHOTS, TOTAL, Wt  # noqa: E402

SH = {s.name: s for s in SHOTS}
N = int(TOTAL * SR) + SR
RNG = np.random.default_rng(5)


# --------------------------------------------------------------------------
# DSP helpers
# --------------------------------------------------------------------------
def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)


def pink(n):
    w = RNG.standard_normal(n)
    X = np.fft.rfft(w)
    f = np.fft.rfftfreq(n, 1 / SR)
    f[0] = 1
    y = np.fft.irfft(X / np.sqrt(f), n)
    return y / (np.abs(y).max() + 1e-9)


def smooth_noise(n, rate, seed=0):
    r = np.random.default_rng(seed)
    k = max(2, int(n / SR * rate) + 2)
    return np.interp(np.arange(n), np.linspace(0, n, k), r.random(k))


def norm(y):
    return y / (np.abs(y).max() + 1e-9)


def env(n, a=0.05, r=0.3):
    """Fade in/out envelope for a clip of n samples."""
    e = np.ones(n)
    ai, ri = min(n // 2, int(a * SR)), min(n // 2, int(r * SR))
    if ai:
        e[:ai] = np.linspace(0, 1, ai)
    if ri:
        e[-ri:] = np.linspace(1, 0, ri)
    return e


class Bus:
    def __init__(self):
        self.x = np.zeros((N, 2), np.float64)

    def add(self, t, sig, gain=1.0, pan=0.0):
        s = int(t * SR)
        if s >= N:
            return
        if sig.ndim == 1:
            l, r = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
            sig = np.stack([sig * l, sig * r], 1) * math.sqrt(2)
        a, e = max(0, s), min(N, s + len(sig))
        self.x[a:e] += sig[a - s:e - s] * gain


def db(v):
    return 10 ** (v / 20)


def make_ir(rt=2.6, length=3.5, pre=0.018, seed=1):
    r = np.random.default_rng(seed)
    n = int(length * SR)
    t = np.arange(n) / SR
    ir = np.zeros((n, 2))
    for ch in range(2):
        acc = np.zeros(n)
        for lo, hi, T in ((20, 400, rt * 1.15), (400, 1800, rt), (1800, 6000, rt * 0.7), (6000, 16000, rt * 0.4)):
            acc += bp(r.standard_normal(n), lo, hi) * np.exp(-6.9 * t / T)
        for k in range(10):
            acc[int(r.uniform(0.005, 0.06) * SR)] += r.uniform(-0.6, 0.6)
        ir[:, ch] = acc
    ir = np.concatenate([np.zeros((int(pre * SR), 2)), ir])
    return ir / np.sqrt((ir ** 2).sum(0)).max()


def reverb(x, ir):
    out = np.zeros_like(x)
    for ch in range(2):
        out[:, ch] = oaconvolve(x[:, ch], ir[:, ch])[:len(x)]
    return out


def peak_limit(x, ceiling, look=0.004, release=0.12):
    from scipy.ndimage import maximum_filter1d, uniform_filter1d
    need = np.minimum(1.0, ceiling / np.maximum(np.abs(x).max(1), 1e-9))
    w = int(look * SR)
    g = -maximum_filter1d(-need, size=2 * w + 1)
    blk = 48
    gd = g[::blk].copy()
    a = math.exp(-blk / (release * SR))
    for i in range(1, len(gd)):
        if gd[i] > gd[i - 1]:
            gd[i] = gd[i - 1] * a + gd[i] * (1 - a)
    gs = np.minimum(np.interp(np.arange(len(g)), np.arange(len(gd)) * blk, gd), g)
    gs = uniform_filter1d(gs, w)
    return np.clip(x * gs[:, None], -ceiling, ceiling)


# --------------------------------------------------------------------------
# Foley and ambience (all synthesized)
# --------------------------------------------------------------------------
def wind(dur, seed=0, bright=700):
    n = int(dur * SR)
    out = np.zeros((n, 2))
    for ch in range(2):
        out[:, ch] = lp(pink(n), bright) * (0.45 + 0.55 * smooth_noise(n, 0.3, seed + ch))
    return norm(out) * env(n, 1.5, 1.5)[:, None]


def car_swish(seed=0, dur=3.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    e = np.exp(-((t - dur / 2) / (dur / 5)) ** 2)
    y = lp(pink(n), 900) * e
    return norm(y)


def tick(high=True):
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    f = 3200 if high else 2600
    y = np.sin(2 * np.pi * f * t) * np.exp(-t * 140) + RNG.standard_normal(n) * np.exp(-t * 800) * 0.4
    return norm(y)


def hum(dur, f=58):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = sum(a * np.sin(2 * np.pi * f * k * t) for k, a in ((1, 1.0), (2, 0.5), (3, 0.25), (5, 0.1)))
    y = y * (0.9 + 0.1 * smooth_noise(n, 0.5, 3)) + lp(pink(n), 400) * 0.3
    return norm(y) * env(n, 0.8, 0.8)


def pencil(dur, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    e = np.zeros(n)
    t = 0.0
    while t < dur:
        L_ = r.uniform(0.08, 0.4)
        s, f = int(t * SR), min(n, int((t + L_) * SR))
        e[s:f] = np.maximum(e[s:f], np.sin(np.linspace(0, np.pi, f - s)) ** 0.5 * r.uniform(0.4, 1.0))
        t += L_ + r.uniform(0.05, 0.3)
    return norm(bp(r.standard_normal(n), 2200, 7500) * e)


def paper(seed=0, dur=0.6):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    return norm(bp(r.standard_normal(n), 900, 6000) * np.sin(np.pi * t / dur) ** 1.5 * (0.6 + 0.4 * smooth_noise(n, 30, seed)))


def vibrate(dur=0.45):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.sign(np.sin(2 * np.pi * 165 * t)) * 0.5 + np.sin(2 * np.pi * 330 * t) * 0.3
    y = lp(y, 900) * np.minimum(1, t / 0.02) * np.minimum(1, (dur - t) / 0.04)
    return norm(y + lp(RNG.standard_normal(n), 300) * 0.15)


def pin_cork():
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    y = lp(RNG.standard_normal(n), 2500) * np.exp(-t * 45) + np.sin(2 * np.pi * 180 * t) * np.exp(-t * 30) * 0.5
    return norm(y)


def thump(f=80, dur=0.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * t * (1 - 0.3 * t)) * np.exp(-t * 14) + lp(RNG.standard_normal(n), 900) * np.exp(-t * 35) * 0.5
    return norm(y)


def click():
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    return norm(bp(RNG.standard_normal(n), 1500, 6000) * np.exp(-t * 400) + np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 250) * 0.4)


def murmur(dur, seed=0, lo=250, hi=1600):
    """Voices without words: formant-shaped noise with syllable-rate modulation."""
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    out = np.zeros(n)
    for k in range(5):
        syl = (np.clip(smooth_noise(n, r.uniform(3, 6), seed + k) - 0.45, 0, 1) * 2) ** 1.5
        out += bp(r.standard_normal(n), r.uniform(lo, lo * 1.6), r.uniform(hi * 0.6, hi)) * syl
    return norm(lp(out, 1800)) * env(n, 0.8, 0.8)


def water(dur, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    out = np.zeros((n, 2))
    for ch in range(2):
        lap = (np.clip(smooth_noise(n, 1.4, seed + ch) - 0.3, 0, 1)) ** 2
        out[:, ch] = bp(r.standard_normal(n), 300, 2500) * lap + lp(pink(n), 250) * 0.3
    return norm(out) * env(n, 1.0, 1.0)[:, None]


def chain():
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for k in range(9):
        s = int((k * 0.11 + RNG.uniform(0, 0.03)) * SR)
        L_ = int(0.08 * SR)
        tt = np.arange(L_) / SR
        f = RNG.uniform(1800, 3200)
        y[s:s + L_] += (np.sin(2 * np.pi * f * tt) + 0.6 * np.sin(2 * np.pi * f * 2.7 * tt)) * np.exp(-tt * 60)
    return norm(y + bp(RNG.standard_normal(n), 2000, 6000) * np.exp(-t * 3) * 0.05)


def door(open_=True):
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    y = bp(RNG.standard_normal(n), 400, 2400) * np.exp(-((t - 0.25) / 0.2) ** 2) * 0.4
    y += thump(110, 0.9)[:n] * (0.3 if open_ else 0.8) * (t > 0.5)
    return norm(y)


def ding(f=1320, dur=2.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t * d) for m, a, d in ((1, 1, 2.5), (2.76, 0.4, 4), (5.4, 0.2, 7)))
    return norm(y * (1 - np.exp(-t * 600)))


def bell(f=330, dur=7.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for k, (m, a, d) in enumerate(((0.5, 0.5, 1.0), (1, 1, 1.4), (1.19, 0.5, 2.0), (1.56, 0.35, 2.6), (2.0, 0.4, 3.0), (2.51, 0.25, 3.8))):
        y += a * np.sin(2 * np.pi * f * m * t + k) * np.exp(-t * d)
    return lp(norm(y * (1 - np.exp(-t * 400))), 3000)


def steps(dur, rate=1.8, seed=0, gravel=True):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    y = np.zeros(n)
    t = 0.2
    while t < dur - 0.3:
        s = int(t * SR)
        L_ = int(0.18 * SR)
        tt = np.arange(L_) / SR
        hit = (bp(r.standard_normal(L_), 1200, 6000) if gravel else lp(r.standard_normal(L_), 1500)) * np.exp(-tt * 25)
        hit += np.sin(2 * np.pi * 90 * tt) * np.exp(-tt * 40) * 0.5
        y[s:s + L_] += hit * r.uniform(0.6, 1.0)
        t += 1 / rate * r.uniform(0.9, 1.1)
    return norm(y)


def train_brake(dur=6.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    rumble = lp(pink(n), 180) * np.exp(-t / 4)
    f = 2400 + 300 * np.sin(t * 2)
    squeal = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.clip(np.sin(np.pi * t / dur * 1.2), 0, 1) ** 2 * 0.15
    clack = np.zeros(n)
    for k in np.arange(0, dur * 0.7, 0.5 + 0.0):
        s = int(k * (1 + k * 0.15) * SR)
        if s < n - 2000:
            clack[s:s + 2000] += lp(RNG.standard_normal(2000), 1200) * np.exp(-np.arange(2000) / 300)
    return norm(rumble + squeal + clack * 0.4) * env(n, 0.5, 1.5)


def slide_door():
    n = int(1.4 * SR)
    t = np.arange(n) / SR
    y = bp(RNG.standard_normal(n), 300, 1800) * np.sin(np.pi * np.clip(t / 1.0, 0, 1)) ** 2 + thump(70, 1.4)[:n] * (t > 1.0) * 0.3
    return norm(y)


def keyboard(dur, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    y = np.zeros(n)
    t = 0.1
    while t < dur - 0.1:
        s = int(t * SR)
        y[s:s + 1440] += click()[:1440] * r.uniform(0.3, 1.0) if s + 1440 < n else 0
        t += r.choice([0.09, 0.12, 0.16, 0.5])
    return norm(y)


def clank(seed=0):
    r = np.random.default_rng(seed)
    n = int(0.8 * SR)
    t = np.arange(n) / SR
    y = sum(np.sin(2 * np.pi * r.uniform(400, 2500) * t) * np.exp(-t * r.uniform(8, 20)) for _ in range(4))
    return norm(lp(y, 2500))


def hiss(dur):
    n = int(dur * SR)
    return norm(bp(RNG.standard_normal(n), 2000, 9000)) * env(n, 0.4, 0.6)


def birds(dur, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    y = np.zeros(n)
    t = 0.3
    while t < dur - 0.5:
        k = r.integers(2, 5)
        f0 = r.uniform(2800, 4800)
        for j in range(k):
            L_ = int(r.uniform(0.05, 0.12) * SR)
            tt = np.arange(L_) / SR
            f = f0 * (1 + 0.3 * np.sin(2 * np.pi * r.uniform(15, 30) * tt)) * (1 + r.uniform(-0.2, 0.2) * tt / tt[-1])
            s = int((t + j * 0.13) * SR)
            if s + L_ < n:
                y[s:s + L_] += np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / tt[-1])
        t += r.uniform(0.8, 2.5)
    return norm(y)


def applause(dur=4.0, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    y = np.zeros(n)
    for _ in range(int(dur * 60)):
        s = r.integers(0, n - 1000)
        y[s:s + 1000] += bp(r.standard_normal(1000), 800, 4000) * np.exp(-np.arange(1000) / 120) * r.uniform(0.2, 1)
    return norm(lp(y, 2500)) * env(n, 1.0, 1.5)


def wood_knock():
    n = int(0.4 * SR)
    t = np.arange(n) / SR
    y = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, a, d in ((220, 1, 25), (530, 0.5, 35), (1240, 0.25, 60)))
    return norm(y + lp(RNG.standard_normal(n), 2000) * np.exp(-t * 80) * 0.3)


def rain(dur, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    out = np.zeros((n, 2))
    for ch in range(2):
        y = bp(r.standard_normal(n), 1500, 9000) * 0.5 + lp(pink(n), 600) * 0.3
        drops = np.zeros(n)
        for s in r.integers(0, n - 500, int(dur * 120)):
            drops[s:s + 500] += r.standard_normal(500) * np.exp(-np.arange(500) / 60) * r.uniform(0.1, 0.5)
        out[:, ch] = y + bp(drops, 2000, 8000)
    return norm(out) * env(n, 1.0, 1.0)[:, None]


def bus_pass(dur=6.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    e = np.exp(-((t - dur / 2) / (dur / 4)) ** 2)
    y = lp(pink(n), 500) * e + np.sin(2 * np.pi * 55 * t) * e * 0.3 + bp(RNG.standard_normal(n), 1500, 5000) * e * 0.15
    return norm(y)


def ball(n_b=5):
    out = np.zeros(int(3.0 * SR))
    t = 0.0
    gap = 0.55
    for k in range(n_b):
        s = int(t * SR)
        out[s:s + int(0.25 * SR)] += thump(140, 0.25) * (0.8 ** k)
        t += gap
        gap *= 0.82
    return norm(lp(out, 2000))


def gulls(dur, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    y = np.zeros(n)
    t = 0.5
    while t < dur - 1:
        for j in range(r.integers(2, 4)):
            L_ = int(r.uniform(0.25, 0.45) * SR)
            tt = np.arange(L_) / SR
            f = r.uniform(1100, 1500) * (1 - 0.35 * tt / tt[-1])
            s = int((t + j * 0.35) * SR)
            if s + L_ < n:
                ph = np.cumsum(f) / SR
                y[s:s + L_] += (np.sin(2 * np.pi * ph) + 0.4 * np.sin(4 * np.pi * ph)) * np.clip(np.sin(np.pi * tt / tt[-1]), 0, 1) ** 0.7
        t += r.uniform(2, 4)
    return norm(bp(y, 600, 5000))


def city(dur, seed=0):
    n = int(dur * SR)
    out = np.zeros((n, 2))
    for ch in range(2):
        out[:, ch] = lp(pink(n), 350) * (0.7 + 0.3 * smooth_noise(n, 0.2, seed + ch))
    return norm(out) * env(n, 1.0, 1.0)[:, None]


def schoolyard(dur, seed=0):
    return murmur(dur, seed, 400, 2600)


def sfx_bus():
    fx = Bus()
    g = SH
    # --- cold open
    fx.add(0.0, wind(g["S06"].t0 + 1.0, 1), db(-6))
    fx.add(1.4, car_swish(2), db(-12), pan=-0.4)
    a, b = g["S02"].t0, g["S02"].t1
    for k in range(int(b - a)):
        fx.add(a + 0.3 + k, tick(k % 2 == 0), db(-14), pan=0.3)
    fx.add(a, hum(b - a + 0.4), db(-22))
    a, b = g["S03"].t0, g["S03"].t1
    fx.add(a + 0.4, pencil(b - a - 2.2, 3), db(-15), pan=-0.1)
    fx.add(a + (b - a) * 0.72, paper(4, 0.35), db(-14), pan=0.2)
    t_on, t_msg = S_("o4") + 0.6, S_("o4", 1)
    fx.add(t_on, vibrate(0.4), db(-10))
    fx.add(t_msg - 0.25, vibrate(0.35), db(-10))
    fx.add(t_msg + 0.25, vibrate(0.35), db(-11))
    # title: paper as the letters rise
    t6 = g["S06"].t0
    for k in range(4):
        fx.add(t6 + 0.3 + k * 0.35, paper(10 + k, 0.5), db(-14), pan=-0.4 + 0.27 * k)
    # --- frame
    t7 = g["S07"].t0
    fx.add(t7 + 0.2, paper(20, 1.4), db(-10), pan=-0.3)
    fx.add(t7 + 1.7, paper(21, 1.4), db(-10), pan=0.3)
    fx.add(t7 + 3.5, wind(g["S07"].t1 - t7 - 3.0, 22, 1100), db(-16))
    fx.add(g["S08"].t0 + 1.0, pin_cork(), db(-10), pan=0.1)
    # --- chapter 1
    t342 = Wt("a1", "342")
    tt = t342 - 0.3
    k = 0
    while tt < t342 + 1.5:
        fx.add(tt, click(), db(-14 - 4 * (tt - t342 + 0.3)), pan=0.5)
        tt += 0.05 + 0.1 * ((tt - t342 + 0.3) / 1.8) ** 2
        k += 1
    fx.add(g["S11"].t0, schoolyard(g["S11"].t1 - g["S11"].t0, 30), db(-24))
    a, b = g["S12"].t0, g["S12"].t1
    fx.add(a, water(b - a + 0.5, 40), db(-12))
    fx.add(a + 3.5, chain(), db(-17), pan=0.4)
    a = g["S13"].t0
    fx.add(a + 1.0, door(), db(-16), pan=-0.3)
    fx.add(a + 1.3, ding(), db(-20), pan=-0.3)
    fx.add(a + 3.0, door(), db(-18), pan=-0.3)
    for tt in (Wt("a5", "I 2021"), Wt("a5", "I 2022")):
        fx.add(tt - 0.3, paper(50, 0.5), db(-14))
        fx.add(tt + 0.6, pin_cork(), db(-11))
    t25 = S_("a6") + 0.3
    fx.add(t25 - 0.1, paper(55, 0.5), db(-14))
    fx.add(t25 + 0.9, pin_cork(), db(-11))
    tdoc = Wt("a6", "forbudt")
    fx.add(tdoc, paper(56, 0.6), db(-13))
    fx.add(tdoc + 1.2, thump(70, 0.5), db(-14))
    a, b = g["S17"].t0, g["S17"].t1
    fx.add(a + 0.5, steps(b - a - 1.0, 1.7, 60), db(-22), pan=-0.1)
    # --- chapter 2
    fx.add(g["S19"].t0 + 0.5, np.concatenate([click() * 0.6 if i % 2 else np.zeros(1440) for i in range(30)]), db(-20))
    a, b = g["S20"].t0, g["S20"].t1
    fx.add(a, train_brake(6.5), db(-12), pan=0.3)
    fx.add(a + 4.0, murmur(b - a - 4.0, 70), db(-24))
    fx.add(a + 6.5, slide_door(), db(-16), pan=-0.3)
    fx.add(a, wind(b - a, 71, 600), db(-18))
    a, b = g["S21"].t0, g["S21"].t1
    fx.add(a + 0.5, keyboard(b - a - 1.0, 80), db(-24), pan=0.2)
    fx.add(a, murmur(b - a, 81, 300, 1200), db(-30))
    a, b = g["S22"].t0, g["S22"].t1
    for k in range(5):
        fx.add(a + 1.5 + k * 3.7, clank(90 + k), db(-24), pan=0.5)
    fx.add(a + 6.0, hiss(3.0), db(-26), pan=0.4)
    a, b = g["S23"].t0, g["S23"].t1
    fx.add(a, birds(b - a, 100), db(-20))
    fx.add(S_("b5", 2) + 0.4, applause(4.0, 101), db(-28))
    for tt in [S_("b7") + 0.4, Wt("b7", "kvoteflyktninger"), Wt("b7", "aktivitetsplikt"), Wt("b7", "norskopplæring"),
               Wt("b7", "strengere norskkrav")]:
        fx.add(tt + 0.75, wood_knock(), db(-14), pan=-0.3 + 0.15 * RNG.random())
    a, b = g["S25"].t0, g["S25"].t1
    fx.add(a, water(b - a, 110), db(-24))
    fx.add(a, birds(b - a, 111), db(-28))
    # --- chapter 3
    a, b = g["S27"].t0, g["S27"].t1
    fx.add(a, city(b - a + 0.5, 120), db(-14))
    fx.add(a, rain(b - a + 0.5, 121), db(-16))
    fx.add(a + (b - a) * 0.5 - 3.0, bus_pass(6.0), db(-14), pan=0.0)
    a, b = g["S28"].t0, g["S28"].t1
    fx.add(a, city(b - a, 130), db(-24))
    fx.add(S_("c2", 1) + 1.0, ball(5), db(-20), pan=-0.5)
    fx.add(S_("c2", 2) + 0.5, ball(4), db(-23), pan=-0.5)
    t_h = S_("c3", 1)
    fx.add(t_h + 0.6, door(), db(-18), pan=0.3)
    fx.add(t_h + 1.2, steps(6.0, 2.0, 140, gravel=False), db(-22), pan=0.2)
    # --- synthesis and ending
    a, b = g["S31"].t0, g["S31"].t1
    fx.add(a, gulls(b - a, 150), db(-20), pan=0.4)
    fx.add(a + 2.0, bus_pass(7.0), db(-26), pan=-0.4)
    fx.add(a + 5.0, bell(330, 7.0), db(-24), pan=-0.2)
    a = g["S33"].t0
    fx.add(a, wind(TOTAL - a, 160, 600), db(-14))
    fx.add(a + 0.5, city(TOTAL - a - 0.5, 161), db(-24))
    return fx.x


def load_stem(name):
    y, sr = sf.read(os.path.join(HERE, "build/music", name + ".wav"), always_2d=True)
    assert sr == SR
    out = np.zeros((N, 2))
    m = min(N, len(y))
    out[:m] = y[:m]
    return out


def main():
    meter = pyln.Meter(SR)
    ir_hall = make_ir(2.6, 3.5, 0.02, 1)
    ir_room = make_ir(0.45, 0.9, 0.006, 2)

    # music: soft piano (felt-like: darker), pads, strings
    gains = {"piano": 4.0, "pad": -2.0, "strings": -1.0}
    sends = {"piano": 0.4, "pad": 0.3, "strings": 0.35}
    music = np.zeros((N, 2))
    send = np.zeros((N, 2))
    for k, gdb in gains.items():
        y = load_stem(k) * db(gdb)
        if k == "piano":
            y = Pedalboard([LowpassFilter(3200)])(y.T.astype(np.float32), SR).T.astype(np.float64)
        music += y
        send += y * sends[k]
    music = music + reverb(send, ir_hall) * 0.9
    music = Pedalboard([HighpassFilter(35), PeakFilter(cutoff_frequency_hz=2600, gain_db=-3.5, q=0.7)])(
        music.T.astype(np.float32), SR).T.astype(np.float64)

    vo, sr = sf.read(os.path.join(HERE, "build/vo_track.wav"))
    assert sr == SR
    v = np.zeros(N)
    v[:min(N, len(vo))] = vo[:min(N, len(vo))]
    vo2 = np.stack([v, v], 1)
    vo2 = vo2 + reverb(vo2 * 0.5, ir_room) * 0.18

    # ducking under the voice
    hop = 480
    rms = np.sqrt(np.convolve(v ** 2, np.ones(hop) / hop, mode="same"))
    a_ds = (rms > db(-45)).astype(np.float64)[::hop]
    d_ds = np.zeros_like(a_ds)
    g = 0.0
    att, rel = 1 - math.exp(-hop / (0.15 * SR)), 1 - math.exp(-hop / (1.0 * SR))
    for i, a in enumerate(a_ds):
        g += (a - g) * (att if a > g else rel)
        d_ds[i] = g
    duck = np.interp(np.arange(N), np.arange(len(d_ds)) * hop, d_ds)
    music *= (1 - duck * (1 - db(-8.0)))[:, None]

    sfx = sfx_bus()
    sfx = sfx + reverb(sfx * 0.3, ir_hall) * 0.35
    sfx *= (1 - duck * (1 - db(-5)))[:, None]

    def lufs(x):
        act = x[np.abs(x).max(1) > 1e-4]
        return meter.integrated_loudness(act)
    lv, lm, ls = lufs(vo2), lufs(music), lufs(sfx)
    print(f"before balance: VO {lv:.1f}  music {lm:.1f}  sfx {ls:.1f}")
    vo2 *= db(-18 - lv)
    music *= db(-29 - lm)
    sfx *= db(-31 - ls)
    mix = np.nan_to_num(vo2 + music + sfx)
    mix = Pedalboard([Compressor(threshold_db=-20, ratio=2.0, attack_ms=15, release_ms=250)])(mix.T.astype(np.float32), SR).T
    for _ in range(3):
        mix = mix * db(-16 - meter.integrated_loudness(mix))
        mix = peak_limit(mix, db(-1.3))
    end = int(TOTAL * SR)
    mix = mix[:end]
    fi = int(0.05 * SR)
    mix[:fi] *= np.linspace(0, 1, fi)[:, None]
    fo = int(1.5 * SR)
    mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 2
    print(f"final {meter.integrated_loudness(mix):.1f} LUFS, peak {20 * np.log10(np.abs(mix).max()):.1f} dBFS")
    sf.write(os.path.join(HERE, "build/mix.wav"), mix, SR, subtype="PCM_24")


if __name__ == "__main__":
    main()
