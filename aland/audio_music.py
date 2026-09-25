# -*- coding: utf-8 -*-
"""Originalmusik, komponerad i kod mot tidslinjen och renderad med fluidsynth.

Ut: build/music/<stem>.wav  (48 kHz stereo, torrt – rum läggs i mixen)
"""
import json
import os
import subprocess

import mido
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "build/music")
SF2 = "/usr/share/sounds/sf2/MuseScore_General_Full.sf2"
TPB = 960
TL = json.load(open(os.path.join(HERE, "build/timeline.json"), encoding="utf-8"))
L = TL["lines"]
TOTAL = TL["total"]
RNG = np.random.default_rng(11)


def S(lid, k=0):
    return L[lid]["sents"][k][0]


def E(lid, k=-1):
    return L[lid]["sents"][k][1]


# --------------------------------------------------------------------------
NOTE = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6,
        "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}


def n(s):
    """'D4' -> 62"""
    name, octv = s[:-1], int(s[-1])
    return 12 * (octv + 1) + NOTE[name]


# Ackordvoicings: (bas, låg, hög)
CH = {
    "Dm": ("D2", "D3 A3", "D4 F4 A4"),
    "Dm9": ("D2", "D3 A3", "E4 F4 A4"),
    "Dsus2": ("D2", "A2 D3", "E4 A4 D5"),
    "D": ("D2", "A2 D3", "F#4 A4 D5"),
    "Bb": ("Bb1", "F2 Bb2", "D4 F4 Bb4"),
    "Bbmaj7": ("Bb1", "F2 Bb2", "D4 F4 A4"),
    "Gm": ("G1", "D2 G2", "Bb3 D4 G4"),
    "G": ("G1", "D2 G2", "B3 D4 G4"),
    "A": ("A1", "E2 A2", "C#4 E4 A4"),
    "Asus": ("A1", "E2 A2", "D4 E4 A4"),
    "F": ("F1", "C2 F2", "A3 C4 F4"),
    "F/A": ("A1", "C2 F2", "A3 C4 F4"),
    "C": ("C2", "G2 C3", "E4 G4 C5"),
    "C/E": ("E2", "G2 C3", "E4 G4 C5"),
    "Dm/C": ("C2", "A2 D3", "F4 A4 D5"),
    "Bm": ("B1", "F#2 B2", "D4 F#4 B4"),
    "A/C#": ("C#2", "A2 E3", "C#4 E4 A4"),
    "D/F#": ("F#1", "A2 D3", "F#4 A4 D5"),
    "Em": ("E2", "B2 E3", "G4 B4 E5"),
    "Gm/Bb": ("Bb1", "D2 G2", "Bb3 D4 G4"),
    "Ebmaj7": ("Eb2", "Bb2 Eb3", "D4 G4 Bb4"),
}


def voicing(name):
    b, lo, hi = CH[name]
    return n(b), [n(x) for x in lo.split()], [n(x) for x in hi.split()]


class Track:
    def __init__(self, program, channel=0, bank=0, vol=100):
        self.program, self.channel, self.bank, self.vol = program, channel, bank, vol
        self.notes = []
        self.ccs = []

    def note(self, t, d, p, v, human=True):
        if human:
            t += RNG.normal(0, 0.008)
            v += RNG.normal(0, 4)
        self.notes.append((max(0.0, t), max(0.03, d), int(p), int(np.clip(v, 1, 127))))

    def chord(self, t, d, ps, v, roll=0.0):
        for i, p in enumerate(ps):
            self.note(t + i * roll, d - i * roll, p, v)

    def expr(self, pts, cc=11, step=0.05):
        """Linjärt interpolerad CC-kurva: pts = [(t, v), ...]."""
        pts = sorted(pts)
        for (t0, v0), (t1, v1) in zip(pts[:-1], pts[1:]):
            k = max(1, int((t1 - t0) / step))
            for i in range(k):
                u = i / k
                self.ccs.append((t0 + (t1 - t0) * u, cc, int(np.clip(v0 + (v1 - v0) * u, 0, 127))))
        self.ccs.append((pts[-1][0], cc, int(pts[-1][1])))

    def pedal(self, t, down):
        self.ccs.append((t, 64, 127 if down else 0))


def write_midi(tracks, path):
    mid = mido.MidiFile(ticks_per_beat=TPB)
    meta = mido.MidiTrack()
    meta.append(mido.MetaMessage("set_tempo", tempo=1_000_000, time=0))
    mid.tracks.append(meta)
    for tr in tracks:
        mt = mido.MidiTrack()
        ev = []
        ch = tr.channel
        if tr.bank:
            ev.append((0, 0, mido.Message("control_change", channel=ch, control=0, value=tr.bank)))
        ev.append((0, 1, mido.Message("program_change", channel=ch, program=tr.program)))
        ev.append((0, 2, mido.Message("control_change", channel=ch, control=7, value=tr.vol)))
        if not any(c == 11 for _, c, _ in tr.ccs):
            ev.append((0, 2, mido.Message("control_change", channel=ch, control=11, value=110)))
        for t, c, v in tr.ccs:
            ev.append((int(t * TPB), 3, mido.Message("control_change", channel=ch, control=c, value=v)))
        for t, d, p, v in tr.notes:
            ev.append((int(t * TPB), 5, mido.Message("note_on", channel=ch, note=p, velocity=v)))
            ev.append((int((t + d) * TPB), 4, mido.Message("note_off", channel=ch, note=p, velocity=0)))
        ev.sort(key=lambda e: (e[0], e[1]))
        last = 0
        for tk, _, msg in ev:
            msg.time = tk - last
            last = tk
            mt.append(msg)
        mid.tracks.append(mt)
    mid.save(path)


# --------------------------------------------------------------------------
# Instrument (en MIDI-fil per stem)
# --------------------------------------------------------------------------
STR_HI = Track(49, 0)          # långsamma stråkar
STR_TREM = Track(44, 1)        # tremolo
CELLO = Track(42, 2)
BASS = Track(43, 3)
STR_FAST = Track(48, 4)        # ostinato
PIZZ = Track(45, 5)
PIANO = Track(0, 0, vol=96)
CHOIR = Track(52, 0)
OOHS = Track(53, 1)
HORN = Track(60, 0)
TBN = Track(57, 1)
TUBA = Track(58, 2)
TIMP = Track(47, 0)
TAIKO = Track(116, 1)
KIT = Track(48, 9)   # orkesterslagverk (kanal 10 = trumbank)
HARP = Track(46, 0)
GLASS = Track(92, 1, vol=115)   # "bowed glass" dyna
CELESTA = Track(8, 2, vol=80)

STEMS = {
    "strings": [STR_HI, STR_TREM, CELLO, BASS, STR_FAST, PIZZ],
    "piano": [PIANO],
    "choir": [CHOIR, OOHS],
    "brass": [HORN, TBN, TUBA],
    "perc": [TIMP, TAIKO, KIT],
    "harp": [HARP, GLASS, CELESTA],
}


# --------------------------------------------------------------------------
# Byggstenar
# --------------------------------------------------------------------------
def pad(prog, v=60, hi=True, lo=True, bass=True, legato=0.25, tracks=None):
    """prog: [(t, ackord), ...] sista posten = (t_slut, None)."""
    tr_hi, tr_lo, tr_b = tracks or (STR_HI, CELLO, BASS)
    for (t0, c), (t1, _) in zip(prog[:-1], prog[1:]):
        if c is None:
            continue
        b, low, high = voicing(c)
        d = t1 - t0 + legato
        if bass:
            tr_b.note(t0, d, b + 12 if b < n("E1") else b, v)
        if lo:
            tr_lo.chord(t0, d, low, v)
        if hi:
            tr_hi.chord(t0, d, high, v - 4)


def arp(tr, prog, step, v=55, pattern=(0, 1, 2, 1), octave=0, lo_notes=False):
    step *= 1.6
    v -= 8
    for (t0, c), (t1, _) in zip(prog[:-1], prog[1:]):
        if c is None:
            continue
        b, low, high = voicing(c)
        pool = (low + high) if lo_notes else high
        pool = sorted(pool)
        t = t0
        i = 0
        while t < t1 - 1e-3:
            p = pool[pattern[i % len(pattern)] % len(pool)] + 12 * octave
            tr.note(t, step * 1.6, p, v + (6 if i % len(pattern) == 0 else 0))
            t += step
            i += 1


def ostinato(tr, prog, step, v=62, pat=(0, 0, 0, 0), accent=4, octave=0):
    """Lugnare version: i stället för drivande ostinato, en mjuk långsam puls på grundtonen."""
    for (t0, c), (t1, _) in zip(prog[:-1], prog[1:]):
        if c is None:
            continue
        root = voicing(c)[1][0] + 12 * octave
        tr.note(t0, t1 - t0 + 0.2, root, v - 18)
    return
    for (t0, c), (t1, _) in zip(prog[:-1], prog[1:]):
        if c is None:
            continue
        b, low, high = voicing(c)
        root = low[0] + 12 * octave
        t = t0
        i = 0
        while t < t1 - 1e-3:
            p = root + pat[i % len(pat)]
            tr.note(t, step * 0.8, p, v + (10 if i % accent == 0 else 0))
            t += step
            i += 1


def melody(tr, t0, seq, v=70, beat=1.0, transpose=0):
    """seq: [(not|None, slag), ...]"""
    t = t0
    for nt, d in seq:
        if nt is not None:
            tr.note(t, d * beat * 1.02, n(nt) + transpose, v)
        t += d * beat
    return t


def swell(tr, t0, t1, a=30, b=110, c=None, t2=None):
    pts = [(t0, a), (t1, b)]
    if c is not None:
        pts.append((t2, c))
    tr.expr(pts)


def hit(t, v=110, timp="D2", big=True):
    TIMP.note(t, 2.5, n(timp), v)
    TIMP.note(t, 2.5, n(timp) - 12 if n(timp) - 12 >= n("C2") else n(timp), v - 20)
    KIT.note(t, 3.0, 35, v)       # konsertbastrumma
    if big:
        KIT.note(t, 4.0, 49, v - 25)  # cymbal
        TAIKO.note(t, 2.0, 60, v)


def timp_roll(t0, t1, pitch="D2", v0=30, v1=100):
    t = t0
    k = 0
    while t < t1:
        u = (t - t0) / (t1 - t0)
        TIMP.note(t, 0.2, n(pitch), v0 + (v1 - v0) * u ** 1.5)
        t += 0.07
        k += 1


def snare_roll(t0, t1, v0=20, v1=90):
    return
    t = t0
    while t < t1:
        u = (t - t0) / (t1 - t0)
        KIT.note(t, 0.1, 38, v0 + (v1 - v0) * u ** 2)
        t += 0.055


MOTIF_MIN = [("D4", 1), ("A4", 1), ("G4", 0.5), ("F4", 0.5), ("E4", 1), ("F4", 1), ("D4", 2)]
MOTIF_MAJ = [("D4", 1), ("A4", 1), ("G4", 0.5), ("F#4", 0.5), ("E4", 1), ("F#4", 1), ("D4", 2)]


# --------------------------------------------------------------------------
# Partitur
# --------------------------------------------------------------------------
def compose():
    # ---------------- Öppning ------------------------------------------
    t_title = E("o4") + 0.9
    BASS.note(0.8, t_title + 0.4 - 0.8, n("D2"), 70)
    CELLO.note(1.2, 8.3, n("D3"), 58)
    CELLO.note(1.4, 8.1, n("A3"), 52)
    CELLO.expr([(0.0, 10), (6.0, 70), (9.0, 80)])
    BASS.expr([(0.0, 20), (8.0, 80)])
    GLASS.note(2.0, 7.5, n("A4"), 60)
    GLASS.note(2.4, 7.1, n("D5"), 54)
    GLASS.expr([(0, 0), (6, 60), (9.5, 0)])
    prog = [(S("o2") - 0.3, "Bb"), (S("o3") - 0.2, "Gm"), (S("o4") - 0.4, "Asus"), (S("o4", 1) - 0.3, "A"), (t_title, None)]
    pad(prog, v=58, bass=False)
    STR_HI.expr([(0, 0), (9.0, 55), (13, 70), (18, 80), (t_title - 1.0, 100), (t_title, 110), (t_title + 2.5, 70), (S("a1") + 1, 40)])
    for t, p, v in ((4.2, "D4", 46), (5.4, "A4", 42), (6.5, "F4", 40), (7.7, "E4", 38), (10.2, "D4", 44), (11.4, "F4", 40),
                    (13.8, "G4", 44), (14.8, "D4", 38), (17.2, "E4", 46), (18.4, "A3", 40), (20.0, "C#4", 38)):
        PIANO.note(t, 3.0, n(p), v)
    PIANO.pedal(3.9, True)
    PIANO.pedal(t_title + 3, False)
    timp_roll(t_title - 2.4, t_title - 0.05, "D2", 20, 95)
    snare_roll(t_title - 1.8, t_title - 0.05, 5, 45)
    hit(t_title, 118)
    TBN.chord(t_title, 3.2, [n("D2"), n("A2"), n("D3")], 88)
    TUBA.note(t_title, 3.4, n("D1") + 12, 92)
    HORN.chord(t_title, 3.0, [n("D3"), n("F3"), n("A3")], 80)
    pad([(t_title, "Dm"), (S("a1") + 0.8, None)], v=78)

    # ---------------- I. Ur havet ---------------------------------------
    ta = S("a1") - 0.2
    STR_TREM.chord(ta, S("a2") - ta + 0.4, [n("D5"), n("A5")], 62)
    STR_TREM.expr([(ta, 30), (ta + 2.0, 85), (S("a2") + 0.4, 40)])
    GLASS.chord(ta, S("a2") + 2 - ta, [n("E5"), n("A5")], 70)
    OOHS.chord(ta, S("a2") + 1.0 - ta, [n("D4"), n("A4")], 50)
    OOHS.expr([(ta, 20), (ta + 2.5, 70), (S("a2") + 1.0, 0)])
    GLASS.expr([(ta, 0), (ta + 3, 55), (S("a2") + 2, 10), (S("a2") + 3, 0)])
    BASS.note(ta, S("a3") - ta, n("D2"), 64)
    BASS.expr([(ta, 70), (S("a3"), 80)])
    tm = S("a2") + 0.2
    prog = [(tm, "Bb"), (tm + 1.9, "F"), (tm + 3.6, "C"), (tm + 5.0, "Dm9"), (S("a4") + 0.2, None)]
    pad(prog, v=62, bass=False)
    CHOIR.chord(tm + 1.9, 3.5, [n("A3"), n("C4"), n("F4")], 52)
    CHOIR.chord(tm + 5.0, S("a4") - tm - 4.6, [n("A3"), n("D4"), n("E4")], 50)
    CHOIR.expr([(tm, 20), (tm + 4, 90), (S("a3") + 1, 70), (S("a4"), 30)])
    for i, t in enumerate(np.arange(S("a3") - 0.2, S("a4") - 0.4, 0.62)):
        CELESTA.note(t, 1.5, n(["A5", "D6", "E6", "F6", "A5", "E6"][i % 6]), 38)
    # hällristningar: hjärtslag
    tp = S("a4") - 0.3
    t = tp
    while t < E("a4") + 0.2:
        TAIKO.note(t, 0.6, 50, 58)
        TAIKO.note(t + 0.32, 0.5, 50, 40)
        t += 1.6
    BASS.note(tp, E("a4") - tp + 1.0, n("D2"), 60)
    CELLO.note(tp, E("a4") - tp + 1.0, n("A2"), 50)
    melody(CELLO, tp + 1.6, [("D3", 1.5), ("F3", 0.75), ("E3", 0.75), ("D3", 1.5), ("C3", 0.75), ("D3", 2.5)], v=64, beat=1.0)
    ts = E("a4") + 0.1
    prog = [(ts, "Gm"), (S("a5", 1) - 0.2, "A"), (E("a5") + 1.6, None)]
    pad(prog, v=64)
    STR_HI.expr([(ts, 40), (S("a5", 1), 95), (E("a5") + 0.2, 70), (E("a5") + 1.6, 0)])
    TBN.chord(S("a5", 1) - 0.2, 3.5, [n("A1") + 12, n("E2") + 12], 60)
    TUBA.note(S("a5", 1) - 0.2, 3.5, n("A1"), 64)

    # ---------------- II. Kors och krona --------------------------------
    tb = S("b1") - 0.6
    tb_end = E("b4") + 1.2
    step = 0.375
    prog = [(tb, "Dm"), (tb + 3.0, "C"), (tb + 6.0, "G"), (tb + 9.0, "Dm"), (tb + 12.0, "C"),
            (tb + 15.0, "F"), (tb + 18.0, "G"), (tb + 21.0, "Dm"), (tb_end, None)]
    arp(HARP, prog, step, v=48, pattern=(0, 1, 2, 3, 2, 1), lo_notes=True)
    pad(prog, v=50, hi=False)
    melody(CELLO, tb + 0.6, [("D4", 1.5), ("E4", 0.75), ("F4", 0.75), ("G4", 1.5), ("F4", 0.75), ("E4", 0.75),
                              ("D4", 2.25), (None, 0.75), ("C4", 0.75), ("D4", 0.75), ("E4", 1.5), ("A3", 3.0)], v=66, transpose=-12)
    t_ch = S("b3") - 0.3
    for (t0, c), (t1, _) in zip(prog[:-1], prog[1:]):
        if t1 > t_ch and c:
            _, low, high = voicing(c)
            OOHS.chord(max(t0, t_ch), t1 - max(t0, t_ch) + 0.3, [p for p in high], 54)
    OOHS.expr([(t_ch, 0), (t_ch + 2, 85), (tb_end - 1.5, 70), (tb_end, 0)])
    tk = S("b4") + 0.2
    melody(HORN, tk, MOTIF_MIN, v=74, beat=0.95, transpose=-12)
    tcr = S("b4", 1) + 0.1
    HORN.chord(tcr, 3.2, [n("F3"), n("A3"), n("C4")], 70)
    TBN.chord(tcr, 3.2, [n("F2"), n("C3")], 64)
    HORN.chord(tcr + 3.2, 2.4, [n("G3"), n("B3"), n("D4")], 66)
    HORN.expr([(tk - 0.5, 70), (tcr + 1, 105), (tb_end, 20)])
    STR_HI.expr([(tb, 50), (tb + 4, 70), (tcr, 95), (tb_end, 0)])

    # ---------------- III. Postrodden -----------------------------------
    tc = S("c1") - 0.6
    prog = [(tc, "Dm"), (tc + 3.2, "Bb"), (tc + 6.4, "C"), (tc + 9.6 - 2.0, "A"), (S("c2") - 0.4, None)]
    pr = []
    for (t0, c), (t1, _) in zip(prog[:-1], prog[1:]):
        pr.append((t0, c))
    pr.append((S("c2") - 0.4, None))
    arp(PIZZ, pr, 0.4, v=62, pattern=(0, 2, 1, 2), lo_notes=True)
    pad(pr, v=50, hi=False)
    STR_HI.expr([(tc, 0), (S("c1", 1), 60), (S("c2"), 80)])
    tst = S("c2") - 0.4
    prog = [(tst, "Dm"), (tst + 2.0, "Bb"), (tst + 4.0, "Gm"), (tst + 5.4, "A"), (S("c3") - 0.15, None)]
    pad(prog, v=70, hi=False, tracks=(STR_HI, CELLO, BASS))
    for (t0, c), (t1, _) in zip(prog[:-1], prog[1:]):
        if c:
            STR_TREM.chord(t0, t1 - t0, voicing(c)[2], 70)
    STR_TREM.expr([(tst, 30), (S("c3") - 0.4, 115), (S("c3") - 0.1, 0)])
    ostinato(STR_FAST, prog, 0.2, v=64, pat=(0, 0, 12, 0), accent=4)
    STR_FAST.expr([(tst, 40), (S("c3") - 0.4, 110), (S("c3") - 0.12, 0)])
    timp_roll(S("c3") - 2.2, S("c3") - 0.15, "A2", 30, 100)
    # tystnad – "Många kom aldrig hem."
    t3 = S("c3") + 0.05
    BASS.note(t3, 4.5, n("D2"), 44)
    PIANO.pedal(t3 - 0.05, True)
    PIANO.note(t3 + 0.15, 4.0, n("D4"), 44)
    PIANO.note(t3 + 0.2, 4.0, n("D3"), 36)
    PIANO.note(E("c3") + 0.4, 3.0, n("A3"), 36)
    PIANO.pedal(t3 + 5.0, False)
    OOHS.chord(t3, 4.0, [n("D4"), n("F4"), n("A4")], 40)
    OOHS.expr([(t3, 0), (t3 + 1.5, 60), (t3 + 4, 0)])

    # ---------------- IV. Ofreden ----------------------------------------
    t14 = S("d1") - 0.2
    hit(t14, 122)
    TBN.chord(t14, 2.6, [n("D2"), n("A2"), n("D3")], 96)
    TUBA.note(t14, 2.8, n("D2"), 98)
    HORN.chord(t14, 2.4, [n("D3"), n("F3"), n("A3")], 90)
    tw = S("d2") - 0.4
    prog = [(tw, "Dm"), (tw + 2.9, "Bb"), (tw + 4.35, "Gm"), (tw + 5.8, "A"), (S("d3") - 0.1, "Dm"),
            (S("d3", 1) - 0.1, "Bb"), (S("d4") - 0.15, None)]
    ostinato(STR_FAST, prog, 0.36, v=70, pat=(0, 0, 0, 0, 3, 3, 1, 1), accent=4)
    STR_FAST.expr([(tw, 60), (S("d4") - 0.3, 115)])
    pad(prog, v=64, hi=True)
    STR_HI.expr([(tw, 40), (S("d4"), 110), (S("d4") + 2.2, 60)])
    t = tw
    k = 0
    while t < S("d4") - 0.2:
        TAIKO.note(t, 0.5, 50, 70 + (18 if k % 4 == 0 else 0))
        if k % 4 == 2:
            TIMP.note(t, 0.6, n("A2"), 64)
        t += 0.72
        k += 1
    HORN.chord(S("d3") - 0.1, 3.8, [n("D3"), n("A3")], 72)
    HORN.chord(S("d3", 1) - 0.1, 2.3, [n("D3"), n("F3"), n("Bb3")], 76)
    HORN.expr([(S("d3") - 0.2, 60), (S("d4"), 115), (S("d4") + 2.5, 40)])
    so = S("d4") - 0.1
    hit(so, 120)
    CHOIR.chord(so, 2.6, [n("D4"), n("F4"), n("A4"), n("D5")], 92)
    CHOIR.expr([(so, 110), (so + 2.6, 30)])
    TBN.chord(so, 2.4, [n("D2"), n("A2")], 92)
    t09 = S("d6") - 0.3
    prog = [(t09, "Gm"), (t09 + 2.2, "Gm/Bb"), (S("d6", 1) - 0.2, "A"), (E("d6") + 1.0, "Dm"), (E("d6") + 2.4, None)]
    pad(prog, v=66)
    TBN.chord(t09, 2.3, [n("G2"), n("D3")], 64)
    TUBA.note(t09, 2.3, n("G1") + 12, 66)
    TBN.chord(t09 + 2.2, 2.4, [n("Bb2"), n("D3")], 64)
    TUBA.note(t09 + 2.2, 2.4, n("Bb1"), 66)
    TBN.expr([(t09, 70), (E("d6"), 90), (E("d6") + 2.4, 10)])
    timp_roll(S("d6", 1) - 1.4, S("d6", 1) - 0.2, "A2", 20, 90)
    hit(S("d6", 1) - 0.15, 104, "A2", big=False)
    STR_HI.expr([(t09, 60), (S("d6", 1), 90), (E("d6") + 2.4, 0)])

    # ---------------- V. Bomarsund --------------------------------------
    tbld = S("e1") - 0.3
    prog = [(tbld, "Dm"), (S("e2") - 0.2, "Bb"), (S("e2", 1) - 0.2, "C"), (S("e2", 1) + 1.6, "Dm"), (S("e3") - 0.1, None)]
    ostinato(STR_FAST, prog, 0.36, v=62, pat=(0, 0, 12, 0), accent=4)
    STR_FAST.expr([(tbld, 60), (S("e3") - 0.3, 100), (S("e3") - 0.05, 0)])
    pad(prog, v=56, hi=False)
    t = tbld
    while t < S("e3") - 0.2:
        TIMP.note(t, 0.5, n("D2"), 56)
        t += 1.44
    melody(HORN, S("e2", 1) - 0.2, [("D3", 1), ("A3", 1), ("G3", 0.5), ("F3", 0.5), ("E3", 1.2)], v=78)
    HORN.expr([(S("e2", 1) - 0.4, 90), (S("e3") + 1, 50)])
    STR_HI.chord(S("e3") - 0.1, 2.8, [n("G3"), n("Bb3"), n("C#4")], 50)
    STR_HI.expr([(S("e3") - 0.1, 70), (E("e3") + 0.8, 0)])
    # flottan
    tf = S("e4") - 0.4
    prog = [(tf, "Dm"), (tf + 2.0, "Bb"), (tf + 4.0, "C"), (tf + 5.6, "A"), (S("e5") - 0.2, None)]
    pad(prog, v=64)
    arp(PIZZ, prog, 0.25, v=58, pattern=(0, 1, 2, 3), lo_notes=True)
    STR_HI.expr([(tf, 30), (S("e5") - 0.4, 108), (S("e5"), 60)])
    snare_roll(S("e5") - 3.0, S("e5") - 0.25, 8, 70)
    HORN.chord(tf + 4.0, 1.6, [n("C3"), n("G3"), n("E4")], 70)
    HORN.chord(tf + 5.6, S("e5") - tf - 5.6, [n("A2"), n("E3"), n("C#4")], 80)
    # Viktoriakorset – ädel vändning till F-dur
    tv = S("e5") - 0.1
    prog = [(tv, "F"), (tv + 2.0, "Bb"), (tv + 3.6, "F/A"), (tv + 5.0, "C"), (E("e5") + 0.4, None)]
    pad(prog, v=54)
    melody(HORN, tv + 0.4, [("C4", 1), ("F4", 1), ("A4", 1.2), ("G4", 0.6), ("F4", 0.6), ("E4", 1.0), ("C4", 1.6)], v=70)
    HORN.expr([(tv, 60), (tv + 3, 90), (E("e5") + 0.4, 50)])
    STR_HI.expr([(tv, 50), (tv + 3, 75), (E("e5"), 60)])
    # bombardemanget
    tbo = S("e6") - 0.3
    boom = S("e7", 1) + 0.25
    prog = [(tbo, "Dm"), (tbo + 2.2, "Bb"), (S("e7") - 0.1, "Gm"), (S("e7") + 2.0, "A"), (boom, None)]
    for (t0, c), (t1, _) in zip(prog[:-1], prog[1:]):
        STR_TREM.chord(t0, t1 - t0, voicing(c)[1] + voicing(c)[2], 72)
    STR_TREM.expr([(tbo, 60), (boom - 0.1, 118), (boom, 0)])
    ostinato(STR_FAST, prog, 0.18, v=66, pat=(0, 0, 0, 1), accent=4, octave=-1)
    STR_FAST.expr([(tbo, 70), (boom - 0.1, 118), (boom, 0)])
    pad(prog, v=60, hi=False)
    t = tbo
    k = 0
    while t < boom - 0.3:
        TAIKO.note(t, 0.4, 50, 74 + (20 if k % 3 == 0 else 0))
        t += 0.54
        k += 1
    HORN.chord(S("e7") - 0.1, 2.0, [n("D3"), n("G3"), n("Bb3")], 86)
    HORN.chord(S("e7") + 2.0, boom - S("e7") - 2.0, [n("C#3"), n("E3"), n("A3")], 94)
    TBN.chord(S("e7") + 2.0, boom - S("e7") - 2.0, [n("A1") + 12, n("E2") + 12], 88)
    timp_roll(boom - 2.5, boom - 0.05, "A2", 40, 120)
    snare_roll(boom - 2.0, boom - 0.05, 20, 100)
    hit(boom, 127)
    TBN.chord(boom, 1.8, [n("D2"), n("A2"), n("D3")], 110)
    TUBA.note(boom, 2.0, n("D2"), 112)
    HORN.chord(boom, 1.6, [n("D3"), n("F3"), n("A3"), n("D4")], 110)
    TBN.expr([(boom, 110), (boom + 2.0, 20)])
    HORN.expr([(boom, 115), (boom + 1.8, 20)])
    # freden i Paris
    tp = S("e8") - 0.6
    prog = [(tp, "Bb"), (tp + 2.4, "F"), (tp + 4.4, "Gm"), (E("e8") - 0.3, "Dm"), (S("e9") + 0.2, None)]
    pad(prog, v=50)
    STR_HI.expr([(boom + 1.0, 0), (tp + 1.0, 55), (E("e8"), 65)])
    for t, p in ((tp + 0.8, "D5"), (tp + 1.8, "C5"), (tp + 3.0, "A4"), (tp + 5.0, "Bb4"), (tp + 6.2, "A4")):
        PIANO.note(t, 2.2, n(p), 40)
    PIANO.pedal(tp + 0.5, True)
    PIANO.pedal(E("e8") + 0.3, False)
    t9 = S("e9") + 0.2
    prog = [(t9, "Gm"), (S("e9", 1) - 0.1, "D"), (E("e9") + 2.0, None)]
    pad(prog, v=60)
    OOHS.chord(S("e9", 1) - 0.1, E("e9") + 2.0 - S("e9", 1), [n("F#4"), n("A4"), n("D5")], 56)
    OOHS.expr([(S("e9", 1) - 0.2, 20), (S("e9", 1) + 1.2, 80), (E("e9") + 2.0, 0)])
    STR_HI.expr([(t9, 60), (S("e9", 1) + 0.8, 90), (E("e9") + 2.0, 0)])

    # ---------------- VI. Segel ------------------------------------------
    tf1 = S("f1") - 0.5
    prog = [(tf1, "D"), (tf1 + 2.0, "A/C#"), (tf1 + 4.0, "Bm"), (tf1 + 5.6, "G"), (S("f2") - 0.3, "G"),
            (S("f2") + 1.6, "D/F#"), (S("f3") - 0.2, "Em"), (S("f3") + 1.8, "A"), (S("f3") + 3.6, "D"),
            (S("f3") + 5.4, "G"), (S("f4") - 0.3, None)]
    pad(prog, v=60)
    arp(HARP, prog, 0.33, v=46, pattern=(0, 1, 2, 3, 4, 3, 2, 1), lo_notes=True)
    STR_HI.expr([(tf1, 20), (tf1 + 3, 70), (S("f2"), 85), (S("f3") + 3, 100), (S("f4") - 0.3, 80)])
    melody(PIANO, tf1 + 0.3, MOTIF_MAJ, v=48, beat=0.95, transpose=12)
    PIANO.pedal(tf1, True)
    PIANO.pedal(S("f2") - 0.4, False)
    # huvudtemat i stråkarna över solnedgången
    melody(STR_HI, S("f2") - 0.2, [("D5", 1.2), ("A5", 1.2), ("G5", 0.6), ("F#5", 0.6), ("E5", 1.2), ("F#5", 1.2), ("D5", 2.2),
                                    ("E5", 0.9), ("F#5", 0.9), ("G5", 1.2), ("A5", 2.4), ("B5", 0.8), ("A5", 2.4)], v=66)
    HORN.chord(S("f3") + 1.8, 1.8, [n("A2"), n("E3"), n("C#4")], 56)
    HORN.chord(S("f3") + 3.6, 1.8, [n("A2"), n("D3"), n("F#3")], 58)
    HORN.expr([(S("f3"), 50), (S("f3") + 4, 85), (S("f4"), 50)])
    # vetesegling runt jorden
    tg = S("f4") - 0.4
    prog = [(tg, "D"), (tg + 1.6, "Bm"), (tg + 3.2, "G"), (tg + 4.8, "A"), (S("f5") - 0.2, "G"), (S("f5") + 1.8, "D"),
            (S("f6") - 0.2, "Bm"), (S("f6") + 1.4, "G"), (S("f6") + 2.8, "A"), (E("f6") + 0.4, "D"), (E("f6") + 2.2, None)]
    pad(prog, v=56)
    arp(PIZZ, prog[:5] + [(S("f5") - 0.2, None)], 0.2, v=60, pattern=(0, 1, 2, 1), lo_notes=True)
    arp(HARP, prog[4:], 0.4, v=42, pattern=(0, 1, 2, 3, 2, 1), lo_notes=True)
    t = tg
    while t < S("f5") - 0.3:
        TAIKO.note(t, 0.3, 50, 50)
        t += 0.8
    STR_HI.expr([(tg, 80), (S("f5"), 70), (E("f6"), 60), (E("f6") + 2.2, 0)])
    melody(PIANO, S("f6") - 0.1, [("F#5", 1), ("D5", 1), ("E5", 1), ("A4", 2)], v=44)
    PIANO.pedal(S("f6") - 0.2, True)
    PIANO.pedal(E("f6") + 2.0, False)

    # ---------------- VII. Ålandsfrågan -----------------------------------
    tq = S("g1") - 0.4
    fall = S("g1") + 1.2
    prog = [(tq, "Dm"), (fall, "Bb"), (S("g1", 1) - 0.2, "F"), (S("g1", 1) + 1.3, "C"), (S("g2") - 0.3, None)]
    pad(prog, v=58)
    for (t0, c), (t1, _) in zip(prog[:-1], prog[1:]):
        STR_TREM.chord(t0, t1 - t0, voicing(c)[2], 50)
    STR_TREM.expr([(tq, 20), (fall, 80), (S("g1", 1), 50), (S("g2") - 0.3, 20)])
    TIMP.note(fall, 2.0, n("D2"), 90)
    KIT.note(fall, 3.0, 35, 90)
    tpt = S("g2") - 0.3
    prog = [(tpt, "Dm"), (tpt + 2.2, "Bb"), (tpt + 4.4, "F"), (tpt + 6.6, "C"), (S("g3") - 0.3, None)]
    pad(prog, v=50, hi=False)
    arp(PIZZ, prog, 0.5, v=56, pattern=(0, 2, 1, 2), lo_notes=True)
    tgn = S("g3") - 0.3
    prog = [(tgn, "Gm"), (tgn + 2.0, "Dm"), (tgn + 4.0, "Bb"), (tgn + 6.0, "A"), (S("g4") - 0.3, None)]
    pad(prog, v=62)
    ostinato(STR_FAST, prog, 0.25, v=58, pat=(0, 12, 7, 12), accent=4)
    STR_FAST.expr([(tgn, 40), (S("g4") - 0.4, 100)])
    STR_HI.expr([(tpt, 40), (tgn, 55), (S("g4") - 0.3, 95)])
    HORN.chord(tgn + 6.0, S("g4") - tgn - 6.0, [n("A2"), n("E3"), n("C#4")], 70)
    # datumet – hängande spänning
    td = S("g4") - 0.3
    STR_TREM.chord(td, S("g5") - td, [n("A3"), n("D4"), n("E4"), n("A4")], 60)
    STR_TREM.expr([(td, 30), (S("g5") - 0.3, 100), (S("g5") - 0.1, 0)])
    BASS.note(td, S("g5") - td, n("A2"), 56)
    timp_roll(S("g5") - 1.8, S("g5") - 0.1, "A2", 20, 96)
    # beslutet
    tbs = S("g5") - 0.1
    hit(tbs, 112, "D2")
    prog = [(tbs, "Dm"), (tbs + 1.6, "Bb"), (S("g6") - 0.3, None)]
    pad(prog, v=76)
    CHOIR.chord(tbs, S("g6") - tbs, [n("D4"), n("F4"), n("A4")], 80)
    CHOIR.expr([(tbs, 110), (S("g6"), 40)])
    STR_HI.expr([(tbs, 110), (S("g6") - 0.3, 60)])
    # villkoren – värme
    tv = S("g6") - 0.3
    prog = [(tv, "F"), (tv + 1.8, "C/E"), (tv + 3.6, "Dm"), (tv + 5.0, "Bb"), (S("g7") - 0.3, None)]
    pad(prog, v=56)
    melody(PIANO, tv + 0.2, [("A4", 1), ("C5", 1), ("Bb4", 0.5), ("A4", 0.5), ("G4", 1), ("A4", 1), ("F4", 2)], v=46)
    PIANO.pedal(tv, True)
    PIANO.pedal(S("g7") - 0.3, False)
    STR_HI.expr([(tv, 50), (tv + 3, 70), (S("g7"), 60)])
    # tio stater
    tt = S("g7") - 0.3
    tna = S("g7", 2) - 0.2
    prog = [(tt, "F"), (tt + 1.6, "C"), (tt + 3.2, "Dm"), (tt + 4.8, "Bb"), (tt + 6.4, "F"), (tt + 8.0, "C"), (tna, None)]
    pad(prog, v=62)
    arp(PIZZ, prog, 0.2, v=58, pattern=(0, 1, 2, 3), lo_notes=True)
    for i in range(10):
        HARP.note(S("g7") + 0.4 + i * 0.3, 1.0, n(["F5", "A5", "C6", "F6", "E6", "C6", "A5", "G5", "F5", "C6"][i]), 52)
    STR_HI.expr([(tt, 50), (tna - 0.4, 100), (tna, 0)])
    snare_roll(tna - 1.6, tna - 0.1, 5, 55)
    # "Inga soldater. Inga fästningar. Inte ens i krig."
    for k, (b1, b2) in zip((2, 3, 4), (("D2", "D3"), ("Bb1", "Bb2"), ("A1", "A2"))):
        t = S("g7", k) - 0.05
        PIANO.note(t, 1.9, n(b1), 56)
        PIANO.note(t, 1.9, n(b2), 48)
    PIANO.pedal(S("g7", 2) - 0.1, True)
    PIANO.pedal(E("g7") + 1.4, False)
    STR_HI.chord(S("g7", 4), E("g7") - S("g7", 4) + 1.0, [n("C#4"), n("E4"), n("A4")], 40)
    STR_HI.expr([(S("g7", 4), 0), (E("g7"), 50), (E("g7") + 1.0, 30)])
    # landstinget – ljus upplösning
    tl = S("g8") - 0.3
    prog = [(tl, "D"), (tl + 2.0, "G"), (tl + 3.6, "D/F#"), (tl + 5.0, "A"), (E("g8") + 0.4, "D"), (E("g8") + 1.9, None)]
    pad(prog, v=60)
    melody(HORN, tl + 0.3, MOTIF_MAJ, v=66, beat=0.9, transpose=-12)
    OOHS.chord(tl, E("g8") + 1.9 - tl, [n("F#4"), n("A4"), n("D5")], 50)
    OOHS.expr([(tl, 0), (tl + 2, 70), (E("g8") + 1.9, 0)])
    STR_HI.expr([(tl, 40), (tl + 3, 80), (E("g8") + 1.9, 0)])
    HORN.expr([(tl, 70), (E("g8"), 80), (E("g8") + 1.9, 0)])

    # ---------------- VIII. I dag ----------------------------------------
    t8 = S("h1") - 0.5
    seq = ["D", "A/C#", "Bm", "G", "D/F#", "G", "A", "D", "Bm", "G", "D", "A"]
    prog = []
    t = t8
    for c in seq:
        prog.append((t, c))
        t += 2.0 if t < S("h4") else 2.3
    tclim = S("h6") - 0.4
    prog = [p for p in prog if p[0] < tclim - 0.5] + [(tclim, None)]
    pad(prog, v=60)
    arp(PIANO, prog, 0.25, v=40, pattern=(0, 1, 2, 3, 2, 1, 2, 1))
    PIANO.pedal(t8, True)
    PIANO.pedal(tclim + 0.1, False)
    STR_HI.expr([(t8, 20), (S("h2"), 65), (S("h3", 1), 80), (S("h4"), 65), (S("h5"), 70), (tclim, 90)])
    melody(HORN, S("h2") + 0.2, MOTIF_MAJ, v=60, beat=1.1, transpose=-12)
    HORN.expr([(S("h2"), 60), (S("h3"), 80), (S("h4"), 50)])
    OOHS.chord(S("h5") - 0.2, tclim - S("h5") + 0.4, [n("A4"), n("C#5"), n("E5")], 46)
    OOHS.expr([(S("h5") - 0.3, 0), (S("h5") + 1.5, 60), (tclim, 70)])
    # klimax: "Ett litet land. Mitt i havet. Mellan två riken."
    prog = [(tclim, "G"), (S("h6", 1) - 0.2, "D/F#"), (S("h6", 2) - 0.2, "Em"), (S("h6", 2) + 1.0, "A"), (S("h7") - 0.1, "D"),
            (TOTAL - 0.5, None)]
    pad(prog, v=74)
    CHOIR.chord(tclim, S("h7") - tclim, [n("B3"), n("D4"), n("G4")], 70)
    CHOIR.chord(S("h7") - 0.1, TOTAL - S("h7") - 1.0, [n("F#4"), n("A4"), n("D5")], 72)
    CHOIR.expr([(tclim, 40), (S("h6", 2), 100), (S("h7") + 1.0, 105), (E("h7") + 3, 70), (TOTAL - 1.5, 0)])
    HORN.chord(S("h6", 2) - 0.2, 1.2, [n("E3"), n("G3"), n("B3")], 76)
    HORN.chord(S("h6", 2) + 1.0, S("h7") - S("h6", 2) - 1.1, [n("E3"), n("A3"), n("C#4")], 80)
    HORN.chord(S("h7") - 0.1, 5.0, [n("D3"), n("F#3"), n("A3")], 82)
    HORN.expr([(tclim, 70), (S("h7"), 105), (S("h7") + 5, 30)])
    TIMP.note(S("h7") - 0.12, 3.0, n("D2"), 88)
    KIT.note(S("h7") - 0.12, 5.0, 49, 60)
    STR_HI.expr([(tclim, 90), (S("h6", 2), 110), (S("h7") + 1.0, 115), (E("h7") + 2.5, 70), (TOTAL - 1.0, 0)])
    melody(STR_HI, tclim + 0.2, [("D5", 1.0), ("A5", 1.0), ("G5", 0.5), ("F#5", 0.5), ("E5", 1.2), ("F#5", 1.4), ("D5", 3.0)], v=72)
    # sluttitel: ensamt piano
    te = E("h7") + 2.9
    PIANO.pedal(te - 0.2, True)
    melody(PIANO, te, [("D5", 0.9), ("A5", 0.9), ("G5", 0.45), ("F#5", 0.45), ("E5", 0.9), ("F#5", 0.9), ("D5", 2.0)], v=42)
    PIANO.note(te, 5.0, n("D3"), 34)
    PIANO.note(te + 3.6, 4.0, n("A3"), 30)
    PIANO.pedal(TOTAL - 0.2, False)


def render():
    os.makedirs(OUT, exist_ok=True)
    for name, tracks in STEMS.items():
        mp = os.path.join(OUT, name + ".mid")
        wp = os.path.join(OUT, name + ".wav")
        write_midi(tracks, mp)
        subprocess.run(["fluidsynth", "-ni", "-q", "-R", "0", "-C", "0", "-g", "0.5", "-r", "48000",
                        "-F", wp, SF2, mp], check=True)
        print("rendered", name)


def calm():
    """Ta bort drivande slagverk och dämpa slag, så att musiken inte stressar."""
    TAIKO.notes = [n_ for n_ in TAIKO.notes if n_[3] <= 60 or n_[3] >= 100]
    for tr in (TIMP, KIT, TAIKO):
        tr.notes = [(t, d, p, int(v * 0.72)) for t, d, p, v in tr.notes]
    for tr in (HORN, TBN, TUBA):
        tr.notes = [(t, d, p, int(v * 0.85)) for t, d, p, v in tr.notes]


if __name__ == "__main__":
    compose()
    calm()
    render()
