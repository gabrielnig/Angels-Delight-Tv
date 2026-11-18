# Lane P3: account and site screens (S27 to S31)

Scope: rebuild S27 account overview, S28 security, S29 playback settings, S30 data and privacy (with the pending deletion screen) and S31 legal, About and Help to the mockups in desktop and mobile, with every stacked state. Real behaviour is kept: the deletion grace period, export with a password, preferences, PIN and session list. S01, S02 (p1) and S18 (f3) were not touched.

## What changed
- Shared: `TopNav` and `ViewerChrome` take `skin="soft"` (page colour header, search circle, profile pill with the name); `SiteFooter` takes `supportEmail`; `Modal` has `hideClose`; `Button` has `danger-outline` and passes `aria-disabled` through; new account colour tokens.
- Account frame in `components/account`: `AccountFrame`, `AccountNav` (side nav on desktop, one scrolling pill row on phones, Sign out under a rule), `AcctIcon`, `AcctField`, `InlineToast`, skeleton, load error and adults only states, all in `account.css` under the `acct-` namespace.
- S27: profiles card, Edit name (new `setDisplayName` in `@ad/auth`, audited), Email verified badge, masked email, devices card.
- S28: password strength meter and rule list, all field errors at once, devices with "Sign out all other devices?" dialog, email change in two steps (address and password, then the code).
- S29: switches, selects, saved toast, revert with Retry, Kids lock notice (`lib/playback-lock.ts`), caption preview.
- S30: export card in four states, delete dialog needing the password and typed DELETE, closing message, pending deletion screen in the `(closing)` group.
- S31: `SiteTabs`, `LegalToc` (follows the scroll), `LegalView` (legal and About variants), `HelpFaq` (search, card, Still stuck, no results card).
- Fix found on the way: the caption preview variables were blocked by the CSP as an inline style, so the preview text was dark on dark. They are now also set through the CSSOM.

## Routes and exports
Routes: `/account`, `/account/security`, `/account/data`, `/settings/playback`, `/account/deletion` (moved to `(closing)`), `/terms`, `/privacy`, `/about`, `/help`. New API: `setDisplayName(actor, { name }, meta)` and `displayName`, `passwordChangedAt` on `getOverview` in `@ad/auth`.

## Tests
Scoped, never the full suite:
- `pnpm vitest run apps/web/src/components/account apps/web/src/components/site apps/web/src/lib/playback-lock.test.ts packages/ui/src/components/TopNav.test.tsx`
- `TEST_DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres pnpm vitest run packages/auth/src/account.int.test.ts` (needs `pg_ctlcluster 16 main start`)
- `E2E_BASE_URL=http://localhost:3103 E2E_CHROMIUM_PATH=/opt/google/chrome/chrome pnpm exec playwright test e2e/account-pages.e2e.ts` with the dev server started using `VIEWER_FIXTURES=on AUTH_FIXTURES=on`. It checks tap targets and overflow on all four account pages, axe on both S30 dialogs, the password rules, the four site tabs and the Help empty state, on mobile and desktop.

## Verification
Mockup and built page rendered at 1360 and 390 and compared by element rectangles. Side by side images (mockup left, built right): `/home/claude/compare/after-s27-*.png` to `after-s31-*.png`.

## Gaps
- Space Grotesk is not used (D-147), so heading glyphs differ.
- The built pages were compared pixel by pixel in their default state only. The other stacked states (toast, errors, kids, loading, dialogs, pending deletion, export states) are covered by component tests and e2e checks, but were not rendered and diffed against the mockup, apart from the S30 default and S31 states.
- The Help empty state uses straight quotes around the search word.
- The fixture Privacy page is flagged as a draft, so it shows the Draft banner that the mockup omits. That is data.
- `ai-context.md` still says the deletion grace period is missing. It exists in the real repository. The file was not edited, as the brief says.
