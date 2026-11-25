#!/usr/bin/env bash
# Compares two recording runs of one episode and prints duration, size, frame pacing and visual similarity.
#   scripts/kb-recorder/measure.sh .kb-out run1 run2 home-preview desktop
set -euo pipefail
OUT="$1"; A="$2"; B="$3"; EP="$4"; PROF="$5"
fa="$OUT/$A/$EP/$PROF/$EP-$PROF"; fb="$OUT/$B/$EP/$PROF/$EP-$PROF"
for f in "$fa" "$fb"; do
  echo "== $f.mp4"
  ffprobe -v error -show_entries format=duration,size,bit_rate:stream=codec_name,width,height,r_frame_rate,nb_frames -of default=nw=1 "$f.mp4"
  # Frame pacing of the raw capture: gaps between frame timestamps (ms). Playwright records at up to 25 fps.
  ffprobe -v error -select_streams v -show_entries frame=pts_time -of csv=p=0 "$f.raw.webm" | awk -F, 'NR>1{d=($1-p)*1000; n++; s+=d; if(d>m)m=d; if(d>80)big++} {p=$1} END{printf "raw frames=%d mean gap=%.1f ms max gap=%.0f ms gaps over 80 ms=%d\n", n+1, s/n, m, big}'
done
echo "== cue start times (ms), run A vs run B"
paste <(grep -- '-->' "$fa.vtt" | cut -d' ' -f1) <(grep -- '-->' "$fb.vtt" | cut -d' ' -f1)
echo "== SSIM between runs at fixed timestamps (1.0 is identical)"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$fa.mp4" | cut -d. -f1)
for t in $(seq 4 6 "$DUR"); do
  s=$(ffmpeg -v error -ss "$t" -i "$fa.mp4" -ss "$t" -i "$fb.mp4" -frames:v 1 -filter_complex "[0:v][1:v]ssim" -f null - 2>&1 || true)
  s=$(ffmpeg -ss "$t" -i "$fa.mp4" -ss "$t" -i "$fb.mp4" -frames:v 1 -filter_complex "[0:v][1:v]ssim" -f null - 2>&1 | grep -o 'All:[0-9.]*' | head -1)
  echo "t=${t}s $s"
done
