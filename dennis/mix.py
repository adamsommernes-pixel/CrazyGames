# -*- coding: utf-8 -*-
"""Slutmix: röst + musik (stems) + klippens originalljud + diskreta effekter. Ut: build/mix.wav"""
import ast
import math
import os
import sys
import types

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from pedalboard import Compressor, HighpassFilter, LowShelfFilter, Pedalboard, PeakFilter
from scipy.signal import butter, oaconvolve, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__))
ALAND = os.path.join(os.path.dirname(HERE), "aland")
sys.path.insert(0, HERE)
sys.path.insert(1, ALAND)

from film_d.base import E, S, TOTAL, LINES  # noqa: E402
from film_d.shots import CLIP_FIDDLE, CLIP_SHH, Wt  # noqa: E402

SR = 48000
N = int(TOTAL * SR) + SR


def _borrow(path, names):
    """Lånar DSP-funktioner ur Åland-filmens mixskript utan att köra det."""
    tree = ast.parse(open(path, encoding="utf-8").read())
    keep = [nd for nd in tree.body if isinstance(nd, (ast.FunctionDef, ast.ClassDef)) and nd.name in names]
    mod = types.ModuleType("amix")
    mod.__dict__.update(np=np, math=math, butter=butter, sosfilt=sosfilt, oaconvolve=oaconvolve, SR=SR, N=N,
                        RNG=np.random.default_rng(5))
    exec(compile(ast.Module(body=keep, type_ignores=[]), path, "exec"), mod.__dict__)
    return mod


X = _borrow(os.path.join(ALAND, "audio_mix.py"),
            {"bp", "lp", "hp", "pink", "env_curve", "smooth_noise", "Bus", "db", "make_ir", "reverb", "wind",
             "paper", "thump", "tick", "whoosh", "peak_limit"})
db, lp, hp, bp, env_curve = X.db, X.lp, X.hp, X.bp, X.env_curve


def buzz(dur=0.9):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.sign(np.sin(2 * np.pi * 150 * t)) * 0.5 + np.sin(2 * np.pi * 300 * t) * 0.3
    gate = ((t % 0.45) < 0.32).astype(float)
    y = lp(y, 900) * gate * (1 - np.exp(-t * 60))
    return y / np.abs(y).max()


def pop(f=1100):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * t * (1 + 0.6 * t)) * np.exp(-t * 45)
    return y / np.abs(y).max()


def rain(dur, seed=3):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    out = np.zeros((n, 2))
    for ch in range(2):
        hiss = bp(r.standard_normal(n), 1200, 9000) * 0.5
        drops = np.zeros(n)
        for p in r.integers(0, n - 200, int(dur * 260)):
            L_ = 120
            drops[p:p + L_] += r.standard_normal(L_) * np.exp(-np.arange(L_) / 25) * r.uniform(0.1, 1)
        out[:, ch] = hiss + bp(drops, 2000, 8000) * 0.8
    return out / np.abs(out).max()


def clip_audio(name, t0, target=-19.0):
    y, sr = sf.read(os.path.join(HERE, "build/media", name + ".wav"), always_2d=True)
    assert sr == SR
    meter = pyln.Meter(SR)
    y = y * db(target - meter.integrated_loudness(y))
    f = int(0.06 * SR)
    y[:f] *= np.linspace(0, 1, f)[:, None]
    fo = int(0.35 * SR)
    y[-fo:] *= np.linspace(1, 0, fo)[:, None]
    out = np.zeros((N, 2))
    s = int(t0 * SR)
    out[s:s + len(y)] = y[:N - s]
    return out, len(y) / SR


def build_sfx():
    fx = X.Bus()
    d = 8.5
    amb = np.stack([lp(X.pink(int(d * SR)), 160), lp(X.pink(int(d * SR)), 160)], 1)
    fx.add(0, amb * env_curve(int(d * SR), [(0, 0), (2.5, 1), (6.5, 0.8), (d, 0)])[:, None], db(-20))
    fx.add(0, X.wind(d, seed=2, bright=500) * env_curve(int(d * SR), [(0, 0), (3, 0.6), (d, 0)])[:, None], db(-32))
    for t, dur, s in ((5.9, 1.8, 1), (12.0, 1.6, 2), (S("b1") - 2.4, 2.0, 3), (S("b4") + 1.2, 1.8, 4),
                      (CLIP_FIDDLE - 0.3, 1.2, 5), (S("f4") - 1.5, 2.0, 6)):
        fx.add(t, X.whoosh(dur, seed=s, lo=180, hi=1400), db(-31))
    fx.add(Wt("a4", "mobiltelefon"), buzz(0.9), db(-27), pan=0.1)
    for k in range(3):
        fx.add(LINES["g3"]["sents"][k][0] - 0.1, pop(1000 + 150 * k), db(-30), pan=0.15)
    # regn och vind (e4)
    t0, t1 = S("e4") - 0.2, Wt("e4", "motvind") + 0.6
    d = t1 - t0
    fx.add(t0, rain(d) * env_curve(int(d * SR), [(0, 0), (0.6, 1), (d - 0.8, 1), (d, 0)])[:, None], db(-31))
    tw = Wt("e4", "motvind") - 0.2
    d = E("e4") + 1.4 - tw
    fx.add(tw, X.wind(d, seed=9, bright=1100) * env_curve(int(d * SR), [(0, 0), (0.5, 1), (d, 0)])[:, None], db(-27))
    # hemligt dokument: papper, skrivmaskin, stämpel
    fx.add(S("g7") - 0.5, X.paper(4, 0.7), db(-30))
    g7 = LINES["g7"]["sents"]
    lines = [("PROJEKT: DENNIS", S("g7") + 0.1), ("Film, ca 7 minuter", S("g7") + 0.8),
             ("Regi: Adam", g7[1][0] + 0.2), ("Status: överraskning", g7[1][0] + 1.4)]
    rng = np.random.default_rng(4)
    for ln, t0 in lines:
        for i, ch in enumerate(ln):
            if ch != " ":
                fx.add(t0 + 0.9 * (i + 1) / len(ln), X.tick(rng.random() < 0.5), db(-36 + rng.uniform(-2, 2)),
                       pan=rng.uniform(-0.2, 0.2))
    ts = g7[2][0] + 0.9 + 0.14
    fx.add(ts, X.thump(85, 0.5), db(-17))
    fx.add(ts, X.paper(7, 0.25), db(-24))
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
    ir_hall = X.make_ir(2.6, 3.8, 0.02, 1)
    ir_room = X.make_ir(0.5, 1.0, 0.008, 2)

    gains = {"strings": 0.0, "keys": 6.0, "violin": 1.5, "guitar": 3.0, "choir": 0.0, "perc": -3.0}
    sends = {"strings": 0.32, "keys": 0.3, "violin": 0.3, "guitar": 0.22, "choir": 0.45, "perc": 0.25}
    music_dry = np.zeros((N, 2))
    send_bus = np.zeros((N, 2))
    for k in gains:
        y = load_stem(k) * db(gains[k])
        music_dry += y
        send_bus += y * sends[k]
    music = music_dry + X.reverb(send_bus, ir_hall) * 0.85
    music = Pedalboard([HighpassFilter(30), LowShelfFilter(cutoff_frequency_hz=120, gain_db=1.0),
                        PeakFilter(cutoff_frequency_hz=2600, gain_db=-3.5, q=0.7)])(music.T.astype(np.float32), SR).T.astype(np.float64)

    # röst
    vo, sr = sf.read(os.path.join(HERE, "build/vo_track.wav"))
    v = np.zeros(N)
    v[:min(N, len(vo))] = vo[:min(N, len(vo))]
    vo2 = np.stack([v, v], 1)
    vo2 = vo2 + X.reverb(vo2 * 0.5, ir_room) * 0.18 + X.reverb(vo2 * 0.5, ir_hall) * 0.04

    # ducking under repliker
    hop = 480
    rms = np.sqrt(np.convolve(v ** 2, np.ones(hop) / hop, mode="same"))
    a_ds = (rms > 10 ** (-45 / 20)).astype(np.float64)[::hop]
    d_ds = np.zeros_like(a_ds)
    g = 0.0
    att_d = 1 - math.exp(-hop / (0.15 * SR))
    rel_d = 1 - math.exp(-hop / (1.0 * SR))
    for i, a in enumerate(a_ds):
        g += (a - g) * (att_d if a > g else rel_d)
        d_ds[i] = g
    duck = np.interp(np.arange(N), np.arange(len(d_ds)) * hop, d_ds)
    music *= (1 - duck * (1 - db(-10.0)))[:, None]

    # klippen: Dennis eget spel och "hysch"
    fid, dfid = clip_audio("fiddle", CLIP_FIDDLE, -18.5)
    shh, dshh = clip_audio("shh", CLIP_SHH, -20.0)
    tt = np.arange(N) / SR
    gate = np.ones(N)
    for a, b in ((CLIP_FIDDLE - 0.2, CLIP_FIDDLE + dfid), (CLIP_SHH - 0.25, CLIP_SHH + dshh)):
        gate *= 1 - np.clip((tt - (a - 0.5)) / 0.5, 0, 1) * np.clip(((b + 0.6) - tt) / 0.6, 0, 1)
    music *= gate[:, None]

    sfx = build_sfx()
    sfx = sfx + X.reverb(sfx * 0.3, ir_hall) * 0.35
    sfx *= (1 - duck * (1 - db(-5)))[:, None]

    def lufs(x):
        act = x[np.abs(x).max(1) > 1e-4]
        return meter.integrated_loudness(act)
    lv, lm, ls = lufs(vo2), lufs(music), lufs(sfx)
    print(f"före balans: VO {lv:.1f}  musik {lm:.1f}  sfx {ls:.1f}")
    vo2 *= db(-18 - lv)
    music *= db(-25.0 - lm)
    sfx *= db(-29 - ls)
    mix = vo2 + music + sfx
    mix = Pedalboard([Compressor(threshold_db=-18, ratio=2.0, attack_ms=15, release_ms=250)])(mix.T.astype(np.float32), SR).T
    mix = mix + fid * db(-1.8) + shh
    for _ in range(3):
        lvl = meter.integrated_loudness(mix)
        mix = mix * db(-16 - lvl)
        mix = X.peak_limit(mix, db(-1.3))
    fi = int(0.05 * SR)
    mix[:fi] *= np.linspace(0, 1, fi)[:, None]
    end = int(TOTAL * SR)
    mix = mix[:end]
    fo = int(1.5 * SR)
    mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 2
    print(f"slutnivå {meter.integrated_loudness(mix):.1f} LUFS, topp {20 * np.log10(np.abs(mix).max()):.1f} dBFS")
    sf.write(os.path.join(HERE, "build/mix.wav"), mix, SR, subtype="PCM_24")


if __name__ == "__main__":
    main()
