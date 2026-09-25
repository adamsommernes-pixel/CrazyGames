#!/usr/bin/env bash
# Snabbare slut: sista blocket (p011, rutor 9367–10218) delas upp. Huvudarbetaren renderar 9367–9799,
# två hjälpare renderar 9800–10009 (tail_a) och 10010–10218 (tail_b). Skriptet tar över från deliver.sh.
set -u
set -f
cd "$(dirname "$0")"
D=build/deliv
log() { echo "$* $(date -u +%H:%M:%S)"; }
complete() { [ -n "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$1" 2>/dev/null)" ]; }
chain_h="hqdn3d=0.8:0.8:2:2,split=2[a][b];[b]hqdn3d=1.5:1.5:3:3,scale=1280:720:flags=lanczos[c]"
enc_out() {  # $1 = h-fil, $2 = s-fil
  echo -map "[a]" -an -c:v libx264 -preset medium -crf 20 -maxrate 6M -bufsize 12M -tune film -pix_fmt yuv420p -r 25 "$1" \
       -map "[c]" -an -c:v libx264 -preset medium -crf 24 -maxrate 1.8M -bufsize 3.6M -tune film -pix_fmt yuv420p -r 25 "$2"
}
# 1. låt deliver.sh bli klar med pågående block, stoppa den sedan
until ! pgrep -f "^ffmpeg .*build/deliv" >/dev/null; do sleep 3; done
pkill -f "^bash ./deliver.sh$"; pkill -f "^/bin/bash ./deliver.sh$"
sleep 1
until ! pgrep -f "^ffmpeg .*build/deliv" >/dev/null; do sleep 3; done
log "deliver stopped"
# 2. vänta på hjälparna och på att huvudarbetaren passerat ruta 9800 (logg '501/852' = 501 rutor klara)
until grep -q "patch ->" build/tail_a.log && grep -q "patch ->" build/tail_b.log; do sleep 3; done
log "helpers done"
FP=$(pgrep -f "^ffmpeg .*build/parts/p011.mp4" | head -1)
# rutor inlästa av huvudarbetarens ffmpeg = lästa byte / (1920*1080*3)
until [ $(( $(awk '/^rchar/ {print $2}' /proc/$FP/io) / 6220800 )) -ge 436 ]; do sleep 1; done
WP=$(ps -o ppid= -p "$FP" | tr -d ' ')
kill -TERM "$WP"
while kill -0 "$FP" 2>/dev/null; do sleep 1; done
log "main worker stopped"
# 3. koda de block som deliver.sh inte hann med (bl.a. 8), sedan 11 från tre delar
for k in $(seq 0 10); do
  h=$(printf "$D/h%03d.mp4" "$k"); s=$(printf "$D/s%03d.mp4" "$k"); p=$(printf "build/parts/p%03d.mp4" "$k")
  [ -f "$s" ] && complete "$s" && continue
  until complete "$p"; do sleep 5; done
  IN=(-i "$p"); PRE="[0:v]null[v0]"
  if [ "$k" -eq 1 ]; then
    IN+=(-i build/patch_a2.mp4)
    PRE="[1:v]setpts=PTS-STARTPTS+0.96/TB[p];[0:v][p]overlay=eof_action=pass:enable='between(t,0.96,6.52)'[v0]"
  fi
  ffmpeg -v error -y "${IN[@]}" -filter_complex "$PRE;[v0]$chain_h" $(enc_out "$h" "$s")
  log "encoded block $k"
done
ffmpeg -v error -y -i build/parts/p011.mp4 -i build/tail_a.mp4 -i build/tail_b.mp4 -filter_complex \
  "[0:v]trim=end_frame=433,setpts=PTS-STARTPTS[x];[1:v]setpts=PTS-STARTPTS[y];[2:v]setpts=PTS-STARTPTS[z];[x][y][z]concat=n=3:v=1:a=0[v0];[v0]$chain_h" \
  $(enc_out "$D/h011.mp4" "$D/s011.mp4")
log "encoded block 11 (stitched)"
# 4. sätt ihop + ljud
for q in h s; do
  : > "$D/$q.txt"
  for k in $(seq 0 11); do printf "file '%s'\n" "$(printf "%s%03d.mp4" "$q" "$k")" >> "$D/$q.txt"; done
done
ffmpeg -v error -y -f concat -safe 0 -i "$D/h.txt" -i build/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 224k \
  -movflags +faststart -shortest Dennis_1080p.mp4
ffmpeg -v error -y -f concat -safe 0 -i "$D/s.txt" -i build/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 128k \
  -movflags +faststart -shortest Dennis_720p.mp4
log "FINAL DONE"
ls -la Dennis_*.mp4
