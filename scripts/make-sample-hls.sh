#!/usr/bin/env bash
# Generates small test HLS streams for the player fixtures and the Playwright smoke test.
# Usage: scripts/make-sample-hls.sh [output dir]   (default apps/web/public/fixtures/hls)
# Needs ffmpeg with libx264 and aac. Writes:
#   plain/master.m3u8   unencrypted, three renditions (240p, 360p, 480p), 24 seconds
#   enc/master.m3u8     the same with AES-128, key URI ad-key://sample, key file enc/enc.key
# Output is git ignored. Never ship it: the key file is a fixture.
set -euo pipefail

OUT="${1:-apps/web/public/fixtures/hls}"
mkdir -p "$OUT/plain" "$OUT/enc"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found" >&2
  exit 1
fi

encode() {
  local dir="$1"
  shift
  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "testsrc2=size=854x480:rate=24" \
    -f lavfi -i "sine=frequency=440:sample_rate=44100" \
    -t 24 \
    -filter_complex "[0:v]split=3[a][b][c];[a]scale=-2:240[v0];[b]scale=-2:360[v1];[c]scale=-2:480[v2]" \
    -map "[v0]" -map "[v1]" -map "[v2]" -map 1:a -map 1:a -map 1:a \
    -c:v libx264 -preset veryfast -profile:v main -g 48 -keyint_min 48 -sc_threshold 0 \
    -b:v:0 250k -b:v:1 500k -b:v:2 900k \
    -c:a aac -b:a 64k -ar 44100 \
    -f hls -hls_time 4 -hls_playlist_type vod -hls_segment_type mpegts \
    -master_pl_name master.m3u8 \
    -var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2" \
    -hls_segment_filename "$dir/v%v/seg_%03d.ts" \
    "$@" \
    "$dir/v%v/index.m3u8"
}

for v in 0 1 2; do mkdir -p "$OUT/plain/v$v" "$OUT/enc/v$v"; done

encode "$OUT/plain"

# AES-128: the key file, then a key info file (URI, path, no explicit IV).
head -c 16 /dev/urandom >"$OUT/enc/enc.key"
printf 'ad-key://sample\n%s\n' "$OUT/enc/enc.key" >"$OUT/enc/key.info"
encode "$OUT/enc" -hls_key_info_file "$OUT/enc/key.info"

echo "sample streams written to $OUT"
