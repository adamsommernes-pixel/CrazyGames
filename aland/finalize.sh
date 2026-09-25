#!/usr/bin/env bash
# Väntar på bildrenderingen, lägger på ljudet och gör en delbar fil.
set -e
cd "$(dirname "$0")"
until grep -qE "video ->|Traceback" build/render2.log; do sleep 5; done
grep -q Traceback build/render2.log && { echo "RENDER FAILED"; exit 1; }
inputs=(); fc=""
for k in $(seq 0 11); do
  inputs+=(-i "build/parts/p$(printf %03d $k).mp4"); fc+="[$k:v]"
done
ffmpeg -y -loglevel error "${inputs[@]}" -i build/mix.wav \
  -filter_complex "${fc}concat=n=12:v=1:a=0[v]" -map "[v]" -map 12:a \
  -c:v libx264 -preset fast -crf 21 -tune film -pix_fmt yuv420p -r 25 \
  -c:a aac -b:a 256k -movflags +faststart -shortest Aland_Mellan_tva_riken.mp4
echo "FINAL DONE"
ls -la Aland_Mellan_tva_riken.mp4
