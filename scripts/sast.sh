#!/usr/bin/env bash
# Static analysis with Semgrep (rule packs p/typescript and p/security-audit). Fails on any finding that is not
# annotated with `nosemgrep: <rule> (<reason>)`. Tests and fixtures are skipped. Needs: pip install semgrep.
# Usage: scripts/sast.sh [path...]   (default: apps packages)
set -euo pipefail
cd "$(dirname "$0")/.."
command -v semgrep >/dev/null || { echo 'sast: semgrep is not installed (pip install semgrep)' >&2; exit 2; }
if [ "$#" -eq 0 ]; then set -- apps packages; fi
exec semgrep scan --metrics=off --quiet --error \
  --config p/typescript --config p/security-audit \
  --exclude '*.test.ts' --exclude '*.test.tsx' --exclude 'test_*.py' --exclude 'e2e' --exclude 'testing' \
  "$@"
