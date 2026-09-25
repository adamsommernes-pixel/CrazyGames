#!/usr/bin/env bash
# Väntar på bildrenderingen, lägger på ljudet och gör leveransfiler.
# Valfri rättelse: build/patch_a2.mp4 (från patch.py) läggs över huvudrenderingen 35.0–40.6 s.
set -e
cd "$(dirname "$0")"
LOG=${1:-build/render.log}
until grep -qE "video ->|Traceback" "$LOG"; do sleep 5; done
grep -q Traceback "$LOG" && { echo "RENDER FAILED"; exit 1; }
IN=(-i build/video_only.mp4)
PRE="[0:v]null[v0]"
if [ -f build/patch_a2.mp4 ]; then
  IN+=(-i build/patch_a2.mp4)
  PRE="[1:v]setpts=PTS-STARTPTS+35.0/TB[p];[0:v][p]overlay=eof_action=pass:enable='between(t,35.0,40.56)'[v0]"
fi
A=${#IN[@]}; A=$((A / 2))
# 1080p (hög kvalitet, rimlig storlek)
ffmpeg -v error -y "${IN[@]}" -i build/mix.wav \
  -filter_complex "$PRE;[v0]hqdn3d=0.8:0.8:2:2[v]" -map "[v]" -map $A:a \
  -c:v libx264 -preset medium -crf 20 -maxrate 6M -bufsize 12M -tune film \
  -pix_fmt yuv420p -r 25 -c:a aac -b:a 224k -movflags +faststart -shortest Dennis_1080p.mp4 &
# 720p (liten, lätt att skicka)
ffmpeg -v error -y "${IN[@]}" -i build/mix.wav \
  -filter_complex "$PRE;[v0]hqdn3d=2:2:4:4,scale=1280:720:flags=lanczos[v]" -map "[v]" -map $A:a \
  -c:v libx264 -preset medium -crf 24 -maxrate 1.8M -bufsize 3.6M -tune film \
  -pix_fmt yuv420p -r 25 -c:a aac -b:a 128k -movflags +faststart -shortest Dennis_720p.mp4 &
wait
echo "FINAL DONE"
ls -la Dennis_*.mp4
