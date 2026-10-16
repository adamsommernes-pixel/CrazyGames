# The Warning: Rudolf Vrba and Alfred Wetzler, 1944

A roughly 10-minute animated documentary in English about Rudolf Vrba and Alfred Wetzler's escape from Auschwitz-Birkenau in April 1944, and their report.

| File | What it is |
|---|---|
| `SCRIPT.md` | Narration (about 1,470 words), with picture notes and `[F#]` fact tags |
| `FACTS.md` | Every claim in the script, its sources, status and where accounts disagree |
| `SOURCES.md` | Images and media, with source, author and licence (currently only candidates) |

## Status

1. ~~Network check~~ (results below)
2. **Script and FACTS.md: waiting for review**
3. Voice samples
4. Test scene (the woodpile, about 30 s)
5. Remaining scenes in batches

## Network check (2026-10-16)

| What | Result |
|---|---|
| pip / PyPI | OK |
| GitHub release assets, raw.githubusercontent.com | OK (Kokoro ONNX model, 325 MB, is downloadable) |
| Web search | OK |
| huggingface.co | **Blocked** (403 from the environment's network policy), so no F5-TTS weights |
| commons.wikimedia.org, upload.wikimedia.org, *.wikipedia.org | **Blocked** |
| loc.gov, catalog.archives.gov, archive.org | **Blocked** |
| collections.ushmm.org, yadvashem.org, auschwitz.org | **Blocked** |
| api.elevenlabs.io | **Blocked** |
| GPU | None; 4 CPU cores, 15 GB RAM |

## Planned pipeline

- **Picture:** procedural 2D animation in code, with paper grain, ink wash, charcoal strokes, wobble and boiling lines on twos, film grain, gate weave and vignette. Frames are rendered at 1920×1080, 24 fps, then encoded with ffmpeg.
- **Voice:** Kokoro (local) and possibly F5-TTS. The script is synthesised per sentence, and scenes are cut to the measured timings.
- **Photos:** licensed or public-domain archival images only, with slow pan and zoom, grain and fades. Each one is logged in `SOURCES.md`.
- Large media (renders, audio, downloaded models) stays out of git; see `.gitignore`.
