#!/usr/bin/env bash
# Väntar på bildrenderingen, lägger på ljudet och gör en master + en liten delbar version.
set -e
cd "$(dirname "$0")"
LOG=${1:-build/render.log}
until grep -qE "video ->|Traceback" "$LOG"; do sleep 5; done
grep -q Traceback "$LOG" && { echo "RENDER FAILED"; exit 1; }
n=$(ls build/parts/p*.mp4 | wc -l)
inputs=(); fc=""
for k in $(seq 0 $((n - 1))); do
  inputs+=(-i "build/parts/p$(printf %03d $k).mp4"); fc+="[$k:v]"
done
ffmpeg -y -loglevel error "${inputs[@]}" -i build/mix.wav \
  -filter_complex "${fc}concat=n=$n:v=1:a=0[v]" -map "[v]" -map $n:a \
  -c:v libx264 -preset fast -crf 21 -tune film -pix_fmt yuv420p -r 25 \
  -c:a aac -b:a 256k -movflags +faststart -shortest Aland_Mellan_tva_riken.mp4
echo "MASTER DONE"
# liten version (< 30 MB)
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 Aland_Mellan_tva_riken.mp4)
vk=$(python3 -c "print(int(29.0*1024*1024*8*0.985/$dur/1000 - 96))")
mkdir -p build/pass
VF="hqdn3d=2.5:2.5:5:5,scale=1280:720:flags=lanczos"
ffmpeg -v error -y -i Aland_Mellan_tva_riken.mp4 -vf "$VF" -c:v libx264 -preset slow -b:v ${vk}k -tune film \
  -pass 1 -passlogfile build/pass/x -an -f mp4 /dev/null
ffmpeg -v error -y -i Aland_Mellan_tva_riken.mp4 -vf "$VF" -c:v libx264 -preset slow -b:v ${vk}k -tune film \
  -pass 2 -passlogfile build/pass/x -c:a aac -b:a 96k -movflags +faststart Aland_Mellan_tva_riken_720p.mp4
echo "FINAL DONE"
ls -la Aland_Mellan_tva_riken*.mp4
