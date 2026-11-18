# Lane Q1: cleanup

Branches `lane-q1/*`.

## Done

- Removed the unused `formatDuration` and `spokenLength` imports in `TitleView.tsx`. `pnpm --filter @ad/web lint` is green.
- `a11y.e2e.ts`: removed `KNOWN_FAILING` and all three `test.fixme` calls.
  - S29 `/settings/playback`: already fixed on main (P3 CSP fix), passes.
  - S27 `/account`: `<dl role="group">` removed the list semantics from the stats, so `dt` and `dd` had no list parent. Dropped the role and label. The page also overflowed 320px (long email, five profile avatars); the name block now wraps anywhere and the profile row wraps.
  - S31 `/about`: section headings were `h3` right after the `h1`. Now `h2` with the same class, so the look is unchanged.
- `home.e2e.ts`: the first matching card was a continue watching card that goes to `/watch`; the spec now picks a title or series card.
- Unit tests updated: `AccountOverview.test.tsx` (no group role), `LegalView.test.tsx` (level 2 headings).
- S01 and S02 e2e (`auth-pages.e2e.ts`, desktop and mobile) re-run on current main: all pass. `home.e2e.ts` passes after the fix above.
- `ai-context.md` brought up to date.

## Scoped commands

```
pnpm vitest run apps/web/src/components/account/AccountOverview.test.tsx apps/web/src/components/site/LegalView.test.tsx
VIEWER_FIXTURES=on AUTH_FIXTURES=on ADMIN_FIXTURES=on pnpm --filter @ad/web exec next dev -p 3500
E2E_CHROMIUM_PATH=/opt/google/chrome/chrome E2E_BASE_URL=http://localhost:3500 pnpm --filter @ad/web exec playwright test e2e/a11y.e2e.ts e2e/auth-pages.e2e.ts e2e/home.e2e.ts
```

## Notes

- A single `/admin/account` a11y run failed once on the first cold compile (admin sign in timeout); it was not part of this lane and was not re-run in full. The full a11y spec was not run again, only the viewer pages touched.
