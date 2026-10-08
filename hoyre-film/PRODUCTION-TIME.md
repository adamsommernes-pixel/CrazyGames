# Production time – «Tre vinduer»

## The short answer

| | Conventional production | This pipeline |
|---|---|---|
| Making the film (voice, 34 shots, graphics, music, sound, edit) | **3–5 weeks** (AI image-to-video + After Effects) or **6–10 weeks** (3D animator in Blender) | **≈ 2 hours** wall clock: about 1 hour of building and about 1 hour of unattended rendering |
| Fact check + Høyre approval | 1–2 weeks of calendar time | Same. This cannot be automated, and the film stays marked **UTKAST** until it is done |
| One corrected number after review | 0.5–1 day (re-composite and re-export) | Edit one line, then re-render that 10-second block: **≈ 10 min** |
| Add the missing K8 sentence | 1–2 days (re-record, re-cut, re-time graphics) | Edit `manus.py` and re-run voice + render: **≈ 1 h**, all unattended |

The 1–2 weeks for fact checking and approval are calendar time on Høyre's side, not production time. They sit on top of either column.

## Where the time was cut

1. **One town instead of 34 scenes.** The shot list reads like 34 separate illustrations. Here, 23 of the 34 shots are camera moves inside a few shared sets:
   - the town: street, harbour, station, school, clinic, police house
   - the three rooms
   - the evidence board
   - the plinth stage
   - the map

   Each set was modelled once, and in the conventional AI route keeping 34 generated scenes consistent is the slowest part. The same reuse is why S31 (the whole town at dawn) costs nothing extra: it is already built.
2. **Everything is timed from the voice.** Shots, on-screen numbers, bullet points, music cues and sound effects all read their timing from `build/timeline.json`. There is no manual edit and no re-timing when a line changes length.
3. **One template per graphic.** The stat card, source line, bullet list, chapter card, party label and chat bubble are each written once (`film/overlay.py`). The shot list asks for every number to be set in post anyway, so a fact-check correction is a text edit, not a re-animation.
4. **Every Høyre input is in one file.** The blue, the logo, the URLs and the draft flag live in `config.py`. Swapping the placeholder blue for Høyre's real HEX is a single value.
5. **Synthetic voice now, real voice later.** The TTS voice unblocks the edit on day one. A recorded voice can replace it sentence by sentence, and the timeline re-builds around it.
6. **Reuse from the Åland film.** The DSP helpers, mix chain, loudness targeting, render driver and delivery scripts were already written and tested.
7. **1080p master, not 4K.** 4K is about 4× the render time for a film that will be watched on phones. It is a setting (`config.SCALE`) if it is ever needed.
8. **Resumable 10-second render blocks.** A change re-renders only the blocks it touches, and the render runs unattended on 4 cores.
9. **A faster renderer, with checked output.** Profiling showed that a third of each frame went on work that does not change the picture:
   - The soft panels behind text blurred a full-frame mask. They are now computed analytically.
   - The town's shadow map was rebuilt every frame. Static geometry is now cached and only moving objects are drawn on top.
   - Bloom and depth of field blurred their wide radii at full resolution.
   - Large buffers were reallocated every frame.

   Frames went from 2.3 to 1.6 s, and old and new frames differ by at most a few levels out of 255.
10. **Review from a contact sheet.** `render.py sheet --ss 1` shows one frame of every shot in about 40 seconds, so problems are caught before the long render.

## What was not cut (and should not be)

- **Fact check against primary sources** (`05-kildeliste.md`). The network here blocked ssb.no, fhi.no and others, so no number has been read at its source.
- **Høyre's approval** of the policy wording (K13, K22, K26), and checking the other parties' positions (K12, K21).
- **Høyre's logo and exact blue**, which only Høyre can supply.
- Optional but recommended: **a human voice**. The Piper voice is clear, but it is a synthetic voice.

## Actual timeline in this session (8 Oct 2026, UTC)

| Time | Step |
|---|---|
| 19:21 | Start: read the package and the Åland pipeline |
| 19:33 | Narration done: 33 lines synthesized, timeline built (6:49) |
| 19:40 | Renderer working (first test street) |
| 19:56 | All 34 shots render; first contact sheet |
| 20:00 | Full-quality render started (≈ 10 200 frames, 4 workers) |
| 20:19 | Render restarted with the profiled speedups (≈ 30 % faster); finished blocks kept |
| 20:12 | Score and mix done (−16 LUFS) |
| ≈ 21:20 | Render finished, master + 720p + subtitles |

For comparison, the estimate given before starting was 6–8 hours. It came in well under that, because the shared town set and the Åland code covered more than expected.
