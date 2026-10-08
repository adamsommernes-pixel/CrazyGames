# -*- coding: utf-8 -*-
"""Original score, composed in code against the narration timeline and rendered with
fluidsynth (04-musikk-og-lyd.md): soft piano, warm pads, light strings, no drums.
D minor at ~62 BPM, three-note motif (one per window), D major in the synthesis.

Out: build/music/<stem>.wav (48 kHz stereo, dry – room is added in the mix)
"""
import json
import os
import subprocess
import sys

import mido
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
OUT = os.path.join(HERE, "build/music")
SF2 = "/usr/share/sounds/sf2/MuseScore_General_Full.sf2"
TPB = 960
RNG = np.random.default_rng(11)

from film.shots import E_, S_, SHOTS, TOTAL, Wt  # noqa: E402

SH = {s.name: s for s in SHOTS}

NOTE = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6,
        "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}


def n(s):
    name, octv = s[:-1], int(s[-1])
    return 12 * (octv + 1) + NOTE[name]


# (bass, low voicing, high voicing)
CH = {
    "Dm": ("D2", "A2 D3", "F4 A4 D5"),
    "Dm9": ("D2", "A2 D3", "E4 F4 A4"),
    "Dm/C": ("C2", "A2 D3", "F4 A4 D5"),
    "Bb": ("Bb1", "F2 Bb2", "D4 F4 Bb4"),
    "Bbmaj7": ("Bb1", "F2 Bb2", "D4 F4 A4"),
    "Gm": ("G1", "D2 G2", "Bb3 D4 G4"),
    "Gm7": ("G1", "D2 G2", "Bb3 F4 G4"),
    "F": ("F1", "C2 F2", "A3 C4 F4"),
    "Fadd9": ("F1", "C2 F2", "G4 A4 C5"),
    "C": ("C2", "G2 C3", "E4 G4 C5"),
    "Csus": ("C2", "G2 C3", "F4 G4 C5"),
    "Am": ("A1", "E2 A2", "C4 E4 A4"),
    "A": ("A1", "E2 A2", "C#4 E4 A4"),
    "Asus": ("A1", "E2 A2", "D4 E4 A4"),
    "D": ("D2", "A2 D3", "F#4 A4 D5"),
    "Dadd9": ("D2", "A2 D3", "E4 F#4 A4"),
    "G": ("G1", "D2 G2", "B3 D4 G4"),
    "Gmaj7": ("G1", "D2 G2", "B3 D4 F#4"),
    "Bm": ("B1", "F#2 B2", "D4 F#4 B4"),
    "Em7": ("E2", "B2 E3", "D4 G4 B4"),
    "A/C#": ("C#2", "A2 E3", "C#4 E4 A4"),
}


def voicing(name):
    b, lo, hi = CH[name]
    return n(b), [n(x) for x in lo.split()], [n(x) for x in hi.split()]


class Track:
    def __init__(self, program, channel=0, vol=100):
        self.program, self.channel, self.vol = program, channel, vol
        self.notes, self.ccs = [], []

    def note(self, t, d, p, v, human=True):
        if human:
            t += RNG.normal(0, 0.01)
            v += RNG.normal(0, 3)
        self.notes.append((max(0.0, t), max(0.05, d), int(p), int(np.clip(v, 1, 127))))

    def expr(self, pts, cc=11, step=0.05):
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
        ch = tr.channel
        ev = [(0, 1, mido.Message("program_change", channel=ch, program=tr.program)),
              (0, 2, mido.Message("control_change", channel=ch, control=7, value=tr.vol))]
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


PIANO = Track(0, 0, 100)
PAD = Track(89, 1, 100)          # warm pad
STR = Track(49, 2, 100)          # slow strings
CELLO = Track(42, 3, 100)        # low drone

MOTIF = ["D5", "F5", "A5"]       # three windows
MOTIF_MAJ = ["D5", "F#5", "A5"]


def motif(t, k=3, v=46, gap=1.25, notes=MOTIF, ring=4.0):
    for i in range(k):
        PIANO.note(t + i * gap, ring, n(notes[i]), v - 2 * i)


def pad_seq(t0, t1, chords, v=50, hi=True, lo=True, strings=0.0, cello=0.0):
    """Hold chords evenly across [t0, t1]."""
    if t1 <= t0:
        return
    seg = (t1 - t0) / len(chords)
    for i, c in enumerate(chords):
        a = t0 + i * seg
        b, low, high = voicing(c)
        d = seg + 0.6
        if lo:
            for p in low:
                PAD.note(a, d, p, v)
        if hi:
            for p in high:
                PAD.note(a, d, p, v - 6)
        if strings > 0:
            for p in high:
                STR.note(a + 0.1, d, p, int(strings))
            STR.note(a + 0.1, d, low[0], int(strings * 0.9))
        if cello > 0:
            CELLO.note(a, d, b + 12, int(cello))


def piano_sparse(t0, t1, chords, v=34, density=1.0, register=0):
    """Sparse broken chords, slow and quiet."""
    if t1 <= t0:
        return
    seg = (t1 - t0) / len(chords)
    for i, c in enumerate(chords):
        a = t0 + i * seg
        b, low, high = voicing(c)
        PIANO.pedal(a + 0.02, False)
        PIANO.pedal(a + 0.08, True)
        PIANO.note(a, seg + 1.5, b + 12, v)
        steps = [0, 1, 2, 1] if density >= 1 else [0, 2]
        step = seg / (len(steps) + 1)
        for j, k in enumerate(steps):
            PIANO.note(a + (j + 1) * step, step * 2.5, high[k] + register, v - 4 - 2 * j)


def compose():
    PIANO.pedal(0.0, True)
    t_title = SH["S06"].t0
    # --- cold open: one long low piano tone, a faint pad; the tone returns at S05; title opens the pad
    PIANO.note(0.4, 9.0, n("D3"), 40)
    PIANO.note(0.42, 9.0, n("D2"), 34)
    PAD.note(0.2, t_title, n("D3"), 34)
    PAD.note(0.2, t_title, n("A3"), 30)
    PAD.expr([(0, 30), (8, 70), (t_title - 1, 70), (t_title + 1.5, 105), (SH["S07"].t0 + 2, 95)])
    PIANO.note(SH["S05"].t0 + 0.3, 7.0, n("D3"), 40)
    PIANO.note(SH["S05"].t0 + 0.32, 7.0, n("A3"), 32)
    for p in voicing("Dm9")[1] + voicing("Dm9")[2]:
        PAD.note(t_title + 0.2, 6.0, p, 56)
    # --- frame: the motif, three notes, over a slow progression
    t0, t1 = SH["S07"].t0, SH["S09"].t0
    pad_seq(t0, t1, ["Dm", "Bbmaj7", "F", "Csus"], v=48)
    motif(t0 + 1.0, 3, 48)
    motif(t0 + 8.5, 3, 42, gap=1.4)
    # --- chapter 1: darker pad, sparse piano, mostly drone under the numbers
    motif(SH["S09"].t0 + 0.2, 1, 50, ring=5)
    c1a, c1b = SH["S10"].t0, SH["S16"].t0
    pad_seq(c1a, c1b, ["Dm", "Dm/C", "Bb", "Gm", "Dm", "Asus", "Dm", "Bb", "Gm7", "Asus"], v=44, hi=False, cello=40)
    piano_sparse(SH["S14"].t0, c1b, ["Dm", "Bb", "Gm", "A"], v=28, density=0.5)
    # party plinths: identical neutral bed, no comment
    pad_seq(c1b, SH["S17"].t0, ["Dm9", "Dm9", "Dm9", "Dm9"], v=40, hi=True, lo=True)
    # Høyre's answer: a new chord, brighter register
    h1 = SH["S17"].t0
    pad_seq(h1, SH["S18"].t0, ["Fadd9", "C", "Dm", "Bbmaj7", "F", "Csus"], v=48, strings=34)
    piano_sparse(h1 + 0.3, SH["S18"].t0, ["Fadd9", "C", "Dm", "Bbmaj7", "F", "Csus"], v=32, register=12)
    # --- chapter 2: warmer, piano and light strings; rising figure at the progress part
    motif(SH["S18"].t0 + 0.2, 2, 50, ring=5)
    c2a = SH["S19"].t0
    pad_seq(c2a, SH["S23"].t0, ["Dm", "Bbmaj7", "F", "C", "Dm", "Bbmaj7", "Gm7", "Asus"], v=42, strings=26)
    piano_sparse(c2a + 0.5, SH["S23"].t0, ["Dm", "Bbmaj7", "F", "C", "Dm", "Bbmaj7", "Gm7", "Asus"], v=30)
    t23 = SH["S23"].t0
    pad_seq(t23, SH["S24"].t0, ["Bbmaj7", "C", "Dm", "F"], v=44, strings=32)
    for i, p in enumerate(["D4", "F4", "G4", "A4", "C5", "D5", "F5", "A5"]):
        PIANO.note(t23 + 0.8 + i * 1.2, 2.5, n(p), 34 + i)
    pad_seq(SH["S24"].t0, SH["S25"].t0, ["Dm9", "Dm9", "Dm9"], v=40)
    h2 = SH["S25"].t0
    pad_seq(h2, SH["S26"].t0, ["Fadd9", "C", "Dm", "Bbmaj7", "F", "C", "Bbmaj7", "Csus"], v=48, strings=36)
    piano_sparse(h2 + 0.3, SH["S26"].t0, ["Fadd9", "C", "Dm", "Bbmaj7", "F", "C", "Bbmaj7", "Csus"], v=32, register=12)
    # --- chapter 3: cooler pad, lower register; no tension music
    motif(SH["S26"].t0 + 0.2, 3, 50, gap=0.9, ring=5)
    c3a = SH["S27"].t0
    t_h3 = S_("c3", 1)
    pad_seq(c3a, SH["S29"].t0, ["Dm", "Gm", "Dm", "Bb", "Gm", "Asus"], v=40, hi=False, cello=42)
    pad_seq(SH["S29"].t0, t_h3, ["Dm9"], v=40)
    pad_seq(t_h3, SH["S30"].t0, ["Fadd9", "C", "Dm", "Bbmaj7", "Csus"], v=48, strings=36)
    piano_sparse(t_h3 + 0.3, SH["S30"].t0, ["Fadd9", "C", "Dm", "Bbmaj7", "Csus"], v=32, register=12)
    # --- synthesis: the motif in D major, strings fill out; the high point, still restrained
    s0 = SH["S30"].t0
    pad_seq(s0, SH["S33"].t0, ["D", "Bm", "G", "A", "D", "Gmaj7", "Em7", "A", "D", "G", "Bm", "Asus"], v=50, strings=44, cello=36)
    motif(s0 + 0.6, 3, 50, notes=MOTIF_MAJ)
    piano_sparse(s0 + 4.5, SH["S33"].t0, ["Bm", "G", "A", "D", "Gmaj7", "Em7", "A", "D", "G", "Bm", "Asus"], v=34, register=12)
    STR.expr([(s0, 70), (SH["S32"].t0, 100), (SH["S33"].t0, 110), (SH["S33"].t0 + 3, 80)])
    # --- ending: one last piano note that rings out over the end card
    e0 = SH["S33"].t0
    pad_seq(e0, SH["S34"].t0 + 2.0, ["Dadd9"], v=40)
    PIANO.pedal(e0 - 0.1, False)
    PIANO.pedal(e0, True)
    PIANO.note(SH["S34"].t0 + 0.4, 9.0, n("D4"), 44)
    PIANO.note(SH["S34"].t0 + 0.42, 9.0, n("A3"), 36)
    PIANO.note(SH["S34"].t0 + 0.44, 9.0, n("D3"), 34)
    PIANO.pedal(TOTAL, False)


STEMS = {"piano": [PIANO], "pad": [PAD], "strings": [STR, CELLO]}


def render():
    os.makedirs(OUT, exist_ok=True)
    for name, tracks in STEMS.items():
        mp = os.path.join(OUT, name + ".mid")
        wp = os.path.join(OUT, name + ".wav")
        write_midi(tracks, mp)
        subprocess.run(["fluidsynth", "-ni", "-q", "-R", "0", "-C", "0", "-g", "0.5", "-r", "48000",
                        "-F", wp, SF2, mp], check=True)
        print("rendered", name)


if __name__ == "__main__":
    compose()
    render()
