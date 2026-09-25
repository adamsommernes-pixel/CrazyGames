# -*- coding: utf-8 -*-
"""Originalmusik till "Dennis": ett valstema (fiol) med gitarr, piano och stråkar.

Komponerad i kod mot tidslinjen och renderad med fluidsynth. Ut: build/music/<stem>.wav
"""
import json
import os
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))


def _borrow(path, names):
    """Lånar funktioner/klasser/konstanter ur Åland-filmens musikskript utan att köra det."""
    import ast
    import types
    src = open(path, encoding="utf-8").read()
    tree = ast.parse(src)
    keep = [nd for nd in tree.body if (isinstance(nd, (ast.FunctionDef, ast.ClassDef)) and nd.name in names)
            or (isinstance(nd, ast.Assign) and any(getattr(tg, "id", None) in names for tg in nd.targets))]
    mod = types.ModuleType("am")
    mod.__dict__.update(np=np, mido=__import__("mido"), RNG=np.random.default_rng(21), TPB=960)
    exec(compile(ast.Module(body=keep, type_ignores=[]), path, "exec"), mod.__dict__)
    return mod


AM = _borrow(os.path.join(os.path.dirname(HERE), "aland", "audio_music.py"),
             {"NOTE", "n", "CH", "Track", "write_midi", "SF2", "TPB"})

OUT = os.path.join(HERE, "build/music")
SF2 = AM.SF2
TL = json.load(open(os.path.join(HERE, "build/timeline.json"), encoding="utf-8"))
L = TL["lines"]
TOTAL = TL["total"]
CLIP_FIDDLE, CLIP_FIDDLE_END = 249.2, 249.2 + 13.56
CLIP_SHH = 327.35
n = AM.n
Track = AM.Track
AM.RNG = np.random.default_rng(21)


def S(lid, k=0):
    return L[lid]["sents"][k][0]


def E(lid, k=-1):
    return L[lid]["sents"][k][1]


CH = dict(AM.CH)
CH.update({
    "F#m": ("F#1", "C#2 F#2", "C#4 F#4 A4"),
    "A/C#": ("C#2", "A2 E3", "C#4 E4 A4"),
    "Em7": ("E2", "B2 D3", "G4 B4 D5"),
    "Gmaj7": ("G1", "D2 G2", "B3 D4 F#4"),
    "D/A": ("A1", "D2 A2", "F#4 A4 D5"),
    "Bm7": ("B1", "F#2 A2", "D4 F#4 A4"),
    "Esus": ("E2", "B2 E3", "A4 B4 E5"),
})


def voicing(name):
    b, lo, hi = CH[name]
    return n(b), [n(x) for x in lo.split()], [n(x) for x in hi.split()]


# --------------------------------------------------------------------------
STR = Track(49, 0)        # stråkar, långsamma
CELLO = Track(42, 1)
BASS = Track(43, 2)
PIZZ = Track(45, 3)
TREM = Track(44, 4)
PIANO = Track(0, 0, vol=96)
CELESTA = Track(8, 1, vol=86)
HARP = Track(46, 2, vol=92)
GLOCK = Track(9, 3, vol=70)
VIOLIN = Track(40, 0, vol=104)
GTR = Track(24, 0, vol=110)
OOHS = Track(53, 0, vol=90)
TIMP = Track(47, 0, vol=90)

STEMS = {
    "strings": [STR, CELLO, BASS, PIZZ, TREM],
    "keys": [PIANO, CELESTA, HARP, GLOCK],
    "violin": [VIOLIN],
    "guitar": [GTR],
    "choir": [OOHS],
    "perc": [TIMP],
}

# Valstema (3/4): (not, slag)
THEME = [("A4", 1), ("D5", 1), ("F#5", 1), ("E5", 2), ("D5", 1), ("B4", 1), ("A4", 1), ("F#4", 1), ("A4", 3),
         ("G4", 1), ("B4", 1), ("E5", 1), ("D5", 2), ("C#5", 1), ("B4", 1), ("A4", 1), ("C#5", 1), ("D5", 3)]
THEME_CH = ["D", "A/C#", "Bm", "F#m", "G", "D/F#", "Em7", "D"]
THEME2 = [("F#5", 1), ("E5", 1), ("D5", 1), ("B4", 2), ("A4", 1), ("G4", 1), ("B4", 1), ("D5", 1), ("C#5", 3),
          ("B4", 1), ("G4", 1), ("E4", 1), ("A4", 2), ("F#4", 1), ("G4", 1.5), ("E4", 0.5), ("C#4", 1), ("D4", 3)]
THEME2_CH = ["D", "G", "Em7", "A", "G", "D/F#", "Em7", "D"]


def pad(prog, v=56, hi=True, lo=True, bass=True, legato=0.3, tr=(None, None, None)):
    th, tl, tb = tr[0] or STR, tr[1] or CELLO, tr[2] or BASS
    for (t0, c), (t1, _) in zip(prog[:-1], prog[1:]):
        if c is None:
            continue
        b, low, high = voicing(c)
        d = t1 - t0 + legato
        if bass:
            tb.note(t0, d, b + 12 if b < n("E1") else b, v)
        if lo:
            tl.chord(t0, d, low, v)
        if hi:
            th.chord(t0, d, high, v - 6)


def bars(t0, chords, bar):
    return [(t0 + i * bar, c) for i, c in enumerate(chords)] + [(t0 + len(chords) * bar, None)]


def melody(tr, t0, seq, v=70, beat=0.68, transpose=0, legato=1.03):
    t = t0
    for i, (nt, d) in enumerate(seq):
        if nt is not None:
            acc = 6 if i % 3 == 0 else 0
            tr.note(t, d * beat * legato, n(nt) + transpose, v + acc)
        t += d * beat
    return t


def waltz(tr, prog, beat, v=58, bass_tr=None):
    """Bas på ettan, ackord på två och tre."""
    for (t0, c), (t1, _) in zip(prog[:-1], prog[1:]):
        if c is None:
            continue
        b, low, high = voicing(c)
        t = t0
        k = 0
        while t < t1 - 1e-3:
            if k % 3 == 0:
                (bass_tr or tr).note(t, beat * 1.6, (low[0] if low[0] < n("C3") else low[0] - 12), v + 6)
            else:
                tr.chord(t, beat * 0.9, [p - 12 for p in high], v - 4, roll=0.012)
            t += beat
            k += 1


def arp(tr, prog, step, v=44, pattern=(0, 1, 2, 3, 2, 1), octave=0):
    for (t0, c), (t1, _) in zip(prog[:-1], prog[1:]):
        if c is None:
            continue
        b, low, high = voicing(c)
        pool = sorted([low[-1]] + high)
        t, i = t0, 0
        while t < t1 - 1e-3:
            tr.note(t, step * 2.2, pool[pattern[i % len(pattern)] % len(pool)] + 12 * octave,
                    v + (6 if i % len(pattern) == 0 else 0))
            t += step
            i += 1


def compose():
    B = 0.68            # slag (valstempo ~88)
    BAR = 3 * B

    # ---------------- Kall öppning ------------------------------------------
    t0 = 0.3
    prog = [(t0, "Bm"), (5.6, "G"), (10.2, "D/F#"), (14.6, "Esus"), (S("o3", 1) - 0.1, "D"), (E("o3") + 0.8, None)]
    pad(prog, v=52)
    STR.expr([(0, 0), (4, 55), (12, 75), (S("o3", 1), 90), (E("o3") + 0.8, 60)])
    CELLO.expr([(0, 0), (3, 60), (E("o3") + 0.8, 70)])
    rng = np.random.default_rng(3)
    for k in range(18):  # små ljuspunkter = celesta
        t = S("o3") + 0.2 + k * 0.17 + rng.uniform(0, 0.1)
        CELESTA.note(t, 1.2, n(rng.choice(["F#5", "A5", "D6", "E6", "B5", "F#6"])), 32 + rng.integers(0, 16))
    PIANO.pedal(S("o3", 1) - 0.3, True)
    PIANO.note(S("o3", 1) + 0.2, 4.0, n("D5"), 52)
    PIANO.note(S("o3", 1) + 0.2, 4.0, n("D4"), 40)
    PIANO.pedal(E("o3") + 2.0, False)

    # ---------------- Titel: fiolen presenterar temat -----------------------
    tt = E("o3") + 0.6
    tp = bars(tt, ["D", "A/C#", "Bm", "F#m"], BAR)
    pad(tp, v=46, hi=False)
    arp(HARP, tp, B / 2, v=40)
    melody(VIOLIN, tt, THEME[:9], v=70, beat=B)
    VIOLIN.expr([(tt, 60), (tt + 3, 95), (tt + 4 * BAR, 70)])
    t1 = tt + 4 * BAR          # ≈ steps

    # ---------------- I. Ålänningen -----------------------------------------
    ta = t1
    seq = ["G", "D/F#", "Em7", "A", "D", "A/C#", "Bm", "G", "D", "A", "G", "D", "Em7", "A"]
    prog = bars(ta, seq, BAR)
    prog = [p for p in prog if p[0] < S("a4") - 0.3] + [(S("a4") - 0.3, None)]
    arp(PIANO, prog, B / 2, v=42)
    PIANO.pedal(ta, True)
    pad(prog, v=44, hi=False)
    STR.expr([(ta, 40), (S("a3"), 60), (S("a4"), 40)])
    melody(CELLO, S("a2"), THEME[9:], v=58, beat=B, transpose=-12)
    # komisk vändning: mobiltelefonen
    PIANO.pedal(S("a4") - 0.35, False)
    tq = S("a4") + 0.4
    PIZZ.note(tq, 0.3, n("D4"), 58)
    for i, nt in enumerate(["A4", "G4", "E4", "C#4"]):
        PIZZ.note(E("a4") - 0.8 + i * 0.22, 0.3, n(nt), 60 - i * 4)
    CELESTA.note(E("a4") + 0.3, 1.2, n("G#5"), 44)
    CELESTA.note(E("a4") + 0.3, 1.2, n("D6"), 36)

    # ---------------- II. Västerut ------------------------------------------
    tb = S("b1") - 1.6
    seq = ["Bm", "G", "D", "A", "Bm", "G", "Em7", "F#m", "Bm", "G"]
    prog = bars(tb, seq, BAR * 1.35)
    prog = [p for p in prog if p[0] < S("b4") - 0.2] + [(S("b4") - 0.2, None)]
    pad(prog, v=50)
    STR.expr([(tb, 20), (S("b1") + 2, 70), (S("b3"), 50), (S("b4"), 60)])
    melody(CELLO, S("b1") + 0.5, [("B3", 2), ("F#3", 1), ("G3", 2), ("A3", 1), ("B3", 3), ("D4", 3), ("C#4", 2), ("A3", 1), ("B3", 3)],
           v=60, beat=B * 1.3)
    for i, t in enumerate(np.arange(S("b3") - 0.3, S("b4") - 0.3, BAR * 1.35 / 2)):
        PIANO.note(t, 2.0, n(["F#5", "D5", "B4", "D5", "A4", "B4", "F#5", "E5"][i % 8]), 36)
    th = S("b4") - 0.2
    prog = [(th, "G"), (th + 2.4, "A"), (E("b4") + 0.2, "D"), (S("c1") + 1.2, None)]
    pad(prog, v=54)
    melody(VIOLIN, th + 0.2, [("B4", 1), ("A4", 1), ("G4", 1), ("A4", 2), ("F#4", 1), ("D5", 4)], v=58, beat=B * 1.1)
    STR.expr([(th, 50), (E("b4"), 80), (S("c1") + 1.2, 40)])

    # ---------------- III. Arbetet ------------------------------------------
    tc = S("c1") - 0.2
    seq = ["D", "A/C#", "Bm", "G"] * 3 + ["Em7", "G", "A", "A", "D", "A/C#", "Bm", "G", "Em7", "A"]
    prog = bars(tc, seq, BAR)
    prog = [p for p in prog if p[0] < S("c6") - 0.3] + [(S("c6") - 0.3, None)]
    arp(PIANO, prog, B / 2, v=40, pattern=(0, 2, 1, 3, 2, 1))
    PIANO.pedal(tc, True)
    pad(prog, v=46, hi=True)
    STR.expr([(tc, 25), (S("c2"), 45), (S("c3"), 55), (S("c4"), 72), (S("c5"), 80), (S("c5", 2), 70), (S("c6"), 55)])
    melody(VIOLIN, S("c4") - 0.3, THEME, v=58, beat=B)
    VIOLIN.expr([(S("c4") - 0.3, 55), (S("c5"), 85), (S("c6"), 60)])
    PIANO.pedal(S("c6") - 0.35, False)
    tr_ = S("c6") - 0.3
    prog = [(tr_, "G"), (tr_ + BAR, "D/F#"), (tr_ + 2 * BAR, "Em7"), (E("c6") + 0.4, "D"), (S("d1") - 0.2, None)]
    pad(prog, v=46)
    PIANO.pedal(tr_, True)
    melody(PIANO, tr_ + 0.1, [("D5", 1), ("B4", 1), ("A4", 1), ("G4", 1.5), ("F#4", 1.5), ("E4", 1), ("F#4", 2), ("D4", 3)], v=40, beat=B)
    PIANO.pedal(S("d1") - 0.4, False)

    # ---------------- IV. Familjen ------------------------------------------
    td = S("d1") - 0.3
    prog = bars(td, THEME_CH + THEME2_CH + THEME_CH, BAR * 1.08)
    prog = [p for p in prog if p[0] < S("d6") - 0.1] + [(S("d6") - 0.1, None)]
    waltz(GTR, prog, B * 1.08, v=52)
    pad(prog, v=42, bass=False)
    arp(HARP, prog, B * 1.08 / 2, v=34, pattern=(0, 1, 2, 3))
    melody(CELLO, td + 0.2, THEME, v=56, beat=B * 1.08, transpose=-12)
    melody(VIOLIN, td + 0.2 + 8 * BAR * 1.08, THEME2, v=62, beat=B * 1.08)
    VIOLIN.expr([(td, 60), (S("d4"), 80), (S("d5"), 92), (S("d6"), 60)])
    STR.expr([(td, 30), (S("d3"), 50), (S("d5"), 72), (S("d6"), 40)])
    # Napso: lekfull pizzicato + klockspel
    tn = S("d6") - 0.1
    prog = [(tn, "G"), (tn + 2.0, "A"), (S("d7") - 0.1, "D"), (S("d8") - 0.1, "G"), (S("d8", 1) - 0.1, "A"), (E("d8") + 1.8, None)]
    pad(prog, v=38, hi=False)
    t = tn
    k = 0
    while t < E("d8") + 1.5:
        fast = t > S("d8", 1) - 0.1
        nt = ["D4", "F#4", "A4", "F#4", "G4", "B4", "D5", "B4"][k % 8]
        PIZZ.note(t, 0.25, n(nt), 50 + (8 if k % 2 == 0 else 0))
        t += 0.3 if not fast else 0.17
        k += 1
    GLOCK.note(S("d7") + 0.1, 1.5, n("A5"), 58)
    GLOCK.note(S("d7") + 0.1, 1.5, n("D6"), 50)

    # ---------------- V. Flocken --------------------------------------------
    te = S("e1") - 1.4
    seq = ["Bm", "G", "D", "A", "Bm", "G", "D", "A", "Em7", "G", "D", "A", "Bm", "G", "D", "A", "G", "A"]
    prog = bars(te, seq, BAR)
    prog = [p for p in prog if p[0] < S("e5") - 0.2] + [(S("e5") - 0.2, None)]
    pad(prog, v=50)
    t = S("e1", 1) - 0.4
    k = 0
    while t < S("e5") - 0.2:
        c = [c for (tc_, c) in prog[:-1] if tc_ <= t][-1]
        root = voicing(c)[1][0]
        v = 44 if not (S("e4") - 0.2 < t < E("e4") + 0.5) else 34
        PIZZ.note(t, 0.2, root + (12 if k % 4 == 2 else 0), v + (8 if k % 2 == 0 else 0))
        t += B / 2
        k += 1
    melody(CELLO, S("e2"), [("B3", 3), ("D4", 3), ("F#4", 3), ("E4", 3), ("D4", 3), ("C#4", 3), ("B3", 6)], v=56, beat=B)
    melody(VIOLIN, S("e3", 1) - 0.2, [("F#5", 2), ("E5", 1), ("D5", 2), ("C#5", 1), ("B4", 2), ("A4", 1), ("B4", 3),
                                       ("D5", 2), ("E5", 1), ("F#5", 3)], v=58, beat=B)
    STR.expr([(te, 20), (S("e2"), 50), (S("e3", 1), 75), (S("e4"), 55), (S("e5") - 0.2, 70)])
    TREM.chord(S("e4") - 0.2, E("e4") - S("e4") + 0.6, [n("B3"), n("F#4")], 40)
    TREM.expr([(S("e4") - 0.2, 0), (S("e4") + 1.5, 60), (E("e4") + 0.4, 0)])
    tv = S("e5") - 0.2
    prog = [(tv, "G"), (tv + BAR * 1.2, "D/F#"), (tv + 2 * BAR * 1.2, "Em7"), (tv + 3 * BAR * 1.2, "D"), (S("f1") - 0.8, None)]
    pad(prog, v=52)
    melody(VIOLIN, tv + 0.2, [("B4", 1), ("A4", 1), ("G4", 1), ("A4", 1.5), ("B4", 1.5), ("F#4", 3), ("A4", 3)], v=56, beat=B * 1.2)
    STR.expr([(tv, 70), (S("e5", 1), 80), (S("f1") - 0.8, 0)])

    # ---------------- VI. Musiken -------------------------------------------
    tf = S("f1") - 0.9
    prog = bars(tf, THEME_CH + THEME2_CH, BAR)
    prog = [p for p in prog if p[0] < S("f4") - 0.6] + [(S("f4") - 0.6, None)]
    waltz(GTR, prog, B, v=60)
    pad(prog, v=40, bass=False, hi=False)
    melody(VIOLIN, tf + BAR, THEME, v=72, beat=B)
    VIOLIN.expr([(tf, 70), (S("f2"), 95), (S("f3"), 90), (S("f4") - 0.6, 50)])
    # geolokalisering: en hållen ton som öppnar för klippet
    tg = S("f4") - 0.6
    STR.chord(tg, CLIP_FIDDLE - tg + 0.4, [n("A3"), n("D4"), n("E4")], 50)
    STR.expr([(tg, 40), (CLIP_FIDDLE - 0.6, 60), (CLIP_FIDDLE + 0.4, 0)])
    CELESTA.note(S("f4") + 1.0, 2.0, n("A5"), 40)
    CELESTA.note(S("f4") + 1.4, 2.0, n("E6"), 34)
    # (tystnad under Dennis eget spel)
    tk = CLIP_FIDDLE_END + 0.3
    prog = bars(tk, ["G", "D/F#", "Em7", "A", "D"], BAR)
    waltz(GTR, prog[:-1] + [(prog[-1][0] + 0.2, None)], B, v=50)
    melody(PIANO, tk + BAR, [("B4", 1), ("A4", 1), ("G4", 1), ("A4", 2), ("F#4", 1), ("E4", 3), ("D4", 3)], v=36, beat=B)
    PIANO.pedal(tk, True)
    PIANO.pedal(S("g1") - 0.6, False)

    # ---------------- VII. Tekniken (lekfullt) -------------------------------
    tq = S("g1") - 0.5
    PB = 0.36
    pat = [("G3", "B3"), ("D4", None), ("B3", "D4"), ("D4", None)]
    chords = ["G", "C", "D", "G", "Em7", "C", "D", "D"]
    t = tq
    k = 0
    stop0, stop1 = S("g2") - 0.25, E("g2") + 0.5
    t_end = S("g6") - 0.2
    while t < t_end:
        if stop0 <= t < stop1:
            t = stop1
            continue
        c = chords[(k // 8) % len(chords)]
        b, low, high = voicing(c)
        if k % 2 == 0:
            PIZZ.note(t, 0.2, low[0] if k % 4 == 0 else low[-1], 52 + (6 if k % 8 == 0 else 0))
        else:
            PIZZ.chord(t, 0.2, [p - 12 for p in high[:2]], 40)
        t += PB
        k += 1
    for tt_, nt in ((S("g3") + 0.9, "D6"), (S("g3", 1) + 0.9, "B5"), (Wt_("g3", 0.75), "G6")):
        CELESTA.note(tt_, 0.8, n(nt), 46)
    # "Ring Adam" – liten fanfar
    tr2 = S("g4", 1) - 0.05
    for i, nt in enumerate(["G5", "B5", "D6"]):
        GLOCK.note(tr2 + i * 0.12, 1.4, n(nt), 60)
    prog = [(S("g5") - 0.1, "G"), (S("g5") + 2.2, "C"), (S("g5", 1) - 0.1, "D"), (S("g5", 2) - 0.1, "G"), (S("g6") - 0.1, None)]
    pad(prog, v=40, hi=False)
    # dammsugarpåsar: "ta-da"
    tdp = S("g6", 1) + 1.6
    for i, nt in enumerate(["D5", "G5"]):
        GLOCK.note(tdp + i * 0.16, 1.6, n(nt), 58)
    PIZZ.note(tdp + 0.16, 0.3, n("G3"), 60)
    STR.chord(S("g6") - 0.2, E("g6") - S("g6") + 1.4, [n("B3"), n("D4"), n("G4")], 36)
    STR.expr([(S("g6") - 0.2, 0), (S("g6", 1), 55), (E("g6") + 1.2, 0)])
    # hemligt dokument: smygande
    ts = S("g7") - 0.5
    t = ts
    k = 0
    stamp_t = L["g7"]["sents"][2][0] + 0.9 + 0.16
    while t < stamp_t - 0.3:
        PIZZ.note(t, 0.2, n(["E3", "G3", "B3", "G3"][k % 4]), 44)
        t += 0.45
        k += 1
    TREM.chord(ts + 1.0, stamp_t - ts - 1.0, [n("E4"), n("B4")], 30)
    TREM.expr([(ts + 1.0, 0), (stamp_t - 0.2, 55), (stamp_t, 0)])
    TIMP.note(stamp_t, 1.5, n("E2"), 70)
    PIZZ.chord(stamp_t, 0.3, [n("E2"), n("E3")], 70)

    # ---------------- VIII. Julius ------------------------------------------
    tj = S("h1") - 1.0
    prog = bars(tj, THEME2_CH + THEME_CH, BAR * 1.06)
    prog = [p for p in prog if p[0] < E("h4") + 1.2] + [(E("h4") + 1.2, None)]
    waltz(GTR, prog, B * 1.06, v=54)
    arp(PIANO, prog, B * 1.06, v=34, pattern=(2, 3, 1))
    PIANO.pedal(tj, True)
    pad(prog, v=36, bass=False, lo=False)
    melody(CELESTA, S("h2") - 0.3, THEME2[:9], v=36, beat=B * 1.06)
    melody(VIOLIN, S("h3") + 0.6, THEME[9:], v=56, beat=B * 1.06)
    STR.expr([(tj, 20), (S("h3"), 45), (S("h4"), 55), (E("h4") + 1.2, 20)])
    PIANO.pedal(E("h4") + 1.0, False)

    # ---------------- Epilog ------------------------------------------------
    ti = S("i1") - 0.8
    prog = bars(ti, ["G", "D/F#", "Em7", "A", "G", "D/F#", "Em7", "A"], BAR * 1.1)
    prog = [p for p in prog if p[0] < S("i3") - 0.2] + [(S("i3") - 0.2, None)]
    arp(PIANO, prog, B * 1.1 / 2, v=38)
    PIANO.pedal(ti, True)
    pad(prog, v=44)
    STR.expr([(ti, 25), (S("i2"), 55), (S("i3"), 65)])
    tt3 = S("i3") - 0.2
    prog = [(tt3, "Bm"), (tt3 + 2.4, "G"), (E("i3") + 0.6, "Asus"), (S("i4") - 0.2, None)]
    pad(prog, v=48)
    # final: temat i fiol + stråkar, klimax på "Rakt igenom"
    tfin = S("i4") - 0.2
    seq = THEME_CH
    barf = (S("i6", 1) - tfin) / 7.0
    prog = [(tfin + i * barf, c) for i, c in enumerate(seq)] + [(TOTAL - 0.5, None)]
    pad(prog, v=58)
    arp(HARP, prog[:-1] + [(tfin + 8 * barf, None)], barf / 6, v=36)
    melody(VIOLIN, tfin, THEME, v=70, beat=barf / 3)
    VIOLIN.expr([(tfin, 60), (S("i5"), 85), (S("i6"), 100), (E("i6") + 2.0, 80), (TOTAL - 3, 0)])
    STR.expr([(tfin, 45), (S("i5"), 70), (S("i6"), 95), (E("i6") + 3, 70), (TOTAL - 1.5, 0)])
    OOHS.chord(S("i6") - 0.2, TOTAL - S("i6") - 1.0, [n("F#4"), n("A4"), n("D5")], 52)
    OOHS.expr([(S("i6") - 0.2, 0), (S("i6", 1), 70), (E("i6") + 3, 50), (TOTAL - 2, 0)])
    # slutkort: ensamt piano
    tend = E("i6") + 3.6
    PIANO.pedal(tend - 0.2, True)
    melody(PIANO, tend, THEME[:9], v=40, beat=0.62)
    PIANO.note(tend, 6.0, n("D3"), 32)
    PIANO.note(tend + 3 * 0.62 * 3, 5.0, n("A2"), 28)
    PIANO.pedal(TOTAL - 0.1, False)


def Wt_(lid, frac):
    a, b = L[lid]["sents"][-1]
    return a + (b - a) * frac


def render():
    os.makedirs(OUT, exist_ok=True)
    for name, tracks in STEMS.items():
        mp = os.path.join(OUT, name + ".mid")
        wp = os.path.join(OUT, name + ".wav")
        AM.write_midi(tracks, mp)
        subprocess.run(["fluidsynth", "-ni", "-q", "-R", "0", "-C", "0", "-g", "0.5", "-r", "48000",
                        "-F", wp, SF2, mp], check=True)
        print("rendered", name, flush=True)


if __name__ == "__main__":
    compose()
    render()
