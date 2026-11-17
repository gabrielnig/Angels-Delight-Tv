#!/bin/sh
# One-shot bucket setup for local development. Safe to run again.
# Reads MINIO_ROOT_USER and MINIO_ROOT_PASSWORD from the compose environment.
set -eu

mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"

mc mb --ignore-existing local/ad-originals
mc mb --ignore-existing local/ad-media

# ad-originals stays private. ad-media is readable only under the prefixes the player and pages use.
for prefix in v img cap; do
  mc anonymous set download "local/ad-media/$prefix"
done

echo "buckets ready"
