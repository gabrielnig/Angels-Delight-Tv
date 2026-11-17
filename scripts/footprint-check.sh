#!/usr/bin/env bash
# Footprint guard from docs/TDD-PROTOCOL.md section 7.1.
# Usage: scripts/footprint-check.sh              check the staged diff
#        scripts/footprint-check.sh --range A..B check a commit range (diff, messages, authors)
# Banned characters are written as escapes so this file contains none of them.
set -u

AUTHOR="${FOOTPRINT_AUTHOR:-ARKDEV}"
BANNED_CHARS='[\x{2013}\x{2014}\x{2018}\x{2019}\x{201C}\x{201D}\x{2600}-\x{27BF}\x{2B50}-\x{2B55}\x{FE0F}\x{1F000}-\x{1F2FF}\x{1F300}-\x{1FAFF}]'
ATTRIBUTION='co-authored-by|generated with|claude\.ai/code|claude-session|noreply@anthropic'
EXCLUDES=(':(exclude)docs/TDD-PROTOCOL.md' ':(exclude)scripts/footprint-check.sh' ':(exclude)scripts/footprint-check.test.ts')

status=0

report() {
  echo "footprint: $1" >&2
  echo "$2" | sed 's/^/  /' >&2
  status=1
}

# Prints "path:text" for each added line of the given diff.
added_lines() {
  awk '
    /^\+\+\+ b\// { file = substr($0, 7); next }
    /^\+\+\+ /    { next }
    /^\+/         { print file ":" substr($0, 2) }
  '
}

check_diff() {
  local lines hits
  lines="$(git diff "$@" -U0 --no-color --diff-filter=ACMR -- . "${EXCLUDES[@]}" | added_lines)"
  hits="$(printf '%s\n' "$lines" | LC_ALL=C.UTF-8 grep -nP "$BANNED_CHARS")"
  [ -n "$hits" ] && report 'dash, smart quote or emoji in added lines' "$hits"
  hits="$(printf '%s\n' "$lines" | grep -niE "$ATTRIBUTION")"
  [ -n "$hits" ] && report 'AI attribution pattern in added lines' "$hits"
}

if [ "${1:-}" = "--range" ]; then
  range="${2:?usage: footprint-check.sh --range A..B}"
  check_diff "${range%%..*}" "${range##*..}"

  messages="$(git log "$range" --format='%B')"
  hits="$(printf '%s\n' "$messages" | LC_ALL=C.UTF-8 grep -nP "$BANNED_CHARS")"
  [ -n "$hits" ] && report 'dash, smart quote or emoji in a commit message' "$hits"
  hits="$(printf '%s\n' "$messages" | grep -niE "$ATTRIBUTION")"
  [ -n "$hits" ] && report 'AI attribution in a commit message' "$hits"

  others="$(git log "$range" --format='%an%n%cn' | grep -vx "$AUTHOR" | sort -u)"
  [ -n "$others" ] && report "commit author or committer is not $AUTHOR" "$others"
else
  check_diff --cached
fi

[ "$status" -eq 0 ] && echo 'footprint: clean'
exit "$status"
