# Lane R1: three unbuilt viewer stories

## What exists
- M34-S04 message catalog: `packages/shared/src/messages` (`EN_NG`, `msg`, `createMessages`, `formatDuration`, `formatNumber`). Import from `@ad/shared/messages`, never the root (node crypto). Wired: auth form errors and notices, account page copy, player overlays and toasts, the picker note. Test: `apps/web/src/lib/messages-coverage.test.ts` fails on a missing key or an unused key.
- M03-S11 Always ask who is watching: `lib/profiles/always-ask.ts`, `components/account/AlwaysAskSetting.tsx` on `/account`, `setAlwaysAskAction` and the sign in handling in `app/actions.ts`. Device cookie `ad_always_ask` (D-154).
- M03-S13 cached picker: `lib/profiles/picker-cache.ts`, `components/profiles/CachedPicker.tsx`, `app/(profiles)/profiles/loading.tsx`, account hint cookie `ad_acct` (D-155).

## Scoped tests
- `pnpm vitest run packages/shared/src/messages`
- `pnpm vitest run apps/web/src/lib/messages-coverage.test.ts apps/web/src/lib/profiles apps/web/src/components/profiles apps/web/src/components/account/AlwaysAskSetting.test.tsx apps/web/src/lib/pwa/sign-out.test.ts`

## Decisions
D-153, D-154, D-155.

## Hardcoded copy lint rule (M34-S04 AC2)
- Rule: `scripts/eslint-rules/no-hardcoded-copy.mjs`, registered as `ad/no-hardcoded-copy` in `eslint.config.js`. It is an error only in the files listed there (the wired files: account page copy, always ask switch, cached picker, auth notices and form errors, player controller, overlays and view). Test: `pnpm vitest run scripts/no-hardcoded-copy.test.ts`.
- It flags JSX text with letters, JSX `aria-label`, `title`, `placeholder`, `alt` and `aria-description` literals, and strings or templates that read like a sentence (capital first, two or more words), unless inside `msg(...)`.
- Allowlist: the `allow` array in the rule options in `eslint.config.js` holds exact strings that are not copy. It is empty. To move a file over, put its copy in `en-ng.ts`, read it with `msg('key')`, then add the file to the list in the same change.
- Whole repo `pnpm exec eslint .` is green. About 45 inline player strings moved to the catalog with text unchanged.

## 3G measurement (M03-S13 AC1)
- Spec: `apps/web/e2e/picker-cache-3g.e2e.ts` (mobile and desktop projects). It visits `/profiles` once on a good connection, then reloads under CDP network emulation (Chrome Fast 3G: 1.6 Mbit/s down, 750 kbit/s up, 562.5 ms round trip) and asserts the tiles are visible in under 2000 ms. A second test checks the cache holds only picker fields.
- Result on the production build with the fixture server: tiles painted at about 800 ms on the mobile project and about 250 ms on desktop, against the 2000 ms target. No fix was needed.
- Run: `pnpm --filter @ad/web build`, start the fixture server (`scripts/ci-fixture-env.sh 3113 > .env.ci-fixture; set -a; . ./.env.ci-fixture; set +a; cd apps/web && pnpm exec next start -p 3113`), then `E2E_BASE_URL=http://localhost:3113 E2E_CHROMIUM_PATH=/opt/google/chrome/chrome pnpm exec playwright test e2e/picker-cache-3g.e2e.ts` from apps/web.
- Limits: static files are warm (a repeat visit, as the story says), a first visit with a cold cache is not asserted. The fixture server answers the list in milliseconds, so on this run the tiles may come from the server render rather than the cache. The cache path itself (cached tiles while the server is still answering, and on a failed refresh) is covered by `CachedPicker.test.tsx`. Real-server timing needs the staging stack.

## Gaps
- Only `en-NG` exists. Another locale is a new catalog object passed to `createMessages`.
- Files outside the lint list still hold inline copy and move over as they are touched.
- The 3G spec is not in CI.
