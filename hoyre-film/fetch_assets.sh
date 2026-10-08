#!/usr/bin/env bash
# Fetches what is not in the repo: Norwegian Piper voice, fonts (OFL) and Norway's outline (Natural Earth).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p assets/voice assets/fonts assets/geo

[ -f assets/voice/no-talesyntese-medium.onnx ] || {
  curl -sSL -o voice-no.tar.gz https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-no-talesyntese-medium.tar.gz
  tar xzf voice-no.tar.gz -C assets/voice && rm voice-no.tar.gz
}

G=https://raw.githubusercontent.com/google/fonts/main/ofl
for f in barlow/Barlow-Light.ttf barlow/Barlow-Regular.ttf barlow/Barlow-Medium.ttf barlow/Barlow-SemiBold.ttf \
         barlow/Barlow-Bold.ttf barlowcondensed/BarlowCondensed-Regular.ttf barlowcondensed/BarlowCondensed-Medium.ttf \
         barlowcondensed/BarlowCondensed-SemiBold.ttf ibmplexmono/IBMPlexMono-Regular.ttf ibmplexmono/IBMPlexMono-Light.ttf; do
  [ -f assets/fonts/$(basename $f) ] || curl -sSfL -o assets/fonts/$(basename $f) $G/$f
done

[ -f assets/geo/norway.geojson ] || {
  curl -sSfL -o assets/geo/countries.geojson \
    https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson
  python3 - <<'PY'
import json
d = json.load(open("assets/geo/countries.geojson"))
f = next(f for f in d["features"] if f["properties"].get("ADM0_A3") == "NOR")
json.dump(f, open("assets/geo/norway.geojson", "w"))
PY
  rm assets/geo/countries.geojson
}
echo "assets ready"
