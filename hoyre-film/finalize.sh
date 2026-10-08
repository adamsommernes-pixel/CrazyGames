#!/usr/bin/env bash
# Waits for the picture render, lays the mix under it, and makes a 1080p master plus a small
# shareable 720p file (< 30 MB). Also writes the subtitle file.
set -e
cd "$(dirname "$0")"
LOG=${1:-build/render.log}
until grep -qE "video ->|Traceback" "$LOG"; do sleep 5; done
grep -q Traceback "$LOG" && { echo "RENDER FAILED"; exit 1; }
OUT=Tre_vinduer
# shareable 720p first (straight from the render), then the 1080p master
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 build/video_only.mp4)
vk=$(python3 -c "print(int(29.0*1024*1024*8*0.985/$dur/1000 - 96))")
mkdir -p build/pass
VF="scale=1280:720:flags=lanczos"
ffmpeg -v error -y -i build/video_only.mp4 -vf "$VF" -c:v libx264 -preset medium -b:v ${vk}k \
  -pass 1 -passlogfile build/pass/x -an -f mp4 /dev/null
ffmpeg -v error -y -i build/video_only.mp4 -i build/mix.wav -map 0:v -map 1:a -vf "$VF" -c:v libx264 -preset medium \
  -b:v ${vk}k -pass 2 -passlogfile build/pass/x -c:a aac -b:a 96k -movflags +faststart -shortest ${OUT}_720p.mp4
echo "720P DONE"
ffmpeg -y -loglevel error -i build/video_only.mp4 -i build/mix.wav -map 0:v -map 1:a \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -r 25 \
  -c:a aac -b:a 256k -movflags +faststart -shortest $OUT.mp4
echo "MASTER DONE"
python3 render.py srt
echo "FINAL DONE"
ls -la ${OUT}*.mp4
