#!/usr/bin/env bash
# Plain grep secret scan for CI and pre-push (SECURITY.md section 17, review item L-11). Used because gitleaks is not
# installed here. Scans tracked files only. Prints file and line and the rule name, never the matched value.
# Usage: scripts/secret-scan.sh
# Silence a reviewed line with the marker  secret-scan:allow  on the same line.
set -u

status=0
SKIP=(':(exclude)pnpm-lock.yaml' ':(exclude)scripts/secret-scan.sh' ':(exclude)scripts/secret-scan.test.ts')
# Generic assignments are skipped in tests and docs, where fake values are normal. Real key formats are checked everywhere.
GENERIC_SKIP=("${SKIP[@]}" ':(exclude)*.test.ts' ':(exclude)*.test.tsx' ':(exclude)*.md' ':(exclude)*.example' ':(exclude)apps/web/e2e/*' ':(exclude)*/testing.ts' ':(exclude)*/fixtures/*')

# rule name | extended regex
FORMAT_RULES=(
  'private key block|-----BEGIN ([A-Z]+ )?PRIVATE KEY-----'
  'AWS access key id|(AKIA|ASIA)[0-9A-Z]{16}'
  'GitHub token|gh[pousr]_[A-Za-z0-9]{36,}'
  'Slack token|xox[abprs]-[A-Za-z0-9-]{10,}'
  'Google API key|AIza[0-9A-Za-z_-]{35}'
  'Stripe live key|sk_live_[0-9A-Za-z]{20,}'
  'JSON web token|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'
)
GENERIC_RULE='hard coded secret assignment'
GENERIC_RE='(secret|passw(or)?d|token|api[_-]?key|private[_-]?key|kek|pepper)[A-Za-z0-9_]*["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"'][A-Za-z0-9+/_=-]{20,}["'"'"']'
URL_RULE='credentials in a connection url'
URL_RE='[a-z][a-z0-9+.-]*://[^:/@[:space:]"'"'"']+:[^@[:space:]"'"'"']{6,}@[A-Za-z0-9.-]+'
URL_OK='://postgres:postgres@|@(localhost|127\.0\.0\.1|postgres|db|minio|redis)([:/]|$)|\$\{|<[a-z_-]+>|%s|\{\{'

report() { # rule, grep output lines "file:line:text"
  while IFS= read -r hit; do
    [ -z "$hit" ] && continue
    case "$hit" in *secret-scan:allow*) continue ;; esac
    file=${hit%%:*}; rest=${hit#*:}; line=${rest%%:*}
    echo "secret-scan: $1 at $file:$line" >&2
    status=1
  done
}

for rule in "${FORMAT_RULES[@]}"; do
  name=${rule%%|*}; re=${rule#*|}
  report "$name" < <(git grep -I -n -E -e "$re" -- . "${SKIP[@]}" 2>/dev/null)
done

report "$GENERIC_RULE" < <(git grep -I -n -E -i -e "$GENERIC_RE" -- . "${GENERIC_SKIP[@]}" 2>/dev/null \
  | grep -v -E 'process\.env|env\.[A-Z_]+|requireEnv|getenv' )

report "$URL_RULE" < <(git grep -I -n -E -e "$URL_RE" -- . "${GENERIC_SKIP[@]}" 2>/dev/null | grep -v -E "$URL_OK")

# Real environment files must never be tracked. Templates are fine.
while IFS= read -r f; do
  case "$f" in *.example|*.sample|*.template) continue ;; esac
  echo "secret-scan: tracked environment file $f:1" >&2
  status=1
done < <(git ls-files | grep -E '(^|/)\.env(\.[A-Za-z0-9_-]+)?$')

[ "$status" -eq 0 ] && echo "secret-scan: clean"
exit "$status"
