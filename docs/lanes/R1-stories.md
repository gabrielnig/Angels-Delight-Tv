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

## Gaps
- No lint rule for hardcoded strings (M34-S04 AC2). Components with inline copy move to the catalog as they are touched.
- Only `en-NG` exists. Another locale is a new catalog object passed to `createMessages`.
- The 2 second 3G figure of M03-S13 is not measured in a real browser.
