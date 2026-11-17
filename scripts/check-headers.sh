#!/usr/bin/env bash
# Production header check (SECURITY.md sections 4 and 14, review item L-11).
# Usage: scripts/check-headers.sh <url> [--allow-http]
# Asserts CSP, HSTS, X-Content-Type-Options, Referrer-Policy and Permissions-Policy on the response for <url>.
# Exit 0 when all pass, 1 when any fails, 2 for bad usage or an unreachable url.
set -u

url="${1:-}"
allow_http=0
[ "${2:-}" = "--allow-http" ] && allow_http=1

if [ -z "$url" ]; then
  echo "usage: scripts/check-headers.sh <url> [--allow-http]" >&2
  exit 2
fi
case "$url" in
  https://*) ;;
  http://*) [ "$allow_http" -eq 1 ] || { echo "check-headers: refusing plain http (use --allow-http for local runs)" >&2; exit 2; } ;;
  *) echo "check-headers: url must start with https://" >&2; exit 2 ;;
esac

headers=$(curl -sS --max-time 20 -D - -o /dev/null -A "ad-check-headers/1" "$url" 2>&1) || {
  echo "check-headers: could not fetch $url" >&2
  exit 2
}
headers=$(printf '%s' "$headers" | tr -d '\r')

status=0
fail() { echo "FAIL $1: $2" >&2; status=1; }
pass() { echo "ok   $1"; }

# Value of a header, case insensitive, first occurrence.
value() { printf '%s\n' "$headers" | awk -v h="$(printf '%s' "$1" | tr 'A-Z' 'a-z')" '
  { i = index($0, ":"); if (i > 0 && tolower(substr($0, 1, i - 1)) == h) { v = substr($0, i + 1); sub(/^[ \t]+/, "", v); print v; exit } }'; }

csp=$(value content-security-policy)
if [ -z "$csp" ]; then fail content-security-policy "missing"
else
  ok=1
  case "$csp" in *"default-src"*) ;; *) fail content-security-policy "no default-src"; ok=0 ;; esac
  script_src=$(printf '%s' "$csp" | tr ';' '\n' | grep -E '^[[:space:]]*script-src[[:space:]]' || true)
  [ -n "$script_src" ] || { fail content-security-policy "no script-src"; ok=0; }
  case "$script_src" in *"'unsafe-inline'"*) case "$script_src" in *"'nonce-"*|*"'strict-dynamic'"*) ;; *) fail content-security-policy "script-src allows unsafe-inline"; ok=0 ;; esac ;; esac
  case "$script_src" in *"'unsafe-eval'"*) fail content-security-policy "script-src allows unsafe-eval"; ok=0 ;; esac
  case "$csp" in *"frame-ancestors"*) ;; *) fail content-security-policy "no frame-ancestors"; ok=0 ;; esac
  [ "$ok" -eq 1 ] && pass content-security-policy
fi

hsts=$(value strict-transport-security)
if [ -z "$hsts" ]; then fail strict-transport-security "missing"
else
  age=$(printf '%s' "$hsts" | sed -n 's/.*max-age=\([0-9]\{1,\}\).*/\1/p')
  if [ -z "$age" ] || [ "$age" -lt 15552000 ]; then fail strict-transport-security "max-age must be at least 15552000 (180 days)"
  else pass strict-transport-security; fi
fi

nosniff=$(value x-content-type-options | tr 'A-Z' 'a-z')
if [ -z "$nosniff" ]; then fail x-content-type-options "missing"
elif [ "$nosniff" != "nosniff" ]; then fail x-content-type-options "must be nosniff"
else pass x-content-type-options; fi

ref=$(value referrer-policy)
if [ -z "$ref" ]; then fail referrer-policy "missing"
else
  case "$ref" in
    no-referrer|same-origin|strict-origin|strict-origin-when-cross-origin|no-referrer-when-downgrade|origin|origin-when-cross-origin) pass referrer-policy ;;
    *) fail referrer-policy "weak or unknown value: $ref" ;;
  esac
fi

perm=$(value permissions-policy)
if [ -z "$perm" ]; then fail permissions-policy "missing"
else
  miss=""
  for feature in camera microphone geolocation; do
    printf '%s' "$perm" | grep -q -E "(^|[ ,])$feature=\(\)" || miss="$miss $feature"
  done
  if [ -n "$miss" ]; then fail permissions-policy "does not disable:$miss"; else pass permissions-policy; fi
fi

exit "$status"
