#!/usr/bin/env bash
# Hämtar externa resurser som inte ligger i repot (röstmodell, satellitdata, kartdata, texturer, typsnitt).
set -euo pipefail
cd "$(dirname "$0")/assets"

# Piper TTS + svensk röst (NST, man)
mkdir -p voice
[ -f voice/sv-se-nst-medium.onnx ] || {
  curl -sSL -o voice-sv.tar.gz https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-sv-se-nst-medium.tar.gz
  tar xzf voice-sv.tar.gz -C voice && rm voice-sv.tar.gz
}

# Natural Earth
mkdir -p geo
N=https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson
for f in ne_10m_land ne_10m_admin_0_countries ne_10m_lakes ne_10m_admin_0_boundary_lines_land \
         ne_50m_land ne_50m_admin_0_countries ne_50m_lakes ne_50m_admin_0_boundary_lines_land; do
  [ -f geo/$f.geojson ] || curl -sSfL -o geo/$f.geojson $N/$f.geojson
done

# Jordtextur
mkdir -p tex
[ -f tex/earth_day_4096.jpg ] || curl -sSfL -o tex/earth_day_4096.jpg \
  https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_day_4096.jpg

# Typsnitt (OFL)
mkdir -p fonts
G=https://raw.githubusercontent.com/google/fonts/main/ofl
for f in barlow/Barlow-Light.ttf barlow/Barlow-Regular.ttf barlow/Barlow-Medium.ttf barlow/Barlow-SemiBold.ttf \
         barlowcondensed/BarlowCondensed-Regular.ttf barlowcondensed/BarlowCondensed-Medium.ttf \
         ibmplexmono/IBMPlexMono-Regular.ttf ibmplexmono/IBMPlexMono-Light.ttf \
         cormorantsc/CormorantSC-Regular.ttf cormorantsc/CormorantSC-Medium.ttf; do
  [ -f fonts/$(basename $f) ] || curl -sSfL -o fonts/$(basename $f) $G/$f
done
[ -f fonts/CormorantGaramond-VF.ttf ] || curl -sSfL -o fonts/CormorantGaramond-VF.ttf "$G/cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf"
[ -f fonts/CormorantGaramond-Italic-VF.ttf ] || curl -sSfL -o fonts/CormorantGaramond-Italic-VF.ttf "$G/cormorantgaramond/CormorantGaramond-Italic%5Bwght%5D.ttf"

# Sentinel-2 (Copernicus), molnfri scen 2020-06-14, rutor 34VDM/EM/DN/EN
mkdir -p s2
B=https://storage.googleapis.com/gcp-public-data-sentinel-2
for t in DM EM DN EN; do
  G2="tiles/34/V/$t/S2A_MSIL1C_20200614T100031_N0209_R122_T34V${t}_20200614T121308.SAFE/GRANULE/L1C_T34V${t}_A026002_20200614T100243"
  [ -f s2/T34V${t}_TCI.jp2 ] || curl -sS -o s2/T34V${t}_TCI.jp2 "$B/$G2/IMG_DATA/T34V${t}_20200614T100031_TCI.jp2"
  [ -f s2/T34V${t}_MTD_TL.xml ] || curl -sS -o s2/T34V${t}_MTD_TL.xml "$B/$G2/MTD_TL.xml"
done
for t in DM EM; do
  G2="tiles/34/V/$t/S2A_MSIL1C_20200614T100031_N0209_R122_T34V${t}_20200614T121308.SAFE/GRANULE/L1C_T34V${t}_A026002_20200614T100243"
  [ -f s2/T34V${t}_B08.jp2 ] || curl -sS -o s2/T34V${t}_B08.jp2 "$B/$G2/IMG_DATA/T34V${t}_20200614T100031_B08.jp2"
done
echo "klart"
