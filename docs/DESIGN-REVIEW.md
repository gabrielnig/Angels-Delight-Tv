# Design system and accessibility review (lane J3)

Scope: every viewer, auth and admin page on main, reviewed against `docs/DESIGN-SYSTEM.md` with the angels-delight-design-system checklist. Pages were rendered with Playwright at 1360, 390 and 320 wide and compared with the mockups `S*.dc.html`. Automated checks: axe-core (WCAG 2.0, 2.1, 2.2 AA and best practice) on 52 pages, a 320px overflow check on the same pages, and a computed contrast test of 31 token pairs in three themes.

Run them (fixture build, one server):

```
VIEWER_FIXTURES=on AUTH_FIXTURES=on ADMIN_FIXTURES=on pnpm --filter @ad/web exec next dev -p 3500
E2E_CHROMIUM_PATH=/opt/google/chrome/chrome E2E_BASE_URL=http://localhost:3500 pnpm --filter @ad/web exec playwright test e2e/a11y.e2e.ts
E2E_CHROMIUM_PATH=/opt/google/chrome/chrome E2E_BASE_URL=http://localhost:3500 pnpm --filter @ad/web exec playwright test e2e/touch-targets.e2e.ts
pnpm vitest run packages/theme/src/token-pairs.test.ts
```

## Verdict

Changes required before the findings below are cleared; after the fixes merged in this lane, the automated gates are green and the remaining items are Major and Minor layout gaps against mockups, not accessibility blockers.

## Fixed in this lane

| Severity | Finding | Fix |
|---|---|---|
| Blocker | Admin link buttons (primary, danger, ghost) took ink text from `.adm-root a`: ink on blue measured 3.24:1 (needs 4.5). Dashboard, captions, theme history, invite. | Variant colours restored with higher specificity in `admin.css`. |
| Blocker | Label in name (WCAG 2.5.3, level A) failed on every video, series and continue card, profile tile, admin account menu, Delete forever, Merge cue and Send a new invite buttons. The accessible name did not contain the visible text. | Cards and tiles are named from their content with a hidden length suffix; admin labels now start with the visible words. Test in `Cards.test.tsx`. |
| Major | Horizontal scroll at 320px (and 390px on account and analytics): account page grid, analytics tiles and badges, OTP slots on verify email. | `minmax(0, 1fr)` columns, wrapping badges and stats, shrinking OTP slots. Gated by `a11y.e2e.ts`. |
| Major | Footer, sign in and sign up inline links and legal contents links were 20 to 37px tall (doc section 6: 44). | `min-height` and `min-width` of `--touch-target`. Gated by `touch-targets.e2e.ts`. |
| Major | Home had no h1. | Visually hidden h1 "Home". |
| Minor | Admin theme history: heading order jumped from h1 to h3 (preview samples and empty state titles). | Preview samples are paragraphs, admin empty state title is an h2. |
| Minor | Admin Home curation preview rows were scrollable regions with no focusable content. | Static preview, no sideways scroll. |

## Passed

- Tokens: no hardcoded colours or fonts in components or CSS (only `manifest.ts` PWA defaults, which are admin settings with fallbacks). No `outline: none` without a replacement ring. No raw pixel font sizes. No em dashes, en dashes or emojis in tracked files.
- Contrast: all 31 pairs pass in the default theme, a dark ink on lemon theme at size factor 1.15, and a green primary theme. All three pass the theme editor gate. Fixed tokens (status, sidebar, player) pass.
- Reduced motion: shimmer, modal, toast, card transforms and smooth scroll are off under `prefers-reduced-motion` (`components.css`, `globals.css`, `admin.css`, `watch.css`, `pwa.css`).
- Forms: `aria-invalid` and `aria-describedby` are wired in Field, PasswordField and OtpInput. Toasts use `role="status"` and `role="alert"`.
- Low data: saveData is read in `lib/lowdata`, playback settings and the responsive poster. No autoplay.
- Keyboard: focus ring is 3px `:focus-visible` globally, with box-shadow or outline replacements on tiles and cards.
- axe: zero violations on all 52 pages in desktop and mobile projects.

## Open findings

### Major

1. Account overview (`/account`, mockup S27) is a bare definition list. The mockup has a profile card, stats, a profiles card, link rows with icons and a Sign out card, and a side nav with icons and an active state. Fix: build the cards from `@ad/ui` surfaces. Doc 12.
2. Title page (`/title/[slug]`, S18) is a single column with a small poster. The mockup is two columns from 960px (poster left, title, meta, actions and progress right), has a breadcrumb, a Show more description and a More like this row. Fix: two column layout, breadcrumb.
3. Fixed: viewer and account routes now have a `loading.tsx` (`PageLoading`, skeleton after 300ms). Page specific skeleton geometry (browse grid, title two column) should follow the layout work in items 1 and 2.
4. Sign in and sign up (S01, S02) render the form with no card surface. The mockup puts the form in a white card with border and shadow, and a states strip. Fix: wrap in the auth card surface.

### Minor

5. Admin text links (list titles, crumbs, table links) are 16 to 17px tall. They sit in rows with spacing, so WCAG 2.5.8 passes, but doc section 6 asks for 44. Fix: padding on `.adm-list__title`, `.adm-vtitle`, `.adm-crumbs a`.
6. Spinner and shimmer durations are literals (`700ms`, `1.4s`, `0.8s`, `1.4s`) instead of motion tokens. Add `--motion-spin` and `--motion-shimmer` to tokens.css and doc section 3.
7. Continue card name reads the progress bar before the title ("20 percent 20 percent watched How to ..."). Move the progress below the title in DOM order, or hide the duplicate hidden text.
8. Profile picker shows letter avatars, mockup S09 shows illustrated avatars. Needs the avatar art set from the client.
9. Footer: the mockup S16 puts the footer links on one row with the note; ours stack and are underlined. Cosmetic.
10. Display font: mockups use Space Grotesk for headings, the doc default is Inter. The doc wins; no change.
11. `manifest.ts` default theme and background colours are literals. They are fallbacks for admin settings, so allowed, but keep them in step with `tokens.css`.

### Not covered

- Player (`/watch/[id]`) states S22 to S26 were only axe checked, not compared visually, because fixtures serve one sample stream.
- Real data states (lane K): re-run `a11y.e2e.ts` after admin wiring lands. The spec uses fixture ids (`vid_rivers`, `ser_maths`, `usr_1`, `vid_money_data`).
- Screen reader passes with real devices (TalkBack, VoiceOver) are still needed.
