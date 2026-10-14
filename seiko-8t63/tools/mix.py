"""Build the film soundtrack: narration on the timeline, synthesised mechanical sound effects,
an ambient music bed ducked under the voice, loudness-normalised to -16 LUFS.

Usage: python3 tools/mix.py timeline.json sfx.json out.wav
  timeline.json: window.__timeline() from the page; sfx.json: window.__sfx()
"""
import json, os, sys
import numpy as np
import soundfile as sf
import pyloudnorm as pyln
from scipy.signal import resample_poly, butter, sosfilt

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
rng = np.random.default_rng(8063)


def bp(x, lo, hi, order=2):
    sos = butter(order, [lo, hi], btype='band', fs=SR, output='sos'); return sosfilt(sos, x)
def lp(x, f, order=2):
    sos = butter(order, f, btype='low', fs=SR, output='sos'); return sosfilt(sos, x)
def hp(x, f, order=2):
    sos = butter(order, f, btype='high', fs=SR, output='sos'); return sosfilt(sos, x)
def env(n, attack, decay):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t / decay)


# ── sound effects ──
def ring(freqs, decay, n, amps=None):
    t = np.arange(n) / SR
    amps = amps or [1] * len(freqs)
    return sum(a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t / (decay * (1 - 0.1 * i))) for i, (f, a) in enumerate(zip(freqs, amps)))

def fx_tick(level=0.08, bright=1.0):
    n = int(0.03 * SR)
    noise = rng.standard_normal(n) * env(n, 0.0002, 0.0025)
    body = bp(noise, 2500 * bright, 7000 * bright) * 1.2 + ring([1850 * bright, 3700 * bright], 0.004, n, [0.25, 0.12])
    return body * level

def fx_click(level=0.35):
    n = int(0.09 * SR); out = np.zeros(n)
    for off, g in [(0, 1.0), (0.018, 0.7)]:
        k = int(off * SR); m = n - k
        nz = rng.standard_normal(m) * env(m, 0.0003, 0.004)
        out[k:] += g * (bp(nz, 1500, 6000) + ring([2300, 4100, 6200], 0.012, m, [0.4, 0.25, 0.1]))
    return out * level

def fx_clack(level=0.5, slow=1.0):
    n = int(0.25 * SR)
    nz = rng.standard_normal(n) * env(n, 0.0002, 0.006)
    x = bp(nz, 1200, 9000) * 1.4 + ring([2850, 4320, 6900, 1180], 0.035, n, [0.6, 0.35, 0.2, 0.3]) + lp(rng.standard_normal(n) * env(n, 0.001, 0.02), 400) * 0.6
    x = x * level
    if slow < 0.5:   # slowed-down hit: stretch and lower, like a high-speed camera recording
        f = 6
        x = resample_poly(x, f, 1)[: int(n * f)]
        x = lp(x, 2500) * 1.6
    return x

def fx_snap(level=0.3):
    n = int(0.12 * SR)
    nz = rng.standard_normal(n) * env(n, 0.0002, 0.005)
    return (bp(nz, 2000, 8000) + ring([3100, 5200], 0.02, n, [0.4, 0.2])) * level

def fx_crown(level=0.22):
    n = int(0.06 * SR)
    nz = rng.standard_normal(n) * env(n, 0.0003, 0.004)
    return (bp(nz, 1000, 5000) + ring([1600, 3300], 0.01, n, [0.3, 0.15])) * level

def fx_cut(level=0.05):
    n = int(1.1 * SR); t = np.arange(n) / SR
    sw = np.sin(np.pi * np.clip(t / 1.1, 0, 1)) ** 2
    nz = rng.standard_normal(n)
    x = lp(hp(nz, 300), 2200) * sw
    return x * level

def fx_pulse(level=0.12):   # a stepping-motor pulse heard up close (stage shots)
    return fx_tick(level, 0.8) + fx_tick(level * 0.5, 0.55)

FX = {
    'tickA': lambda e: fx_tick(0.05),
    'tickB': lambda e: fx_tick(0.03, 1.35),
    'click': lambda e: fx_click(0.3),
    'clack': lambda e: fx_clack(0.45, e.get('slow', 1)),
    'snap': lambda e: fx_snap(0.3),
    'crown': lambda e: fx_crown(0.22),
    'cut': lambda e: fx_cut(0.05),
    'pulse': lambda e: fx_pulse(0.12 * e.get('gain', 1)),
    'tick': lambda e: fx_tick(0.06 * e.get('gain', 1)),
}


# ── music bed: slow, warm pad in D minor with a soft sub ──
def music(total):
    n = int(total * SR); t = np.arange(n) / SR
    out = np.zeros((n, 2))
    # chords (MIDI notes), 10 s each
    prog = [[50, 57, 62, 65, 69], [46, 53, 58, 62, 65], [41, 48, 53, 57, 60, 64], [48, 55, 60, 64, 67], [50, 57, 62, 65, 72], [43, 50, 55, 58, 62], [45, 52, 57, 61, 64], [50, 57, 62, 65, 69]]
    seg = 10.0
    for i, chord in enumerate(prog * int(np.ceil(total / (seg * len(prog))) + 1)):
        s0 = i * seg
        if s0 > total: break
        a, b = int(max(0, s0 - 2.5) * SR), int(min(total, s0 + seg + 2.5) * SR)
        if b <= a: continue
        tt = t[a:b] - (s0 - 2.5)
        fade = np.clip(tt / 3.0, 0, 1) * np.clip((seg + 5.0 - tt) / 3.0, 0, 1)
        for j, m in enumerate(chord):
            f = 440 * 2 ** ((m - 69) / 12)
            for side, det in ((0, -0.12), (1, 0.12)):
                ph = rng.uniform(0, 6)
                lfo = 1 + 0.002 * np.sin(2 * np.pi * (0.07 + 0.01 * j) * tt + ph)
                tone = np.sin(2 * np.pi * f * (1 + det / 100) * lfo * tt + ph) + 0.18 * np.sin(2 * np.pi * 2 * f * tt + ph * 2)
                amp = (0.05 if m < 47 else 0.032) * (0.85 + 0.15 * np.sin(2 * np.pi * 0.05 * tt + j))
                out[a:b, side] += tone * amp * fade
    out[:, 0] = lp(out[:, 0], 1800); out[:, 1] = lp(out[:, 1], 1800)
    # gentle fade in/out
    fi = np.clip(t / 4.0, 0, 1); fo = np.clip((total - t) / 6.0, 0, 1)
    out *= (fi * fo)[:, None]
    return out


def main():
    tl = json.load(open(sys.argv[1])); cues = json.load(open(sys.argv[2])); out_path = sys.argv[3]
    total = tl['total'] + 0.5
    n = int(total * SR)
    voice = np.zeros(n)
    meter = pyln.Meter(24000)
    for L in tl['lines']:
        a, sr = sf.read(os.path.join(ROOT, 'audio', 'lines', L['id'] + '.wav'), dtype='float32')
        if a.ndim > 1: a = a.mean(1)
        try:
            a = pyln.normalize.loudness(a, meter.integrated_loudness(a), -19.0)
        except Exception:
            pass
        a = resample_poly(a, SR, sr)
        a = hp(a, 70)
        k = int(L['t0'] * SR); voice[k:k + len(a)] += a[: max(0, n - k)]
    fx = np.zeros(n)
    for e in cues:
        fn = FX.get(e['type'])
        if not fn: continue
        x = fn(e); k = int(e['t'] * SR)
        if k >= n: continue
        fx[k:k + len(x)] += x[: n - k]
    bed = music(total)
    # duck the music under speech
    act = np.abs(voice) > 0.01
    sm = np.convolve(act.astype(float), np.ones(int(0.25 * SR)) / int(0.25 * SR), mode='same')
    duck = 1 - 0.62 * np.clip(sm * 3, 0, 1)
    k = int(0.4 * SR); duck = np.convolve(duck, np.ones(k) / k, mode='same')
    bed *= duck[:, None]
    mix = np.stack([voice + fx * 0.9, voice + fx * 0.9], 1) + bed
    m = pyln.Meter(SR)
    mix = pyln.normalize.loudness(mix, m.integrated_loudness(mix), -16.0)
    peak = np.max(np.abs(mix))
    if peak > 0.89:   # soft limit the rare peaks
        mix = np.tanh(mix / 0.89) * 0.89
    sf.write(out_path, mix.astype(np.float32), SR, subtype='PCM_16')
    print(f'{total:.1f}s, {len(cues)} cues, peak {peak:.2f}, -> {out_path}')


if __name__ == '__main__':
    main()
