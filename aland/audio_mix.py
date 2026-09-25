# -*- coding: utf-8 -*-
"""Ljuddesign + slutmix: röst, musik (stems), effekter. Ut: build/mix.wav"""
import json
import math
import os
import sys

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from pedalboard import Compressor, HighpassFilter, Limiter, LowShelfFilter, Pedalboard, PeakFilter
from scipy.signal import butter, oaconvolve, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
SR = 48000
TL = json.load(open(os.path.join(HERE, "build/timeline.json"), encoding="utf-8"))
L = TL["lines"]
TOTAL = TL["total"]
N = int(TOTAL * SR) + SR
RNG = np.random.default_rng(5)


def S(lid, k=0):
    return L[lid]["sents"][k][0]


def E(lid, k=-1):
    return L[lid]["sents"][k][1]


# --------------------------------------------------------------------------
# DSP-hjälp
# --------------------------------------------------------------------------
def bp(x, lo, hi, order=2):
    sos = butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return sosfilt(sos, x)


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


def env_curve(n, pts):
    """pts: [(sek, nivå)] relativt start -> kurva längd n."""
    t = np.arange(n) / SR
    xs, ys = zip(*pts)
    return np.interp(t, xs, ys)


def smooth_noise(n, rate, seed=0):
    """Långsamt varierande 0..1."""
    r = np.random.default_rng(seed)
    k = max(2, int(n / SR * rate) + 2)
    pts = r.random(k)
    return np.interp(np.arange(n), np.linspace(0, n, k), pts)


class Bus:
    def __init__(self):
        self.x = np.zeros((N, 2), np.float64)

    def add(self, t, sig, gain=1.0, pan=0.0):
        """sig mono eller stereo; pan -1..1."""
        s = int(t * SR)
        if s >= N:
            return
        if sig.ndim == 1:
            l = math.cos((pan + 1) * math.pi / 4)
            r = math.sin((pan + 1) * math.pi / 4)
            sig = np.stack([sig * l, sig * r], 1) * math.sqrt(2)
        e = min(N, s + len(sig))
        a = max(0, s)
        self.x[a:e] += sig[a - s:e - s] * gain


def db(v):
    return 10 ** (v / 20)


# --------------------------------------------------------------------------
# Rum (syntetiskt impulssvar)
# --------------------------------------------------------------------------
def make_ir(rt=2.6, length=3.5, pre=0.018, seed=1):
    r = np.random.default_rng(seed)
    n = int(length * SR)
    t = np.arange(n) / SR
    ir = np.zeros((n, 2))
    bands = [(20, 400, rt * 1.15), (400, 1800, rt), (1800, 6000, rt * 0.7), (6000, 16000, rt * 0.4)]
    for ch in range(2):
        acc = np.zeros(n)
        for lo, hi, T in bands:
            w = r.standard_normal(n)
            acc += bp(w, lo, hi) * np.exp(-6.9 * t / T)
        # tidiga reflexer
        for k in range(10):
            d = int(r.uniform(0.005, 0.06) * SR)
            acc[d] += r.uniform(-0.6, 0.6)
        ir[:, ch] = acc
    ir = np.concatenate([np.zeros((int(pre * SR), 2)), ir])
    ir /= np.sqrt((ir ** 2).sum(0)).max()
    return ir


def reverb(x, ir):
    """x (n,2) -> våt signal (n,2)."""
    out = np.zeros_like(x)
    for ch in range(2):
        out[:, ch] = oaconvolve(x[:, ch], ir[:, ch])[:len(x)]
    return out


# --------------------------------------------------------------------------
# Effektljud
# --------------------------------------------------------------------------
def wind(dur, strength=1.0, seed=0, bright=900):
    n = int(dur * SR)
    out = np.zeros((n, 2))
    for ch in range(2):
        base = lp(pink(n), bright)
        gust = 0.45 + 0.55 * smooth_noise(n, 0.35, seed + ch)
        whistle = bp(RNG.standard_normal(n), 600, 1400) * 0.08 * smooth_noise(n, 0.2, seed + 10 + ch)
        out[:, ch] = (base * gust + whistle) * strength
    return out / (np.abs(out).max() + 1e-9)


def waves(dur, period=(5, 9), seed=0, bright=2200, crash=1.0):
    n = int(dur * SR)
    r = np.random.default_rng(seed)
    out = np.zeros((n, 2))
    rumble = lp(pink(n), 300) * 0.35
    for ch in range(2):
        out[:, ch] += rumble
    t = r.uniform(0, 2)
    while t < dur:
        L_ = r.uniform(2.5, 4.5)
        m = int(L_ * SR)
        tt = np.arange(m) / SR
        e = (1 - np.exp(-tt / r.uniform(0.5, 1.0))) * np.exp(-tt / r.uniform(1.0, 1.8))
        nz = lp(r.standard_normal(m), r.uniform(bright * 0.6, bright)) * e * crash
        s = int(t * SR)
        pan = r.uniform(-0.6, 0.6)
        seg = min(m, n - s)
        out[s:s + seg, 0] += nz[:seg] * (1 - pan) * 0.7
        out[s:s + seg, 1] += nz[:seg] * (1 + pan) * 0.7
        t += r.uniform(*period) * 0.55
    return out / (np.abs(out).max() + 1e-9)


def cannon(distance=1.0, seed=0):
    r = np.random.default_rng(seed)
    n = int(2.2 * SR)
    t = np.arange(n) / SR
    f = 58 * np.exp(-t * 2.5) + 28
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5)
    nz = lp(r.standard_normal(n), 1400) * np.exp(-t * 7) * 0.8
    tail = lp(r.standard_normal(n), 300) * np.exp(-t * 1.6) * 0.35
    y = thump + nz + tail
    y = lp(y, 3000 / distance)
    return y / np.abs(y).max()


def explosion(seed=0, length=5.0):
    r = np.random.default_rng(seed)
    n = int(length * SR)
    t = np.arange(n) / SR
    rum = lp(r.standard_normal(n), 220) * np.exp(-t * 0.9)
    crack = lp(r.standard_normal(n), 3500) * np.exp(-t * 6)
    f = 45 * np.exp(-t * 1.5) + 22
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.2)
    y = rum * 1.4 + crack * 0.6 + sub * 1.2
    return y / np.abs(y).max()


def crackle(dur, rate=40, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    y = np.zeros(n)
    k = r.poisson(rate * dur)
    for p in r.integers(0, n - 400, k):
        L_ = r.integers(30, 300)
        y[p:p + L_] += r.standard_normal(L_) * np.exp(-np.arange(L_) / (L_ / 4)) * r.uniform(0.2, 1)
    y = bp(y, 1500, 7000) + lp(r.standard_normal(n), 500) * 0.15
    return y / (np.abs(y).max() + 1e-9)


def pencil(dur, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    envl = np.zeros(n)
    t = 0.0
    while t < dur:
        L_ = r.uniform(0.08, 0.45)
        s, e = int(t * SR), min(n, int((t + L_) * SR))
        seg = np.sin(np.linspace(0, np.pi, e - s)) ** 0.5 * r.uniform(0.4, 1.0)
        envl[s:e] = np.maximum(envl[s:e], seg)
        t += L_ + r.uniform(0.02, 0.2)
    grain = bp(r.standard_normal(n), 2200, 7500) * (0.7 + 0.3 * bp(r.standard_normal(n), 30, 90) * 10)
    y = grain * envl
    return y / (np.abs(y).max() + 1e-9)


def paper(seed=0, dur=0.6):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    e = np.sin(np.pi * t / dur) ** 1.5
    y = bp(r.standard_normal(n), 900, 6000) * e
    return y / np.abs(y).max()


def thump(f=70, dur=0.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * t * (1 - 0.3 * t)) * np.exp(-t * 12) + lp(RNG.standard_normal(n), 800) * np.exp(-t * 30) * 0.4
    return y / np.abs(y).max()


def tick(high=True):
    n = int(0.08 * SR)
    t = np.arange(n) / SR
    f = 2600 if high else 2100
    y = np.sin(2 * np.pi * f * t) * np.exp(-t * 90) + RNG.standard_normal(n) * np.exp(-t * 600) * 0.5
    y += np.sin(2 * np.pi * 900 * t) * np.exp(-t * 60) * 0.3
    return y / np.abs(y).max()


def flap(dur, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    rate = 2.6 + 0.6 * smooth_noise(n, 0.5, seed)
    ph = np.cumsum(rate) / SR
    e = np.clip(np.sin(2 * np.pi * ph), 0, 1) ** 3
    y = bp(r.standard_normal(n), 250, 2500) * (0.25 + e)
    return y / np.abs(y).max()


def bell(f=392, dur=6.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for k, (m, a, d) in enumerate(((0.5, 0.5, 1.2), (1, 1, 1.6), (1.19, 0.5, 2.2), (1.56, 0.35, 2.8),
                                   (2.0, 0.4, 3.2), (2.51, 0.25, 4.0), (3.0, 0.15, 5.0))):
        y += a * np.sin(2 * np.pi * f * m * t + k) * np.exp(-t * d)
    y *= (1 - np.exp(-t * 400))
    return lp(y / np.abs(y).max(), 3500)


def whoosh(dur=1.4, seed=0, lo=250, hi=1800):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = r.standard_normal(n)
    out = np.zeros(n)
    blk = 1024
    for i in range(0, n, blk):
        u = i / n
        fc = lo + (hi - lo) * math.sin(math.pi * u) ** 1.2
        seg = x[max(0, i - 256):i + blk]
        yy = bp(seg, fc * 0.7, min(fc * 1.4, 20000))
        out[i:i + blk] = yy[-(min(blk, n - i)):]
    e = np.sin(np.pi * t / dur) ** 2
    y = out * e
    return y / (np.abs(y).max() + 1e-9)


def sub_boom(dur=3.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 52 * np.exp(-t * 1.2) + 26
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.4) * (1 - np.exp(-t * 200))
    y += lp(RNG.standard_normal(n), 180) * np.exp(-t * 2.5) * 0.4
    return y / np.abs(y).max()


def ice_crack(seed=0):
    r = np.random.default_rng(seed)
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for k in range(r.integers(4, 9)):
        p = int(r.uniform(0, 0.3) * SR)
        L_ = int(0.02 * SR)
        y[p:p + L_] += r.standard_normal(L_) * np.exp(-np.arange(L_) / 200)
    y = bp(y, 800, 6000) * 0.8 + lp(r.standard_normal(n), 120) * np.exp(-t * 4) * 0.6
    f = r.uniform(300, 700)
    y += np.sin(2 * np.pi * f * t * (1 - 0.4 * t)) * np.exp(-t * 18) * 0.3
    return y / np.abs(y).max()


def splash(seed=0):
    r = np.random.default_rng(seed)
    n = int(0.7 * SR)
    t = np.arange(n) / SR
    y = bp(r.standard_normal(n), 400, 4000) * np.exp(-t * 8) * (1 - np.exp(-t * 80))
    return y / np.abs(y).max()


# --------------------------------------------------------------------------
def build_sfx():
    fx = Bus()
    # öppning: vind och hav
    d = E("o4") + 3.0
    w = wind(d, seed=1, bright=700) * env_curve(int(d * SR), [(0, 0), (2.5, 1), (d - 3.0, 0.8), (d, 0)])[:, None]
    fx.add(0, w, db(-24))
    wv = waves(d, seed=2, bright=1600) * env_curve(int(d * SR), [(0, 0), (3, 1), (d - 2, 0.7), (d, 0)])[:, None]
    fx.add(0, wv, db(-28))
    t_title = E("o4") + 0.9
    fx.add(t_title, sub_boom(4.0), db(-12))
    fx.add(t_title - 1.4, whoosh(1.5, 3, 150, 900), db(-26))
    # is + landhöjning
    d = S("a3") - S("a1") + 1
    fx.add(S("a1") - 0.5, wind(d, seed=4, bright=500) * env_curve(int(d * SR), [(0, 0), (1.5, 1), (d - 2, 0.6), (d, 0)])[:, None], db(-27))
    for k, tt in enumerate(np.linspace(S("a2") - 0.1, S("a2") + 2.4, 6)):
        fx.add(tt + RNG.uniform(-0.1, 0.1), ice_crack(k), db(-24 - k), pan=RNG.uniform(-0.7, 0.7))
    # strand
    d = E("a3") - S("a3") + 1.5
    fx.add(S("a3") - 0.3, waves(d, (3, 5), seed=5, bright=2500, crash=0.6) * env_curve(int(d * SR), [(0, 0), (0.8, 1), (d - 1, 1), (d, 0)])[:, None], db(-30))
    # hav i skymning
    d = E("a5") + 2.0 - E("a4")
    k = int(d * SR)
    fx.add(E("a4"), waves(d, seed=6, bright=1800) * env_curve(k, [(0, 0), (1, 0.8), (S("a5", 1) - E("a4"), 0.8), (S("a5", 1) - E("a4") + 1.5, 1.0), (d, 0)])[:, None], db(-24))
    fx.add(E("a4"), wind(d, seed=7, bright=600) * env_curve(k, [(0, 0), (S("a5", 1) - E("a4"), 0.3), (S("a5", 1) - E("a4") + 1.5, 1.0), (d, 0)])[:, None], db(-28))
    # ritljud
    for i, (a, b) in enumerate(((S("b3") - 0.2, E("b3") - 0.2), (S("b4") + 0.2, S("b4", 1) + 0.4), (S("b4", 1) + 0.2, E("b4") - 0.4),
                                (S("e2") - 0.2, E("e2") + 0.4), (S("e3") - 0.1, E("e3") + 0.4), (S("e5") + 0.2, E("e5") - 1.8),
                                (S("f6") - 0.3, E("f6") + 0.4), (S("h4") - 0.3, E("h4")),
                                (S("e8") + 0.3, E("e8") - 0.5), (S("g2", 1) - 0.3, E("g2") + 0.2))):
        fx.add(a, pencil(b - a, i), db(-34), pan=RNG.uniform(-0.3, 0.3))
    # postrodden: storm
    ts, te = S("c2") - 0.6, E("c3") + 2.3
    d = te - ts
    k = int(d * SR)
    fx.add(ts, wind(d, seed=8, bright=1400) * env_curve(k, [(0, 0), (0.6, 1), (S("c3") - ts, 1), (d - 1, 0.4), (d, 0)])[:, None], db(-17))
    fx.add(ts, waves(d, (3, 6), seed=9, bright=2600, crash=1.3) * env_curve(k, [(0, 0), (0.6, 1), (S("c3") - ts, 1), (d - 1, 0.5), (d, 0)])[:, None], db(-19))
    t = ts + 0.3
    i = 0
    while t < S("c3"):
        fx.add(t, splash(i), db(-30), pan=-0.1)
        t += 2 * math.pi / 2.6
        i += 1
    # 1714
    fx.add(S("d1") - 0.2, sub_boom(3.5), db(-13))
    # flykt / eldar
    d = E("d4") + 0.6 - (S("d3") - 0.4)
    fx.add(S("d3") - 0.4, crackle(d, 55, 3) * env_curve(int(d * SR), [(0, 0), (1.5, 1), (d - 1, 0.7), (d, 0)]), db(-27))
    fx.add(S("d3") - 0.4, wind(d, seed=11, bright=500) * env_curve(int(d * SR), [(0, 0), (1, 1), (d, 0)])[:, None], db(-30))
    fx.add(S("d4") - 0.1, sub_boom(3.0), db(-16))
    # zoom-sus
    for tt in (S("e1") - 0.5, S("f1") - 0.4):
        fx.add(tt, whoosh(1.8, int(tt), 200, 1400), db(-30))
    # bombardemanget
    from film.shots import _bombard_events
    ships, ev = _bombard_events()
    for i, (te_, (sx, sy), (tx, ty), kk) in enumerate(ev):
        fx.add(te_, cannon(1.8, i), db(-20), pan=(sx - 960) / 1200)
        fx.add(te_ + 0.7, cannon(1.0, i + 100) * 0.7, db(-18 + 4 * (kk - 0.8)), pan=(tx - 960) / 1200)
    boom = S("e7", 1) + 0.25
    fx.add(boom, explosion(7, 6.0), db(-7))
    fx.add(boom, sub_boom(5.0), db(-10))
    d = E("e7") + 3 - boom
    fx.add(boom + 0.5, crackle(d, 25, 9) * env_curve(int(d * SR), [(0, 1), (d, 0)]), db(-32))
    # fördraget
    fx.add(S("e8") - 0.5, paper(1, 0.8), db(-28))
    fx.add(E("e8") - 0.5, thump(80, 0.6), db(-18))
    # Mariehamn: avlägsen skeppsklocka
    fx.add(S("f1") + 1.5, bell(392), db(-30), pan=0.4)
    fx.add(S("f1") + 3.9, bell(392), db(-33), pan=0.4)
    # solnedgång: stilla hav
    d = E("f3") + 0.5 - (S("f2") - 0.5)
    fx.add(S("f2") - 0.5, waves(d, (4, 7), seed=12, bright=1400, crash=0.5) * env_curve(int(d * SR), [(0, 0), (1, 1), (d - 1, 1), (d, 0)])[:, None], db(-29))
    fx.add(S("f5"), bell(440, 5), db(-34), pan=-0.3)
    # uppropet
    fx.add(S("g2") - 0.4, paper(3, 0.9), db(-28))
    # klockan tickar
    t = S("g4") - 0.4
    k = 0
    while t < S("g5") - 0.1:
        fx.add(t, tick(k % 2 == 0), db(-26 if k % 2 == 0 else -28))
        t += 0.5
        k += 1
    fx.add(S("g5") - 0.1, sub_boom(3.0), db(-15))
    # flaggan
    d = Wt_frim() - S("h1") + 0.6
    fx.add(S("h1") - 0.5, flap(d, 4) * env_curve(int(d * SR), [(0, 0), (0.6, 1), (d - 0.4, 1), (d, 0)]), db(-26))
    fx.add(S("h1") - 0.5, wind(d, seed=14, bright=900) * env_curve(int(d * SR), [(0, 0), (0.6, 1), (d, 0)])[:, None], db(-30))
    fx.add(Wt_frim() - 0.1, paper(5, 0.5), db(-30))
    # skärgård + segel
    d = E("h3") + 0.6 - (S("h2") - 0.4)
    fx.add(S("h2") - 0.4, waves(d, (5, 8), seed=15, bright=1500, crash=0.4) * env_curve(int(d * SR), [(0, 0), (1.5, 0.6), (S("h3", 1) - S("h2"), 1), (d, 0)])[:, None], db(-30))
    # final
    d = TOTAL - S("h6")
    fx.add(S("h6") - 0.5, wind(d, seed=16, bright=600) * env_curve(int(d * SR), [(0, 0), (2, 0.7), (d - 4, 0.6), (d, 0)])[:, None], db(-32))
    fx.add(S("h6") - 0.5, waves(d, seed=17, bright=1200, crash=0.5) * env_curve(int(d * SR), [(0, 0), (2, 0.6), (d - 4, 0.5), (d, 0)])[:, None], db(-33))
    return fx.x


def Wt_frim():
    from film.shots import Wt
    return Wt("h1", "frimärken")


def load_stem(name):
    y, sr = sf.read(os.path.join(HERE, "build/music", name + ".wav"), always_2d=True)
    assert sr == SR
    out = np.zeros((N, 2))
    m = min(N, len(y))
    out[:m] = y[:m]
    return out


def peak_limit(x, ceiling, look=0.004, release=0.12):
    """Enkel lookahead-toppbegränsare."""
    from scipy.ndimage import maximum_filter1d, uniform_filter1d
    pk = np.abs(x).max(1)
    need = np.minimum(1.0, ceiling / np.maximum(pk, 1e-9))
    w = int(look * SR)
    g = -maximum_filter1d(-need, size=2 * w + 1)   # lokalt minimum
    blk = 48
    gd = g[::blk].copy()
    a = math.exp(-blk / (release * SR))
    for i in range(1, len(gd)):
        if gd[i] > gd[i - 1]:
            gd[i] = gd[i - 1] * a + gd[i] * (1 - a)
    gs = np.interp(np.arange(len(g)), np.arange(len(gd)) * blk, gd)
    gs = np.minimum(gs, g)
    gs = uniform_filter1d(gs, w)
    y = x * gs[:, None]
    return np.clip(y, -ceiling, ceiling)


def main():
    meter = pyln.Meter(SR)
    ir_hall = make_ir(2.8, 4.0, 0.022, 1)
    ir_room = make_ir(0.55, 1.0, 0.008, 2)

    # --- musik ---
    # fasta relativa nivåer (fluidsynths GM-balans + medvetna val)
    gains = {"strings": 0.0, "brass": -3.0, "choir": 3.0, "piano": 9.0, "harp": 5.0, "perc": -1.5}
    sends = {"strings": 0.32, "brass": 0.3, "choir": 0.45, "piano": 0.35, "harp": 0.4, "perc": 0.22}
    stems = {k: load_stem(k) for k in gains}
    # normalisera varje stem till en referensnivå innan relativ balans
    music_dry = np.zeros((N, 2))
    send_bus = np.zeros((N, 2))
    for k, y in stems.items():
        g = db(gains[k])
        y = y * g
        act = y[np.abs(y).max(1) > 1e-4]
        lvl = meter.integrated_loudness(act) if len(act) > SR else -99
        music_dry += y
        send_bus += y * sends[k]
        print(f"stem {k}: {lvl:.1f} LUFS -> gain {20 * np.log10(g):.1f} dB")
    music = music_dry + reverb(send_bus, ir_hall) * 0.9
    music = Pedalboard([HighpassFilter(30), LowShelfFilter(cutoff_frequency_hz=120, gain_db=1.5),
                        PeakFilter(cutoff_frequency_hz=2500, gain_db=-4.5, q=0.7)])(music.T.astype(np.float32), SR).T.astype(np.float64)

    # --- nivåutjämning av musiken (långsam "gain riding") ---
    mono = hp(music.mean(1), 80)
    win = int(0.4 * SR)
    nwin = len(mono) // win
    r = np.sqrt((mono[:nwin * win].reshape(nwin, win) ** 2).mean(1) + 1e-12)
    lv = 20 * np.log10(r)
    from scipy.ndimage import uniform_filter1d
    lv_s = uniform_filter1d(lv, 4)
    ref = np.percentile(lv_s[lv_s > lv_s.max() - 50], 60)
    gdb = np.clip((ref - lv_s) * 0.55, -10, 8)
    gdb[lv_s < ref - 35] = 0          # rör inte tystnad
    gdb = uniform_filter1d(gdb, 5)
    gcurve = np.interp(np.arange(N), (np.arange(nwin) + 0.5) * win, gdb)
    music *= db(gcurve)[:, None]

    # --- röst ---
    vo, sr = sf.read(os.path.join(HERE, "build/vo_track.wav"))
    assert sr == SR
    v = np.zeros(N)
    v[:min(N, len(vo))] = vo[:min(N, len(vo))]
    vo2 = np.stack([v, v], 1)
    vo2 = vo2 + reverb(vo2 * 0.5, ir_room) * 0.22 + reverb(vo2 * 0.5, ir_hall) * 0.05

    # --- ducking: musik sänks under repliker ---
    hop = 480
    rms = np.sqrt(np.convolve(v ** 2, np.ones(hop) / hop, mode="same"))
    active = (rms > 10 ** (-45 / 20)).astype(np.float64)
    # utjämna: snabb attack, långsam release, och "håll" över korta pauser
    duck = np.zeros(N)
    g = 0.0
    att = 1 - math.exp(-1 / (0.12 * SR))
    rel = 1 - math.exp(-1 / (0.9 * SR))
    # nedsampla för fart
    a_ds = active[::hop]
    d_ds = np.zeros_like(a_ds)
    att_d = 1 - math.exp(-hop / (0.12 * SR))
    rel_d = 1 - math.exp(-hop / (0.9 * SR))
    for i, a in enumerate(a_ds):
        g += (a - g) * (att_d if a > g else rel_d)
        d_ds[i] = g
    duck = np.interp(np.arange(N), np.arange(len(d_ds)) * hop, d_ds)
    music *= (1 - duck * (1 - db(-12.0)))[:, None]

    # --- effekter ---
    sfx = build_sfx()
    sfx = sfx + reverb(sfx * 0.3, ir_hall) * 0.4
    sfx *= (1 - duck * (1 - db(-6)))[:, None]

    # --- balans ---
    def lufs(x):
        act = x[np.abs(x).max(1) > 1e-4]
        return meter.integrated_loudness(act)
    lv, lm, ls = lufs(vo2), lufs(music), lufs(sfx)
    print(f"före balans: VO {lv:.1f}  musik {lm:.1f}  sfx {ls:.1f}")
    vo2 *= db(-18 - lv)
    music *= db(-25.5 - lm)
    sfx *= db(-27 - ls)
    mix = vo2 + music + sfx
    mix = Pedalboard([Compressor(threshold_db=-18, ratio=2.0, attack_ms=15, release_ms=250)])(mix.T.astype(np.float32), SR).T
    for _ in range(3):
        lvl = meter.integrated_loudness(mix)
        mix = mix * db(-16 - lvl)
        mix = peak_limit(mix, db(-1.3))
    # in/uttoning
    fi = int(0.05 * SR)
    mix[:fi] *= np.linspace(0, 1, fi)[:, None]
    fo = int(1.2 * SR)
    end = int(TOTAL * SR)
    mix = mix[:end]
    mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 2
    print(f"slutnivå {meter.integrated_loudness(mix):.1f} LUFS, topp {20 * np.log10(np.abs(mix).max()):.1f} dBFS")
    sf.write(os.path.join(HERE, "build/mix.wav"), mix, SR, subtype="PCM_24")
    # stems för kontroll
    sf.write(os.path.join(HERE, "build/music_bus.wav"), (music / (np.abs(music).max() + 1e-9) * 0.8)[:end], SR, subtype="PCM_16")


if __name__ == "__main__":
    main()
