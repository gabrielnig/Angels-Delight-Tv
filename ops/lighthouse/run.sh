#!/usr/bin/env bash
# Lighthouse for Home on the default mobile profile (Moto G Power, simulated slow 4G) against budget.json.
#   ops/lighthouse/run.sh https://tv.example.org/
# Needs Chrome or Chromium (CHROME_PATH) and Node. Exits non zero when a budget is missed.
# Lighthouse 13 removed built in budgets, so the check reads the report and compares with budget.json.
set -euo pipefail
URL="${1:?Usage: ops/lighthouse/run.sh <url>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${OUT:-/tmp/ad-lighthouse.json}"
npx --yes lighthouse@13 "$URL" \
  --only-categories=performance,accessibility,best-practices \
  --chrome-flags="--headless=new --no-sandbox" \
  --output=json --output-path="$OUT" --quiet
node "$HERE/check.mjs" "$OUT" "$HERE/budget.json" "$URL"
