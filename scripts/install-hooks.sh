#!/usr/bin/env bash
# Installs a plain git pre-commit hook. Re-run any time, it overwrites only its own hook.
set -eu
root="$(git rev-parse --show-toplevel)"
hook="$(git rev-parse --git-path hooks/pre-commit)"
mkdir -p "$(dirname "$hook")"
cat > "$hook" <<'HOOK'
#!/usr/bin/env bash
set -eu
root="$(git rev-parse --show-toplevel)"
"$root/scripts/footprint-check.sh"

if command -v gitleaks >/dev/null 2>&1; then
  gitleaks protect --staged --redact
fi

# Config files are left out on purpose: vitest treats a changed config as a reason to rerun every test.
staged="$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(ts|tsx)$' | grep -vE '(^|/)[a-z.]*config\.ts$' || true)"
if [ -n "$staged" ]; then
  # shellcheck disable=SC2086
  cd "$root" && pnpm exec vitest related --run --passWithNoTests $staged
fi
HOOK
chmod +x "$hook"
echo "installed $hook (footprint check, then vitest related on staged ts files)"
