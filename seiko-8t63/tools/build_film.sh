#!/usr/bin/env bash
# Full film build: timeline + cue sheet -> soundtrack -> frames (parallel workers) -> MP4.
# Env: CHROMIUM_PATH, THREE_PATH, PW_PATH as for render_video.js; WORKERS (default 4); FPS (default 24).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${OUT:-build}; FPS=${FPS:-24}; WORKERS=${WORKERS:-4}
mkdir -p "$OUT/frames" audio
node tools/export_timeline.js "$OUT/timeline.json" "$OUT/sfx.json"
python3 tools/mix.py "$OUT/timeline.json" "$OUT/sfx.json" "$OUT/film.wav"
ffmpeg -v error -y -i "$OUT/film.wav" -c:a libmp3lame -b:a 128k audio/film.mp3
ffmpeg -v error -y -i "$OUT/film.wav" -c:a aac -b:a 160k "$OUT/film.m4a"
N=$(python3 -c "import json,math;print(math.ceil(json.load(open('$OUT/timeline.json'))['total']*$FPS))")
CH=$(( (N + WORKERS - 1) / WORKERS ))
for w in $(seq 0 $((WORKERS - 1))); do
  sleep $((w * 20)) && node render_video.js "$OUT/frames" "$FPS" 1280 720 $((w * CH)) $(( (w + 1) * CH - 1 )) > "$OUT/render_$w.log" 2>&1 &
done
wait
ffmpeg -v error -y -framerate "$FPS" -i "$OUT/frames/f%05d.jpg" -i "$OUT/film.m4a" -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -c:a copy -movflags +faststart -shortest "$OUT/seiko-8t63-deep-dive.mp4"
echo "built $OUT/seiko-8t63-deep-dive.mp4"
