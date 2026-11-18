# Lane R3: Space Grotesk headings and account states

## What changed
- `space-grotesk` is a curated `FontKey` (display only, body stays Inter) and the default theme font (D-162). `@ad/ui` theme.ts, `@ad/theme` model.ts and css.ts, `apps/web/src/lib/fonts.ts`, `tokens.css` (and the skill copy) updated. Presets inherit the default and a test keeps the contrast gate font independent.
- Auth screens now read `--font-display` (`auth-ui.css`); `lib/auth-font.ts` removed.
- Fonts are the existing self hosted WOFF2 files in `apps/web/src/fonts` (`space-grotesk-latin` and `-latin-ext`, variable weight 300 to 700) with `OFL-space-grotesk.txt` beside them. next/font serves them from `/_next/static/media`, no external request, CSP unchanged.
- Fixes found by rendering states: the Kids adults only card (S27 state 4) was outside the `acct` scope, so its heading was 16px instead of 22px; the pending deletion screen (S30 state 6) had an unstyled footer (underlined links, squashed support line).

## Verification
Mockup left, built right, 1360 and 390: `/home/claude/compare/after2-s18-*.png`, `after2-s27..s31-*.png` (default states) and `after2-states-*.png` (stacked states: S27 loading, error, kids; S28 errors, toast, dialog; S29 toast, kids, loading, error; S30 delete dialog and pending). Computed headings match the mockups in family, size, weight and line height (Space Grotesk, same px, 700; the mockups use `normal`, which is 1.276 for this face, equal to the built value).
Known, accepted differences: S28 password errors show the empty submit errors rather than typed values; the password card stays after success (D-148); fixture data differs; the pending screen header has the logo only.

## Tests (scoped)
- `pnpm vitest run packages/ui/src/theme.test.ts packages/theme/src/css.test.ts packages/theme/src/model.test.ts packages/theme/src/inject.test.ts packages/theme/src/presets.test.ts apps/web/src/lib/fonts.test.ts apps/web/src/components/admin/theme/ThemeEditor.test.tsx apps/web/src/components/account/AdultsOnly.test.tsx apps/web/src/components/account/closing-footer-css.test.ts`
- E2E (fixture server): `E2E_BASE_URL=... pnpm exec playwright test e2e/account-states.e2e.ts --workers=1`. It cancels its own pending deletion; run it alone because it briefly changes the shared in memory fixture account.
