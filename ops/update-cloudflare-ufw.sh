#!/usr/bin/env bash
# Allow HTTP and HTTPS only from Cloudflare, so the origin cannot be reached around it. Safe to run repeatedly.
set -euo pipefail
for family in ips-v4 ips-v6; do
  curl -fsSL "https://www.cloudflare.com/$family" | while read -r range; do
    [ -n "$range" ] || continue
    ufw allow proto tcp from "$range" to any port 80,443 comment cloudflare >/dev/null
  done
done
echo "Cloudflare ranges allowed"
