# Lane a1: viewer stories audit and fixes

Audit table: `docs/audits/stories-viewer.md` (every Must and Should story for M01 to M11, M25, M34, M35, with status, evidence and gap). Rerun by editing the table; statuses were checked in code, not copied from lane notes.

## What was fixed (PRs)
- Title, series and public preview pages: Resume from m:ss, Watch again, progress and time left, collapsible description, Share with copy fallback, season in the URL, current episode marked, My List on series, sign in link that returns to the title, verified accounts leave /verify-email.
- Home: hero rotation (not under Data saver), card hover overlay, empty Home copy, My List row of 20, lazy rows by cursor (`catalog.homeRows`, `loadMoreHomeRowsAction`).
- Profiles and kids: suggested first name, discard prompt, Escape leaves manage mode, Kids header menu, service worker cache purge on switch and sign out.
- Search: `/` shortcut, no results tips with popular titles, Video and Series labels.
- Offline My List queue (`useListToggle`, `QueueSync`), and queued removals now carry a body.
- Admin bulk suitability, all or nothing.
- Player tests for auto hide, full screen, PiP, Media Session, caption CSS.

## Owned by m2, not touched
Deletion grace period (M02-S06, M02-S08 AC2), export job (M02-S05), PIN UI, server side player preferences (M02-S04, M03-S09), legal pages, mockup parity, slug redirects (M04-S02), ETag and catalog cache (M04-S05).

## Gaps left
M01-S10 AC3 offline sign out (the session cookie is HttpOnly so it cannot be cleared on the device), M01-S12 AC3 explanation, M01-S11 sign out everywhere with password, M02-S02 change email screen, M03-S11 Always ask setting, M03-S13 cached picker, M05-S02 per row retry for curated rows, M05-S08 offline banner and backoff, M06-S02 filter and sort options from the story, M06-S03 results while typing, M06-S09 progress line, M06-S10 429 countdown, M08-S27 poster fade, M11-S05 CC badge on cards, M25-S02 AC3 Lighthouse in CI, M25-S04 link to cached pages, M34-S01 axe in CI, M34-S04 message catalogs.

## Known failing test not from this lane
`apps/web/src/server/data/mappers.test.ts` "maps a profile with a tone derived from the avatar" fails on main since the player preferences change (m2): the mapper now returns extra fields.

## Running
`pnpm vitest run <file>`. Integration files need `TEST_DATABASE_ADMIN_URL` and, on a busy machine, `--testTimeout=60000`.
