#!/usr/bin/env bash
# Progressiv leverans: kodar om varje färdigt renderblock (1080p + 720p) medan resten renderas,
# och sätter ihop filmen + ljud direkt när sista blocket är klart.
set -u
cd "$(dirname "$0")"
NB=12
D=build/deliv
mkdir -p "$D"
done_=()
complete() { [ -n "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$1" 2>/dev/null)" ]; }
encode() {
  local k=$1 p; p=$(printf "build/parts/p%03d.mp4" "$k")
  local h s; h=$(printf "$D/h%03d.mp4" "$k"); s=$(printf "$D/s%03d.mp4" "$k")
  local IN=(-i "$p") PRE="[0:v]null[v0]"
  if [ "$k" -eq 1 ] && [ -f build/patch_a2.mp4 ]; then
    # blocket börjar 34.04 s; rättelsen gäller 35.0–40.56 s
    IN+=(-i build/patch_a2.mp4)
    PRE="[1:v]setpts=PTS-STARTPTS+0.96/TB[p];[0:v][p]overlay=eof_action=pass:enable='between(t,0.96,6.52)'[v0]"
  fi
  nice -n 10 ffmpeg -v error -y "${IN[@]}" -filter_complex \
    "$PRE;[v0]hqdn3d=0.8:0.8:2:2,split=2[a][b];[b]hqdn3d=1.5:1.5:3:3,scale=1280:720:flags=lanczos[c]" \
    -map "[a]" -an -c:v libx264 -preset medium -crf 20 -maxrate 6M -bufsize 12M -tune film -pix_fmt yuv420p -r 25 "$h" \
    -map "[c]" -an -c:v libx264 -preset medium -crf 24 -maxrate 1.8M -bufsize 3.6M -tune film -pix_fmt yuv420p -r 25 "$s"
  echo "encoded block $k $(date -u +%H:%M:%S)"
}
while [ ${#done_[@]} -lt $NB ]; do
  grep -q Traceback build/render.log && { echo "RENDER FAILED"; exit 1; }
  progressed=0
  for k in $(seq 0 $((NB - 1))); do
    [[ " ${done_[*]:-} " == *" $k "* ]] && continue
    p=$(printf "build/parts/p%03d.mp4" "$k")
    if [ -f "$p" ] && complete "$p"; then encode "$k"; done_+=("$k"); progressed=1; fi
  done
  [ $progressed -eq 0 ] && sleep 10
done
for q in h s; do
  : > "$D/$q.txt"
  for k in $(seq 0 $((NB - 1))); do printf "file '%s'\n" "$(printf "%s%03d.mp4" "$q" "$k")" >> "$D/$q.txt"; done
done
ffmpeg -v error -y -f concat -safe 0 -i "$D/h.txt" -i build/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 224k \
  -movflags +faststart -shortest Dennis_1080p.mp4
ffmpeg -v error -y -f concat -safe 0 -i "$D/s.txt" -i build/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 128k \
  -movflags +faststart -shortest Dennis_720p.mp4
echo "FINAL DONE $(date -u +%H:%M:%S)"
ls -la Dennis_*.mp4
