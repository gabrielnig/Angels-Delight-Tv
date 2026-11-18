# Lane F3: viewer mockup parity

Scope after the owner change: S18 title page (desktop and mobile, every state in the two mockups). S01 sign in shipped before the change (PR 138). S02 and S27 were dropped from this lane and are owned by other agents.

## What exists
- `apps/web/src/components/title/TitleView.tsx`: breadcrumb (Browse, subject, title), poster with centred play button and progress strip (`TitlePoster.tsx`), series line (long on desktop, "S1 E3" form on phones), 44px title, plain meta with a CC badge, two action rows, short progress bar with "2:14 of 5:52 watched", one description with Show more, credits line, related row, sticky Play bar.
- `RelatedRow.tsx`: five up grid on desktop, 150px scroller on phones. Title shown once, duration badge on the picture, subject below, screen reader name includes the length.
- `TitleStates.tsx`: Kids blocked, not found, error with reference, skeleton. Wired by `app/(viewer)/title/[slug]/{layout,loading,not-found,error}.tsx`.
- `TitleActions` has a `layout="title"` mode. Series page still uses the default row.
- `lib/title-format.ts`: exact length, time left, watched label, series line, main button text.
- `TopNav` gets `onBack`. `ViewerChrome` passes it and hides the tab bar on `/title/*` (D-126).
- Styles: `components/title/title.css`. New token `--shadow-up`.
- S01 (PR 138): forgot password link end aligned, alt line centred, headline balanced in two lines.

## Tests
- `pnpm vitest run apps/web/src/components/title apps/web/src/components/ViewerChrome.test.tsx apps/web/src/lib/title-format.test.ts packages/ui/src/components/TopNav.test.tsx apps/web/src/app/auth-parity-css.test.ts`
- E2E (dev server with `VIEWER_FIXTURES=on AUTH_FIXTURES=on ADMIN_DATA=fixture`): `E2E_BASE_URL=http://localhost:3100 pnpm exec playwright test e2e/title-parity.e2e.ts` covers axe, 320px overflow, touch targets, sticky bar, Back button, five card row and the not found card on desktop and mobile.

## Verification against the mockups
Measured with Playwright at 1360 and 390 (fixture `how-rain-is-made`). Poster 640 by 360 at x 48, title 44px bold at x 728, actions 52px and 44px high, related cards 237 wide, headings 24px and 20px, sticky button 48px: all equal to the mockup. Remaining differences are data or assets: the mockup illustrations (fixtures have no poster art, a tinted placeholder is drawn), fixture text, fixture progress, and the global header (pill search, name beside the avatar), which belongs to the nav owners. Images: `/home/claude/compare/after-s18-desktop.png` and `after-s18-mobile.png` (mockup left, built right, main state then the four states).

## Decisions
D-125 (face, colour and size mapping), D-126 (tab bar and Back), D-127 (route layout for states).

## Gaps
- Fixture related lists hold only standalone titles, so an episode shows up to eight standard cards, five on desktop.
- Show more uses a 140 character threshold, not a measured overflow.
- The Kids blocked state was checked by component test and a throwaway preview page, not by a Kids session in e2e.
