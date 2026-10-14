# Inside the Seiko 8T63

An animated 3D explainer of the Seiko caliber 8T63 quartz chronograph, built around case 8T63-00T0 (Seiko SSB397). It is one self-contained page: open `index.html` in a browser. three.js and the fonts load from public CDNs, so you need an internet connection.

## What it shows

A 2.5-minute guided tour in 12 chapters, followed by a free Explore mode.

| # | Chapter | What happens |
|---|---|---|
| 1 | The watch | Turntable view of the 41 mm case, pushers, crown and tachymeter bezel |
| 2 | Reading the dial | Hour/minute hands, small seconds at 6, 24-hour hand at 3, stopwatch counter at 9, date at 4:30 |
| 3 | Opening it up | Exploded view of 12 layers, from the crystal to the case back |
| 4 | Power | Current flows from the SR936SW cell through the circuit block to the IC |
| 5 | The quartz crystal | A magnified tuning fork vibrates, and the IC halves 32,768 Hz fifteen times to get 1 Hz |
| 6 | Motor A runs the time | Coil A pulses once a second, the rotor flips 180°, and the gear train turns the seconds and minutes |
| 7 | Hours and the 24-hour hand | Cannon pinion, minute wheel and hour wheel (12:1), plus the 24-hour wheel, shown as a ×600 time-lapse |
| 8 | Pusher A starts the stopwatch | The switch lever closes, motor B gets 5 pulses/s, and the hand steps 1/5 s; the minute counter advances |
| 9 | Pusher A again stops it | Motor B stops while motor A keeps running |
| 10 | Pusher B: hammer and heart cams | Slow-motion reset: the hammer drives both heart cams back to zero, so hands past 30 s fly forward and the rest fly back |
| 11 | The crown | 1st click sets the date; 2nd click stops the train and the circuit so the hands can be set |
| 12 | The whole picture | Reassembled watch and a spec summary |

The heart-cam reset is simulated physically: each cam's angle is limited by how far the hammer face has dropped, so the snap to zero comes from the geometry, not from a scripted tween.

**Controls:** drag to orbit, scroll or pinch to zoom, Space to play or pause, ← → to move between chapters. Click the chapter rail to jump. **Explore** mode lets you press pushers A and B, pull and turn the crown, explode the layers, switch on X-ray, and run time at ×60 or ×600. Pressing B while the stopwatch runs is blocked, as on the real watch.

## Facts used

- Caliber 8T63: quartz chronograph with a mechanical (hammer and heart cam) reset, often called meca-quartz. It is Seiko's in-house counterpart of the VK63.
- 32,768 Hz quartz oscillator. Two stepping motors (coil blocks A and B). 0 jewels. Accuracy ±15 s/month.
- Stopwatch: up to 60 minutes, stops automatically at 60. Pusher A starts and stops it; pusher B resets it, and only once it is stopped.
- Crown: normal position, 1st click for the date, 2nd click for the time, which also resets the circuit and stops the train.
- Battery SR936SW (1.55 V silver oxide), about 3 years. Movement about 30.8 mm across.
- Case 8T63-00T0 is the SSB397: 41 mm steel, black embossed dial, tachymeter bezel, 100 m water resistance.

Sources: Seiko's 8T63/8T68 instruction manual, the Seiko Cal. 8T63A parts catalogue / technical guide, Seiko and retailer product pages for the SSB397, and Caliber Corner's 8T63 entry.

The stopwatch step is shown as 1/5 s, which is what Seiko's instruction manual and product pages state. The technical guide's summary line says "one second increments".

## Simplifications

Part shapes and their positions are illustrative, not taken from a service drawing. The gear ratios are real in the sense that every train meshes and turns its hands at the correct speed: the rotor flips every second, the seconds wheel turns once a minute, the centre wheel once an hour, the hour wheel once in 12 h and the 24-hour wheel once a day; the stopwatch train makes 300 steps per turn. Tooth counts, wheel sizes and the lever linkages are invented to fit the layout.

Colours mark function: brass for timekeeping, steel for the stopwatch, blue for the reset parts, copper for the motor coils. The magnet poles are red and blue only to make the rotor's half-turn visible.

This is an independent explainer and is not affiliated with Seiko.

## Rendering frames

`index.html?capture=1` disables the animation loop and exposes `window.__seek(seconds)`, which rebuilds the exact state of the tour at any time. The tour is deterministic, so a headless browser can seek frame by frame and screenshot each one to make a video. `render_video.js` does this:

```bash
npm i playwright-core                              # plus a Chromium build (CHROMIUM_PATH=... if needed)
node render_video.js frames 30 1280 720            # 4,680 JPEG frames for the 2:36 tour
ffmpeg -framerate 30 -i frames/f%05d.jpg -c:v libx264 -crf 18 -pix_fmt yuv420p seiko-8t63.mp4
```

Optional arguments 5 and 6 set a first and last frame, so several processes can each render part of the tour in parallel.
