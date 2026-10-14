# Inside the Seiko 8T63

A narrated, deep-dive 3D film about how the Seiko caliber 8T63 meca-quartz chronograph works, built around case 8T63-00T0 (Seiko SSB397). It plays in a browser: open `index.html`. three.js and the fonts load from public CDNs. The same page renders the film to video.

## The film

About 12 minutes in 14 chapters. It cuts between the full watch model and close-up "stages" that take one mechanism apart:

| # | Chapter | What it explains |
|---|---|---|
| 1 | The watch | The SSB397 and what "meca-quartz" means |
| 2 | Reading the dial | Subdials, 24-hour hand, the 300-mark chapter ring (1/5 s) |
| 3 | Opening the case | Animated teardown into 12 layers |
| 4 | Power | SR936SW silver-oxide cell: chemistry, flat 1.55 V discharge, the under-2.7 µA budget, 2-second end-of-life warning |
| 5 | The quartz crystal | Piezoelectric lattice, tuning-fork flexural mode, laser trimming, the Pierce oscillator, 2¹⁵, the temperature parabola and ±15 s/month |
| 6 | The chip | 15-stage divider, digital rate correction, H-bridge motor driver with alternating pulses, the 5-per-second stopwatch pulses |
| 7 | The stepping motor | Lavet motor: saturable bridges, detent notches, why pulses alternate, two motors |
| 8 | From steps to hands | The timekeeping train, ÷30 to the seconds and ÷60 to the minutes |
| 9 | Minutes, hours and a friction fit | Motion works (12:1, 24 h) and the slipping cannon pinion |
| 10 | The date | Driving finger, 31-tooth ring, jumper; why not to set the date between 9 p.m. and 3 a.m. |
| 11 | The crown | Setting lever, yoke, clutch; the 2nd click stops the seconds while the stopwatch keeps running |
| 12 | Starting the stopwatch | The electrical start, 300 steps per turn, accumulated timing, auto-stop at 60 minutes |
| 13 | Hammer and heart | Heart-cam geometry, fly-forward and fly-back, Seiko's one-piece three-pointed hammer, a 1/100-speed reset |
| 14 | The whole machine | Specs summary |

**Film** mode plays the film with narration and subtitles. Press play first, because browsers block audio until you interact. Drag to look around; the camera eases back to the shot. **Explore** mode hands you the watch: pushers A and B, a three-position crown, explode and X-ray views, and time-lapse speeds.

## How it's built

```
index.html            page shell, layout, UI
js/core.js            renderer, studio lighting, palette materials, geometry, gear builder, stage registry, framing
js/watch.js           the watch model and a pulse-level simulation of both motors, pushers, hammer, crown and date
js/stages/*.js        close-up stages (battery, quartz, chip, motor, keyless, calendar, heart)
js/shots.js           the film: shots, cameras, events, labels and info cards, timed to narration lines
js/director.js        timeline, playback, cuts, subtitles, HUD, explore mode, deterministic seek, cue-sheet export
js/narration.js       generated: narration text and measured line durations
narration/script.json the narration script (subtitle text, plus spelled-out text for the voice)
tools/tts.py          narration synthesis with Kokoro (82M, ONNX)
tools/mix.py          soundtrack: narration on the timeline, synthesised mechanical sound effects, ducked music bed, −16 LUFS
tools/build_film.sh   full build: timeline → soundtrack → frames → MP4
dev/                  stage test page and stage-writing guide (dev/STAGES.md)
```

The simulation is deterministic. `index.html?capture=1` exposes `window.__seek(seconds)`, which rebuilds the exact state of the film at any time. The renderer seeks frame by frame and screenshots each one.

### Building the video

```bash
pip install kokoro-onnx soundfile scipy pyloudnorm
# Kokoro model files: kokoro-v1.0.onnx and voices-v1.0.bin from
# https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
KOKORO_DIR=/path/to/model-files python3 tools/tts.py     # writes audio/lines/*.wav and js/narration.js
npm i playwright-core                                    # plus a Chromium build (CHROMIUM_PATH=...)
tools/build_film.sh                                      # build/seiko-8t63-deep-dive.mp4
```

## Facts and sources

The film draws on Seiko's Cal. 8T63/8T68 instruction manual, the Seiko Cal. 8T63A parts catalogue and technical guide, Seiko product data for the SSB397, quartz-crystal and watch-IC datasheets and patents, and horology references. Key figures: 32,768 Hz crystal; two stepping motors with coil blocks of 1.45–1.65 kΩ and 1.65–1.85 kΩ; current under 2.70 µA for the movement and under 0.70 µA for the circuit block; ±15 s/month at 5–35 °C; SR936SW cell, about 3 years with 1 hour of stopwatch use a day; 30.8 mm × 5.1 mm; 0 jewels; stopwatch in 1/5 s steps, up to 60 minutes, then it stops by itself. The reset uses a one-piece, three-pointed hammer derived from the mechanical 8R28.

Some details are not published, and the film doesn't claim them:
- which coil block drives which train (the sister 8T67 labels coil A for the chronograph);
- whether the 60-minute counter creeps or jumps;
- what the hammer's third point acts on;
- the IC's pulse widths and its rate-correction period.

Generic mechanisms (Lavet motor, divider chain, keyless works, calendar) are shown as they work in quartz watches generally.

## Simplifications

Part shapes and their layout are illustrative, not taken from a service drawing. The gear trains mesh and turn their hands at the correct speeds, but the tooth counts are invented. Colours mark function: brass for timekeeping, steel for the stopwatch, blue for the reset parts, copper for the coils. Magnet poles are shown red and blue for clarity.

The narration voice is Kokoro, an open-source speech model. This is an independent explainer and is not affiliated with Seiko.
