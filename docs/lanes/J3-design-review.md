# Lane J3: design system and accessibility review

Findings and status: `docs/DESIGN-REVIEW.md`.

## What exists

- `apps/web/e2e/a11y.e2e.ts`: axe-core and 320px overflow on viewer, auth and admin pages.
- `apps/web/e2e/touch-targets.e2e.ts`: 44px checks for footer, auth inline and legal contents links.
- `packages/theme/src/token-pairs.test.ts`: contrast for 31 token pairs in three themes.

## Scoped commands

See the top of `docs/DESIGN-REVIEW.md`. Fixture flags: `VIEWER_FIXTURES=on AUTH_FIXTURES=on ADMIN_FIXTURES=on`.

## Gaps

Open findings 1 to 11 in `docs/DESIGN-REVIEW.md`.
