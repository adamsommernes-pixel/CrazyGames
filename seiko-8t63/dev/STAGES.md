# Writing a close-up stage

The film cuts between the full watch model (`js/watch.js`) and **stages**: close-up scenes that explain one mechanism in depth (the quartz fork, the stepping motor, the heart cam…). Each stage is one file, `js/stages/<name>.js`, registered with `WX.registerStage`.

## API

```js
WX.registerStage('motor', function (ctx) {
  const { THREE, WX, group, overlay, anchor } = ctx;
  // build meshes under `group` (stage-local coordinates, millimetres, +Y up, camera looks toward -Z by default)
  // build 2D diagrams as HTML/SVG inside `overlay` (a full-frame absolutely positioned div)
  anchor('rotor', group, 0, 0, 1);          // label anchor, referenced in shots as 'motor:rotor'
  return {
    cameras: { overview: { t: [0, 0, 0], yaw: 0.3, pitch: 0.25, dist: 80 }, ... },
    update(u, p, T, dur) { /* pose everything for time u (seconds since the shot started) */ },
    overlay(u, p, T, dur) { /* optional: update the 2D overlay after the 3D frame is drawn */ },
  };
});
```

- `u`: seconds since the shot started. `dur`: shot length in seconds. `T`: global film time (use it only for continuous ambient motion). `p`: the shot's parameter object, for example `{ mode: 'pulse', slow: 0.1 }`.
- **Deterministic:** `update` and `overlay` must be pure functions of `(u, p, T, dur)`. Keep no state that accumulates across frames. The video renderer seeks to arbitrary times, so frame N must look the same whether or not frame N−1 was rendered. Compute positions directly from time, using `WX.ease`, `WX.smooth` and `WX.win`.
- Every mode must look complete at `u = 0`. Animate *within* the shot, timed relative to `dur`: a beat at `0.3 * dur` adapts when narration timing changes. Absolute seconds are fine for short beats under 2 s.
- Cameras use the same convention as the director: `t` = target in stage-local mm, `yaw` (radians around +Y; 0 = looking from +Z), `pitch` (radians, + = from above), `dist` (mm, scaled automatically for screen size). The director can move between your cameras or drift them. Provide 2–5 named cameras that frame each mode well at 1280×720.
- Hide or show sub-objects per mode (`obj.visible`, material opacity). Every stage is built once at startup and shown only during its shots.

## Look and conventions

- Use the shared palette: `WX.mat(kind)` with `steel, brushed, dark, brass, nickel, blued, plate, pin, stator, softIron, coil, copper, magN, magS, chip, silicon, gold, battery, zinc, silverOxide, separator, plastic, quartz, glass, ghost, glow, glowWarm, flat, line, leader`. Create new `THREE.Mesh*Material`s only when nothing fits, and keep the same dark-studio feel.
- Colour meanings across the film: **brass** = timekeeping parts, **steel/nickel** = stopwatch parts, **blue (blued)** = reset parts, **copper** = coils and wire, **blue glow (`glow`, `WX.COL.pulse` #78c3ff)** = electric current and pulses, **copper/orange (`WX.COL.copper` #e39a5c)** = annotations and highlights, **red/blue** = magnetic north/south.
- Background is the page's dark gradient: the canvas is transparent, so don't add a floor or sky.
- 2D overlays: use the classes in `css/stage-overlay.css` (`ov-card`, `ov-k`, `ov-big`, `ov-eq`, `ov-accent`, `ov-pulse`, `ov-muted`) and inline SVG. Text in IBM Plex Sans / IBM Plex Mono. Keep diagrams clean: thin strokes, no drop shadows, no emoji.
- **Safe areas at 1280×720:** keep overlays and key 3D content out of the top-left (brand: x < 330, y < 70), the top-right (live readouts: x > 1000, y < 260 when used), and the bottom band (subtitles: y > 608). The test page draws the bottom band.
- Use real numbers where they are known (32,768 Hz, 2¹⁵, 1.55 V, 1.45–1.65 kΩ). Where shapes or sizes are invented, keep them plausible and don't print them as facts.
- Performance: aim for under ~150 draw calls and ~150k triangles per stage. Reuse geometries and materials.
- Helpers in `WX` (see `js/core.js`): `extrude, polyShape, barShape, roundRect, ringShape, heartShape, cylGeo` (axis Z), `cylY` (axis Y), `gearGeo(z, thick, spokes, module)` + `meshPhase`, `pr(z, module)`, `textPlane(text, {size, color})` (a text label in 3D), `beads(points, n, {size, warm})` (dots that travel along a curve; call `.userData.update(phase)`), `tubeGeo(points, r)`, `lineGeo(points)`, `canvasTex(w, h, draw)`, `project(obj)` (3D → overlay pixel coordinates; valid inside `overlay()`), `win(u, a, b, fadeIn, fadeOut)`, `ease, smooth, easeOut, easeIn, clamp, lerp, deg, TAU`.

## Testing

Render your stage alone (Chromium is headless, so WebGL is software-rendered and slow, but the output is correct):

```bash
cd seiko-8t63/dev
SP=/tmp/claude-0/-home-user-CrazyGames/9b561b0d-8467-5c90-a1c0-a96984a1cdfd/scratchpad
PW_PATH=$SP/tools/node_modules/playwright-core CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
THREE_PATH=$SP/tools/node_modules/three/build/three.min.js \
node shoot_stage.js motor $SP/stage_motor '[{"cam":"overview","u":0,"p":{"mode":"rest"}},{"cam":"overview","u":2.5,"p":{"mode":"pulse"}}]'
```

Then open the PNGs with the Read tool and look at them. The script prints console errors. There must be none.

Each entry in the JSON array is one screenshot: `cam` is a camera name (or an inline camera object), `u` the time, `dur` the shot length (default 10) and `p` the params; `T` defaults to `u`. Check a mode at its start, middle and end (`u = 0`, `dur/2`, `dur - 0.1`).
