# Lane L8 plan: design system tuning and doc reconciliation (module M47)

Status: planning pass, 2026-11-24. Owner: ARKDEV. Reviewer: the `angels-delight-design-system` skill.
Inputs read: `docs/audits/2026-11-24-netflix-rea-audit.md` (sections 2 to 4), `CLAUDE.md`, `docs/DESIGN-SYSTEM.md` (all), `docs/SCREEN-ARCHITECTURE.md`, the design skill, `packages/ui` (tokens.css, components.css, Cards, Row, Hero, TopNav, Skeleton), `apps/web/src/app/globals.css`, `apps/web/src/lib/fonts.ts`, `apps/web/src/fonts`, `packages/theme`, `packages/player` (controls timing).
Nothing in this pass changes code. Every claim below was checked against the files named. Where the audit text and the code disagree, the code was read and the finding says which one is right.

Note on paths: the brief names `apps/web components.css`. There is no such file. Component CSS is `packages/ui/src/components.css` (2153 lines, tokens only) and app CSS is `apps/web/src/app/globals.css` plus feature CSS (`apps/web/src/components/*/*.css`, `apps/web/src/features/player/watch.css`, `packages/player/src/player.css`).

## 1. Scope

In scope (M47, new module, "Design system tuning and guards"):
1. Apply the audit adopt and adapt list that is not already built, after verifying each item against code (section 3 has the verdict per item).
2. Fix the code defects found while verifying (section 6).
3. Reconcile every docs versus code mismatch (section 4), with no destructive renumbering (section 4.3).
4. Add automated guards so tokens, touch targets, contrast, hover rules and reduced motion cannot regress (section 5).
5. Stories M47-S01 and up, mockups S150 to S159, decisions, risks.

Out of scope: video preview on hover, autoplay billboard video, 2560 breakpoint, TV layout, personalisation rows, Netflix brand treatments (audit "Skip" list stands). Hero optional preview clips (owner punch list item 6) belong to the home lane, but L8 owns the constants and CSS they will use (rotation interval, crossfade, scrim). The guest access program (audit section 5) is not touched.

Files this lane owns: `packages/ui/src/tokens.css`, `packages/ui/src/components.css`, `packages/ui/src/components/{Row,Cards,Hero,TopNav,Skeleton,Button,States}.tsx`, `apps/web/src/app/globals.css` (shell rules only), `apps/web/src/lib/fonts.ts`, `apps/web/src/fonts/*`, `.claude/skills/angels-delight-design-system/reference/tokens.css`, `docs/DESIGN-SYSTEM.md`, `docs/SCREEN-ARCHITECTURE.md` (section 2 only), new tests listed below. Files other lanes own and L8 only touches by a one line constant or class hook, flagged for merge conflicts: `apps/web/src/components/home/HomeHero.tsx`, `packages/player/src/ui/PlayerView.tsx`, `packages/player/src/player.css`, `docs/USER-STORIES.md` (M05-S01 AC2 only), `docs/DECISIONS.md` (append only), `ai-context.md` (main session edits, L8 supplies the text).

## 2. Verified state of the code (evidence)

| Topic | Code today | Evidence |
|---|---|---|
| Colour default | Light off-white default, dark only in sidebar, player, scrims. No dark preset in `packages/theme/src/presets.ts` (default, sky-blue, turquoise, lemon-green, sunny-yellow). | tokens.css, presets.ts |
| Columns | `--cards-visible` 2.4 (base), 3.4 (600), 4.4 (960), 5 (1280). No 1920 rule. 5 at 1280 has no peek. Set on `:root` by viewport media queries. | tokens.css 189 to 198 |
| Row geometry | `.ad-row__item` flex basis uses `100%` of the list, `.ad-row` defines `--row-card-width` with `100%` of the section, and arrows sit at `top: 25%` of the viewport. Percent resolves against different boxes, so arrow height drifts with card width. | components.css 1488, 1546, 1561 |
| Gutter | Steps 16, 24, 40, 48 by breakpoint. | tokens.css |
| Scroll snap | `scroll-snap-type: x proximity`, `scroll-padding` gutter, hidden scrollbar, `overscroll-behavior-x: contain`. Arrows exist (`IconButton`, desktop `hover: hover and pointer: fine`, page by `clientWidth - card`, `behavior: 'smooth'` without a reduced motion check, though `html { scroll-behavior }` is reset under reduce). | Row.tsx 60 to 62, components.css 1537 |
| Hover card | `.ad-card__peek` overlay (description plus Play) and a 4 px lift after `--hover-intent-delay` (500 ms). The delay sits on the base `transition`, so it also delays the mouse-out (card sticks lifted for 500 ms after leaving). Peek has no title, length or subject, no scale, no origin rule. | components.css 1284 to 1294, 1444 to 1483 |
| Hover guard | All `.ad-*` hovers are inside `@media (hover: hover)`. Plain `:hover` outside the media query remain in: `packages/player/src/player.css` (`.adp-ctl:hover`, `.adp-btn--primary:hover`, `.adp-btn--ghost:hover`), `apps/web/src/app/globals.css` (`.web-chip:hover`), `apps/web/src/features/player/watch.css` (`.watch__back:hover`, `.watch__button:hover`, `.watch__tile:hover`), `apps/web/src/components/pwa/pwa.css` (`.pwa-btn--primary:hover`), and `.ad-card:hover .ad-card__thumb` inside the reduced motion block (harmless there). A scripted first pass found these; the gate test (S04 below) uses a real brace-depth parse and is the authority. | grep, 2026-11-24 |
| Nav | `position: sticky`, height `--nav-height` 3.5 rem, 4.25 rem from 960. Solid state flips on `window.scrollY > 48` from a passive scroll listener in `TopNav.tsx` (line 64). Transition is on `background-color` but the clear state is a gradient, which cannot be interpolated, so the flip is a hard cut. | TopNav.tsx 57 to 67, 113, components.css 1796 to 1812 |
| Bottom tab bar | Built: `BottomTabBar` (4 items, `aria-label="Primary"`, 3 rem plus safe area, 3 px top marker, hidden from 960). Rendered by `ViewerChrome` and omitted on `/title/*` (the title page has its own sticky Play bar). `/watch` lives outside the chrome. Content padding: footer reserves `calc(space-8 + 4rem)`. | ViewerChrome.tsx 68, 122, components.css 2000 to 2036 |
| Hero | Rotation 8000 ms in `HomeHero.tsx` unless Data saver; `Hero` also stops under reduced motion and on pause or hold. No crossfade exists (slide swaps). Dots and Pause control exist. Scrim reads `--color-scrim-top` (0.85) at the edge to `--color-scrim-bottom` (0): mobile gradient from bottom (65% stop) and top (25%), desktop from left (60%) and bottom (40%). Max items 5. | Hero.tsx 44 to 54, components.css 1618 to 1625, 1746 |
| Type | Tokens are single values: micro 11, caption 13, small 14, body 16, lead 18, h4 20, h3 24, h2 32, h1 40, hero 56. Nothing reassigns them at 960. The hero title uses h2 on mobile and `--text-hero` from 960 by component override. `--text-hero` is also used for 120 and 160 px avatar initials (components.css 933, 938). | tokens.css 94 to 103, components.css 1634, 1756 |
| Motion tokens | instant 100, fast 150, base 200, slow 350, spin 700, shimmer 1.4 s, ease standard, enter, exit, `--hover-intent-delay` 500 ms. Reduced motion block uses `prefers-reduced-motion: reduce` and zeroes instant, fast, base, slow and the hover delay. Spin and shimmer are not zeroed by the tokens (components handle them). | tokens.css 150 to 160, 200 to 204 |
| Buttons | `min-height` is `--touch-target` (44) for default and small, 3.25 rem for lg. No size tokens. Transitions use fast (hover) and instant (press). | components.css 36 to 62 |
| `.ad-tile` focus | `.ad-tile:focus-visible { outline: none }` then `.ad-tile:focus-visible .ad-tile__avatar { box-shadow: 0 0 0 3px var(--color-focus-ring) }`. It does draw its own ring, but: a box-shadow ring has no offset (touches the avatar fill), disappears in Windows forced colors mode, and sits against pastel avatar fills. Computed by hand: ring `#1F6FB5` (L 0.150) against the peach avatar `#F2B1AC` (L 0.533) is 2.91:1, below the 3:1 rule in DS 4.2. Against the page bg `#F5F5F2` it is 4.81:1. | components.css 997 to 1003, tokens.css 78 to 82 |
| Card ratios | Video and series cards both use `--ratio-video` 16:9. `--ratio-poster` exists in tokens and is used nowhere. | Cards.tsx, grep |
| Fonts | Six families, each in two subsets (latin, latin-ext) as WOFF2, `font-display: swap`, ext not preloaded, via `next/font/local`. Only selected families emit CSS. Total fonts folder is about 439 KB on disk. No `unicode-range`. | fonts.ts, `ls` |
| Diacritics | Coverage read from the shipped files with fontTools: precomposed `ọ ẹ Ọ Ẹ` (U+1ECD, U+1EB9, U+1ECC, U+1EB8) are missing in all six families. They live in Google's `vietnamese` subset, which is not bundled. `ṣ` (U+1E63) is missing in DM Sans, Lora and Poppins. Combining dot below (U+0323) is missing in DM Sans and Poppins. `ń` (U+0144) is present everywhere. Naira sign U+20A6 is missing in DM Sans, Lora and Poppins. DS 5.1 and tests claim Yoruba and Igbo marks are covered. They are not, for the characters that matter most. | fontTools run on `apps/web/src/fonts/*.woff2` |
| Skeleton | `SkeletonCard` is a 16:9 block plus two 0.875 rem bars. `.ad-skelcard` basis is `(100% - (n-1)*gap)/n`, but a real `.ad-row__item` basis also subtracts `2 * --page-gutter`. Skeleton rows have no gutter padding. Result: skeleton cards are wider than real cards and the row shifts when content arrives. Real card also has a meta line the skeleton lacks. Reduced motion hides the shimmer (`display: none`) and leaves the sunken fill. | components.css 566 to 583, 1546, Skeleton.tsx |
| Player timing | Controls hide after 3000 ms (`HIDE_AFTER_MS`). Seek hit area is 2 rem (32 px), DS 11.22 says 44 px. Up next countdown default 5 s (`countdownSeconds ?? 5`), DS says 8 s, audit says 5 to 10 s. | PlayerView.tsx 63, player.css 204 to 214, controller.ts 755 |
| Contrast defect | `.ad-card__cc` (captions badge) uses `color: var(--color-ink)` and `border: 1px solid var(--color-ink)` on `background: var(--color-scrim-top)`, which is a dark 0.85 scrim. Ink on that is under 2:1. Needs a browser check, but it is wrong by construction. | components.css 1356 to 1368 |

## 3. Audit adopt and adapt list: verdict and exact change

"Done" means verified in code and only guarded by a test. "Change" means code work. "Decide" means deviation from the audit with reasons, logged.

| # | Item | Verdict | Exact change |
|---|---|---|---|
| 1 | Dark first surface with configurable colours | Decide | Keep the light off-white default (owner brief, DS 3.1). Configurable tokens already exist. Add a `night` preset (dark ink surfaces) as a Could story, gated by the existing contrast gate. Logged as DEC-L8-01. |
| 2 | 4 px spacing scale | Done | Guard only (S15). |
| 3 | Button sizes 2, 2.5, 3 rem with 44 px targets | Change | Add `--button-height-sm: 2rem`, `-md: 2.5rem`, `-lg: 3rem`, `--button-pad-x: 1rem`, `--icon-gap: 0.5rem`. Under `pointer: coarse`, and for every button that is the only control in its row, `min-height: var(--touch-target)` still wins. For fine pointers the visual height is the token and a `::before { inset: calc((var(--touch-target) - 100%) / -2) 0 }` hit area pads to 44. Default viewer buttons stay 2.75 rem on touch. Radius stays `--radius-sm` (8, not Netflix 4: DS 7). DEC-L8-02. |
| 4 | 250 ms hover with strong ease-out, 0 ms pressed | Change | Add `--motion-hover: 250ms`, `--motion-press: 0ms`, `--ease-out-strong: cubic-bezier(0.22, 1, 0.36, 1)`. Hover transitions (button background, iconbtn, card, arrows) use `var(--motion-hover) var(--ease-out-strong)`. `:active` rules set `transition-duration: var(--motion-press)`. Press scale 0.98 stays (DS 11.1). |
| 5 | Reduced motion with `reduce` and visible focus ring | Done, extend | Block already uses `reduce`. Add the new tokens to it (`--motion-hover`, `--motion-press` stay 0.01 ms and 0, `--hover-card-delay: 0ms`). Row `scrollBy` gets `behavior: 'auto'` when reduce matches. Guard test (S05). |
| 6 | Hover only under `hover: hover and pointer: fine` | Change | Wrap the stray rules listed in section 2. Standard: any `:hover` that moves, reveals or scales needs `(hover: hover) and (pointer: fine)`. Colour only hovers may use `(hover: hover)`. Gate test (S04). |
| 7 | Breakpoints 600, 960, 1280, 1920 mobile first | Change | Add the 1920 block (columns 6.3, gutter cap, wider rail cap, browse grid 6). 2560 stays skipped. |
| 8 | Card ratios 16:9 and 2:3 with explicit dimensions | Decide | Video and series cards stay 16:9 (every source is 1280 by 720, hero art cuts its own poster focus per D-160). `--ratio-poster` stays reserved and unused. DS 10 text changes from "poster 2:3 optional later" to "not used in v1". Add explicit `width` and `height` attributes on card images (already `aspect-ratio`; attributes added so the box exists before CSS loads). DEC-L8-03. |
| 9 | Hero scrim 0.85 | Done, tokenise | `--color-scrim-top` is already 0.85. Add `--scrim-hero-start: 0.85`, `--scrim-hero-mid: 0.45`, `--scrim-hero-end: 0` as separate named stops (the two-stop gradient bands: darkest text area has 0.85, fades by 65% mobile and 60% desktop). Stops move from literals in gradients to tokens so a gate can assert text contrast against the lightest case. |
| 10 | Animate only transform and opacity | Change | Exceptions in code: `background-color` transitions on buttons and nav, progress bar width (allowed by DS). Gate test lists allowed properties: transform, opacity, background-color, border-color, color, box-shadow (colour class only), plus `width` only on `.ad-progress__fill`. New hover card uses transform and opacity only. |
| 11 | Container queries on rows | Change | `.ad-row { container-type: inline-size; container-name: row }`. Column count and gutter rules move to `@container row (min-width: ...)` and target `.ad-row__viewport` and `.ad-row__head` (a container cannot restyle itself). Root media rules stay as fallback for non row uses (browse grid, skeleton outside a row). |
| 12 | Open variable font stack, Latin subset | Change | Latin alone breaks Yoruba. Bundle latin + latin-ext + vietnamese (U+1EA0 to 1EF9, U+0300 to 0301, U+0303 to 0304, U+0308 to 0309, U+0323, U+0329). Section 7. |
| 13 | Type scale 0.8125 to 2.5 rem, hero `clamp(2rem, 5vw, 3.5rem)` | Change and decide | Section 6 decision (code is wrong, docs are right for H1 to lead, docs updated for hero). |
| 14 | Gutter `clamp(1rem, 4vw, 3.5rem)` | Change | `--page-gutter: clamp(1rem, 4vw, 3.5rem)` replaces the four step values (checked: 360 gives 16, 600 gives 24, 960 gives 38.4 (was 40), 1280 gives 51.2 (was 48), 1920 gives 56). Remove the per breakpoint gutter overrides. Doc 6 changes to the clamp. |
| 15 | Fractional columns 2.3, 3.3, 4.3, 5.3, 6.3 | Change | `--cards-visible` 2.3 base, 3.3 at 600, 4.3 at 960, 5.3 at 1280, 6.3 at 1920 (container widths inside rows). |
| 16 | Light hover card, 300 ms, 1.25 scale, origin rules | Change | Section 6, slice S07. |
| 17 | Nav 4 rem desktop, 3 rem mobile, solid after about 40 px by IntersectionObserver | Change and decide | Keep 3.5 rem and 4.25 rem (touch targets need the room, audit values are tune-later starting points). Threshold 48 px becomes 40 px, driven by a 40 px sentinel and IntersectionObserver instead of a scroll listener. DEC-L8-04. |
| 18 | Real detail pages, not modals | Done | `/title/[slug]` and `/series/[slug]` exist. DS 12 line "Can be a modal on desktop" is edited to "Detail is a page. A modal is not used." |
| 19 | Player controls fade after 3 s, scrubber 5 px to 8 px with 44 px hit | Change (player owned) | Fade 3 s is correct in code. Scrubber hit area 32 px to 44 px (`.adp-seek { height: var(--touch-target) }`). Rail 4 px grows to 8 px stays (DS), audit's 5 px not adopted. Countdown default 5 s stays, DS updated from 8 to 5 (cancellable, range 5 to 10 in site settings). |
| 20 | Bottom tab bar on phones with safe area inset | Done | Verified (section 2). Two gaps: footer padding uses a literal `4rem` and the bar height a literal `3.5rem`. Tokenise as `--tabbar-height: 3.5rem` and use it in both places. Add test that the tab bar hides from 960 and on `/title/*`. |
| 21 | Skeletons at card ratio | Change | Section 6 slice S12. |
| 22 | Empty and error states with one sentence and one action | Change | Copy rules and a test that every `EmptyState` and `ErrorState` usage has a heading, one sentence and at most one primary action (slice S13). |
| 23 | Controls fade timing | Done | 3000 ms is in range. Expose as `PLAYER_CONTROLS_HIDE_MS` export (one line) and assert 3000 to 5000 in a test so nobody drifts it. Fade uses `--motion-base`. |

## 4. Docs versus code mismatches and the reconciling edit

Ids are finding numbers used by the slices.

| # | Mismatch | Right side | Edit |
|---|---|---|---|
| X1 | Hero auto rotate. DS 8 says off by default, 7 s. USER-STORIES M05-S01 AC2 says 8 s. Code 8 s. Owner punch list item 6 says about 10 s with a pause control. | Owner list (10 s, on, pause control, off under reduced motion and Data saver, pauses on hover, focus and touch) | DS 8 line becomes: "Hero crossfade 350 ms. Auto rotate is on, 10 s per slide, paused by hover, focus, touch and the Pause control, off under reduced motion and Data saver." DS 11.7 "manual by default" becomes "rotates by default". USER-STORIES M05-S01 AC2: 8 seconds to 10 seconds. Code: `HomeHero.tsx` uses a shared `HERO_ROTATE_MS = 10000` exported from `@ad/ui`; `HomeHero.test.tsx` "rotates every 8 seconds" becomes 10. |
| X2 | 1920 breakpoint. DS 6 lists `xl` 1920 but tokens.css stops at 1280. | DS | Add the 1920 block (S01). |
| X3 | Decision ids D-108, D-109, D-123, D-124 appear twice in `docs/DECISIONS.md` (lines 549 and 575, 571 and 586, 654 and 667, 661 and 673) from parallel lanes M2, M3, a3. | Both entries are real | Section 4.3, no renumbering. |
| X4 | `ai-context.md` says decisions are logged up to D-162. Headings now run to D-168 (the audit's "stop at D-159" was also stale). | Code of record is the file | `ai-context.md` text (main session applies): "decisions logged up to D-168 (D-108, D-109, D-123, D-124 each have two entries, see the register at the top of DECISIONS.md)". Add a guard (S02) that fails when the highest heading differs from the number quoted in `ai-context.md` by more than 0 on main, so the claim cannot drift again. |
| X5 | BUILD-PLAN lane table lists lanes A to J only (no M, F1, K, P, R, W, a, v lanes, no v2 L lanes). | Lane notes in `docs/lanes/` | Append a "Lanes added after phase 4" table to `docs/BUILD-PLAN.md` that lists each file in `docs/lanes/` with its one line scope (take scope from each lane note's first line) and the v2 plan lanes L1 to L8 with module ids. Do not rewrite the original table. |
| X6 | Series card ratio. DS 10 "16:9 (poster 2:3 optional later)". Audit says docs say optional 2:3 and code is 16:9. | Code (16:9) | DS 10 row: "Series card | 16:9 | 1280 by 720 | 320, 480, 640" and note "2:3 poster is not used in v1 (DEC-L8-03)". |
| X7 | Type scale. DS 5.2 has Mobile and Desktop columns (hero 32 and 56, H1 28 and 40, H2 24 and 32, H3 20 and 24, H4 18 and 20, lead 17 and 18). Code has one value per token (the desktop value). | Docs for H1 to lead (mobile first), code for hero (clamp) | Section 6 slice S03. DS 5.2 hero row becomes `clamp(2rem, 5vw, 3.5rem)`. |
| X8 | `SCREEN-ARCHITECTURE.md` section 2 uses breakpoints 320, 480, 768, 1024, 1280 and "xs 2.3, sm 3.3, md 4.3, lg 4.5, xl 5". DS and code use 600, 960, 1280, 1920. | DS | Rewrite section 2 table to base, sm 600, md 960, lg 1280, xl 1920 and columns 2.3, 3.3, 4.3, 5.3, 6.3. |
| X9 | DS 11.7 and DS 2 say hero carousel max 6 items. DATA-MODEL, USER-STORIES (M19 AC) and code say 5. | Code | DS 2 and 11.7: "1 to 5 items". |
| X10 | DS 8 `--hover-intent-delay` 500 ms. Audit and plan: 300 ms. | New value | Rename to `--hover-card-delay: 300ms` in tokens.css, skill reference tokens.css and DS 8. Keep `--hover-intent-delay` as an alias (`var(--hover-card-delay)`) for one release so feature CSS keeps working, remove in S03's last commit after a grep proves no user remains. |
| X11 | DS 11.23 end card "8 second countdown". Code default 5 s. | Code | DS: "5 second countdown (site setting 5 to 10)". |
| X12 | DS 11.22 seek hit area 44 px. Player CSS 32 px (comment says "32px tall hit area"). | DS | Code change in slice S09. |
| X13 | DS 5.1 and `docs/lanes/R3-fonts-states.md` say Latin plus Latin Extended covers Yoruba marks. Shipped files do not contain `ọ ẹ`. | Test result | Section 7 and DS 5.1 text: "latin, latin-ext and vietnamese subsets". |
| X14 | DS 11.8 says nav solid after 48 px. | New value 40 px | DS 11.8 and 2 updated to 40 px. |
| X15 | DS 11.6 `--cards-visible` text says 2.4, 3.4, 4.4, 5. | New values | DS 6 and 11.6 updated to 2.3, 3.3, 4.3, 5.3, 6.3. |
| X16 | Audit section 4 claims "Unchecked" items. Now checked. | This plan section 2 | Append a "Checked" line to the audit file listing the results (hero crossfade: absent; tab bar: present; fonts: six families bundled, diacritics gap; tile ring: draws a ring, fails 3:1 on peach and forced colours). Append only. |

### 4.3 Non destructive plan for duplicate decision ids

1. Never renumber an existing heading. Other docs, lane notes, code comments (for example `preferences.ts` cites D-108) and PR history cite these numbers.
2. Add, at the top of `docs/DECISIONS.md` under the title, an append only "Duplicate id register" table: id, lane, heading text, anchor suffix. Example rows: `D-108 (M2) Player preferences...`, `D-108 (M3) Theme presets...`, same for D-109, D-123 (M2 and a3), D-124 (M2 and a3). Rule text: cite as `D-108 (M3)` when the id is ambiguous.
3. Fix the single ambiguous code citation: `apps/web/src/features/player/preferences.ts` comment `D-108` to `D-108 (M2)`. `docs/lanes/a3-platform.md` "D-120 to D-124" stays.
4. Next free number rule: always highest heading number plus one, taken at merge time on origin/main (highest today D-168).
5. Guard test `scripts/decisions-ids.test.ts` (S02): parses `docs/DECISIONS.md`, allows exactly the four known duplicates (allowlist in the test with the lane suffix), fails on any new duplicate, on a heading that skips backwards by more than the allowlist, and on a register row that has no matching heading.

## 5. Automated guard plan (gate tests)

All run scoped. They read CSS and TS as text (small brace-depth parser at `packages/ui/test/css-scan.ts`, about 60 lines, no new dependency; use postcss only if it is already in `pnpm-lock.yaml`, verify first). Contrast reuses `contrastRatio` from `@ad/theme` (`packages/theme/src/contrast.ts`).

| Gate | File | What fails the build |
|---|---|---|
| Token drift | `packages/ui/src/design-tokens.test.ts` | `tokens.css` and `.claude/skills/angels-delight-design-system/reference/tokens.css` differ in any `--` custom property; any token in the table of DS section 3, 5, 6, 8 missing or different; `--cards-visible` values per breakpoint are 2.3, 3.3, 4.3, 5.3, 6.3; spacing tokens are the 4 px scale only; `--button-height-*` are 2, 2.5, 3 rem; motion tokens exist. |
| No hardcoded values | extend `packages/ui/src/motion-tokens.test.ts` and `scripts/no-hardcoded-copy.test.ts` pattern | literal hex, rgb, font name, `px` font size or duration in component CSS outside tokens.css (allow `0`, `1px` borders, `2px` and `3px` ring widths in a named list). |
| Hover rules | `packages/ui/test/hover-guard.test.ts` | any `:hover` selector in any CSS under `packages/*/src` and `apps/web/src` not inside `@media (hover: hover)`; any hover rule that sets `transform`, `scale` or `opacity` not inside `(hover: hover) and (pointer: fine)`. |
| Reduced motion | `packages/ui/src/reduced-motion.test.ts` | tokens.css lacks `@media (prefers-reduced-motion: reduce)` (and fails on `no-preference` or `reduced`); the block does not zero instant, fast, base, slow, hover, press, hover-card delay; any `animation:` or `transition:` using a non token duration; any `scale(` or `translate` hover without a `none` override in the reduce block; `Row.page()` and `Hero` read the media query. |
| Animated properties | `packages/ui/test/motion-props.test.ts` | `transition-property` or shorthand lists a property outside the allowed list (section 3 item 10). |
| Touch targets | `packages/ui/test/touch-targets.test.ts` (and reuse the pattern in `admin-css.test.ts`) | any selector in a maintained list (`.ad-btn`, `.ad-iconbtn`, `.ad-pill`, `.ad-nav__link`, `.ad-tabbar__item`, `.ad-row__arrow`, `.ad-card__action`, `.ad-hero__dot`, `.adp-seek`, `.adp-ctl`) whose resolved `min-height` or `height` is below `--touch-target` and has no `::before` hit area rule; list kept in the test, new interactive classes must be added or opt out with a comment. |
| Contrast | extend `packages/theme/src/token-pairs.test.ts` | add pairs: focus ring on bg, on surface, on each `--color-avatar-*`, `--color-tile-*`; ink on `--color-surface` badge for the CC mark; white on hero scrim stops with the lightest hero image assumed white (0.85 alpha over white gives the worst case); muted on surface; each of the 6 theme presets passes the gate. |
| Focus visibility | `packages/ui/test/focus-ring.test.ts` | every rule that sets `outline: none` or `outline: 0` has, in the same file, a `:focus-visible` rule for the same component that sets a ring (outline or border at least 2 px, or a child outline) and, for box-shadow only rings, a `@media (forced-colors: active)` fallback. Allowlist: the `tabindex=-1` main landmark rules in globals.css (`.web-main`, `.web-authpage__main`, `.web-profiles`, `.auth-body`). |
| Fonts | `apps/web/src/lib/fonts.test.ts` (extend) | six families each ship latin, latin-ext and vietnamese files; coverage list (below) present per family via a small build-time script check (`scripts/font-coverage.mjs`, fontTools or opentype.js if already a dependency, otherwise a committed JSON coverage manifest generated once and verified by file hash). |
| Skeleton parity | `packages/ui/src/components/Skeleton.test.tsx` (extend) | skeleton card and real card share the same flex basis expression, same ratio token and same bar count; skeleton row has the gutter padding. |
| Copy | `scripts/no-hardcoded-copy.test.ts` (extend) | empty and error copy has no dash characters, no exclamation marks, at most 20 words per sentence and exactly one action. |
| Doc sync | `scripts/design-doc-sync.test.ts` | numbers in DS 6 (columns, gutter, breakpoints), 8 (hover delay, hero interval) and 5.2 match tokens.css; `ai-context.md` decision number equals the highest heading. |

CI: these run inside existing per package vitest projects, so the scoped commands are `pnpm vitest run packages/ui/src/design-tokens.test.ts` and so on. No full suite.

## 6. Detailed build list

Order matters: docs and guards first (they are cheap and fail loudly), tokens, then components. Each slice is its own branch `feat/m47-sNN-...` and PR, rebased on origin/main before merge. Every slice: failing test first, run only that file, run `scripts/footprint-check.sh`, grep the diff for dashes and emojis, review with the design skill for UI slices, append CHANGELOG.md, no AI trailers.

### Slice S01 Reconcile docs (X1 to X16 except code parts) and decisions register
Files: `docs/DESIGN-SYSTEM.md`, `docs/SCREEN-ARCHITECTURE.md` (section 2), `docs/USER-STORIES.md` (M05-S01 AC2 only), `docs/DECISIONS.md` (register at top, append new DEC rows), `docs/BUILD-PLAN.md` (appended table), `docs/audits/2026-11-24-netflix-rea-audit.md` (appended "Checked" lines), `docs/MODULES.md` (add M47 row `| M47 | Design system tuning and guards | Cross cutting | [READY] |`), `docs/USER-STORIES.md` (append `## M47` block from section 8), `docs/SCREEN-ARCHITECTURE.md` (append mockup list S150 to S159).
Failing tests first (`scripts/design-doc-sync.test.ts`, `scripts/decisions-ids.test.ts`):
- `design doc quotes the token values the css ships`
- `design doc names hero interval 10 s and crossfade 350 ms`
- `decision ids are unique except the four registered pairs`
- `every registered duplicate has two headings and a lane suffix`
- `ai-context decision number matches the highest heading` (the test reads the text the main session will paste, so L8 ships it initially as a warning `it.todo` and flips it on when the main session updates ai-context.md)
- `MODULES lists M47 and USER-STORIES has M47-S01 to the last story`

### Slice S02 Guard scaffolding
Files: `packages/ui/test/css-scan.ts`, `packages/ui/test/hover-guard.test.ts`, `packages/ui/test/motion-props.test.ts`, `packages/ui/test/focus-ring.test.ts`, `packages/ui/test/touch-targets.test.ts`.
Failing tests first (expected to fail on today's code, which is the point):
- `hover-guard: no bare :hover outside (hover: hover)` fails with the 7 offenders in section 2.
- `hover-guard: movement and reveal need pointer fine` fails on `.ad-iconbtn:hover` if it scales (verify) and passes otherwise.
- `focus-ring: outline none has a replacement ring` fails on `.ad-tile` forced colors fallback (no `forced-colors` block exists).
- `touch-targets: seek bar hit area is at least 44px` fails (32 px).
- `motion-props: only transform, opacity and colour properties transition` establishes the allowlist and fails on nothing known (record result).
Then fix each in its own commit: wrap the stray hovers (player.css, globals.css, watch.css, pwa.css; keep rule bodies unchanged), add `@media (forced-colors: active)` ring for tile and card link, set `.adp-seek { height: var(--touch-target) }` (rail stays 4 px, vertically centred, `::before` not needed). Files other lanes own (`player.css`, `watch.css`, `pwa.css`) get wrap-only edits, flagged in the PR.

### Slice S03 Tokens: breakpoints, columns, gutter, type, buttons, motion
Files: `packages/ui/src/tokens.css`, `.claude/skills/angels-delight-design-system/reference/tokens.css` (mirror), `packages/ui/src/components.css` (hero title, avatar initials), `docs/DESIGN-SYSTEM.md` (sections 5.2, 6, 8).
Failing tests first (`packages/ui/src/design-tokens.test.ts`):
- `cards visible tokens are 2.3, 3.3, 4.3, 5.3 and 6.3 at 0, 600, 1280 and 1920 widths`
- `a 1920 media block exists and 2560 does not`
- `page gutter is clamp(1rem, 4vw, 3.5rem) with no per breakpoint override`
- `type tokens below 960 are 28, 24, 20, 18, 17 for h1, h2, h3, h4, lead and desktop values from 960`
- `hero text token is clamp(2rem, 5vw, 3.5rem) times the type scale`
- `button height tokens are 2rem, 2.5rem and 3rem`
- `motion tokens: hover 250ms, press 0ms, ease out strong, hover card delay 300ms`
- `reduced motion block zeroes hover, press and hover card delay`
- `skill reference tokens.css matches ui tokens.css`
Implementation notes:
- Type decision (DEC-L8-05): docs are right for H1 to lead because DS is mobile first and a 40 px H1 on a 360 px phone is oversized (about 9 characters per line of an 18 character title). Code is wrong. Move tokens to the mobile values and re-set the desktop values inside `@media (min-width: 960px)` (the DS 5.2 rule "responsive sizes reassign tokens, not component overrides"). Hero is the exception: a single `--text-hero: calc(clamp(2rem, 5vw, 3.5rem) * var(--type-scale))`, and the component override at components.css 1755 is deleted. The avatar initials at 120 and 160 px stop using `--text-hero` and use `--text-h1` (a type token is the wrong token for a fixed box, so add `--avatar-initial-120: 2.5rem` and `-160: 3.5rem`).
- `--text-hero` doc row becomes "clamp(2rem, 5vw, 3.5rem)" (mobile 32 at 360 wide, 56 from about 1120).
- Rewrite `--cards-visible`, `--page-gutter`, add the 1920 block: `--cards-visible: 6.3; --content-max: 120rem` (rails only, text pages keep a prose cap via `.web-page` max width, check `globals.css` `.web-page` uses `--content-max`, if so introduce `--prose-max: 90rem` and point `.web-page` at it; test `page prose width stays 90rem at 1920`).
- Tokens `--motion-hover`, `--motion-press`, `--ease-out-strong`, `--hover-card-delay`, alias `--hover-intent-delay`, `--button-height-sm|md|lg`, `--button-pad-x`, `--icon-gap`, `--tabbar-height`, `--scrim-hero-*`.

### Slice S04 Buttons and icon buttons
Files: `packages/ui/src/components.css`, `packages/ui/src/components/Button.tsx` (add `size="md"` explicit, default stays), `Button.test.tsx`.
Failing tests: `button heights come from size tokens`, `fine pointer buttons keep a 44px hit area through the before element`, `coarse pointer buttons are at least 44px tall`, `press uses motion-press`, `icon only button keeps 44px`.
Note (DEC-L8-02): hero and auth stay `lg` (3 rem visual, 44 touch via hit area). Admin table small buttons use `sm` (2 rem) with the hit area. Review with the skill: neighbouring buttons need 8 px between hit areas, so the hit area pseudo-element must not overlap the sibling (test: gap token at least 8 px, `.ad-hero__actions` gap check).

### Slice S05 Reduced motion and row scroll
Files: `packages/ui/src/tokens.css`, `components.css`, `components/Row.tsx`, `Row.test.tsx`, `packages/ui/src/reduced-motion.test.ts`.
Failing tests: `reduced motion block uses the reduce value`, `Row paging uses auto scroll behaviour when reduced motion matches`, `no hover scale remains active under reduce`, `skeleton shimmer is replaced by a static fill`.

### Slice S06 Row: container queries, fractional columns, arrows, snap
Files: `components.css` (Row, Skeleton rules), `components/Row.tsx`, `Row.test.tsx`, `design-tokens.test.ts`.
Failing tests:
- `row is a size container named row`
- `row card width uses container units and subtracts both gutters and the gaps`
- `row column count changes at container widths 600, 960, 1280 and 1920`
- `the next card peeks at every container width (visible count has a fraction)`
- `prev and next arrows are centred on the thumbnail (top derived from card width, not 25 percent)`
- `arrows render only for fine pointers, prev hidden at start, next hidden at end`
- `list uses native scroll snap proximity, scroll padding equals the gutter, no JS scroll hijack`
- `keyboard: focused arrow keeps focus after paging`
Implementation: `.ad-row { container-type: inline-size; --row-card-width: calc((100cqw - 2 * var(--page-gutter) - (var(--cards-visible) - 1) * var(--card-gap)) / var(--cards-visible)); }`. The `@container row` rules set `--cards-visible` on `.ad-row__viewport` and `.ad-row__head`. `.ad-row__item { flex: 0 0 var(--row-card-width) }`. Arrow `top: calc(var(--space-1) + var(--row-card-width) * 9 / 32 - var(--touch-target) / 2)`. Snap stays `proximity` (DEC-L8-06, mandatory traps users on short rows and fights hover scale). Edge: browsers without container query support fall back to the `:root` values because the viewport rules still define `--cards-visible` (progressive, no JS).

### Slice S07 Card hover card
Files: `components.css`, `components/Cards.tsx`, `Cards.test.tsx`.
Failing tests:
- `hover delay applies on enter only, mouse out is not delayed` (assert the delay sits in the `:hover` rule, not the base rule; this is a present bug)
- `hover card scale is 1.25 with 250ms strong ease out and 300ms delay`
- `first item scales from the left, last item from the right, others from the centre`
- `hover card shows title, length, subject and Play` (peek gains title, spoken length and category name, still `aria-hidden`, real actions stay siblings per DS 11.5)
- `hover card exists only under hover and pointer fine, never on touch`
- `row does not clip the scaled card` (list gets block padding of `calc(var(--row-card-width) * 9 / 16 * 0.125)` and a matching negative margin so layout height is unchanged)
- `focus-within shows the same peek without scale` (keyboard users get the content, no motion)
- `reduce removes scale and delay`
- `CC badge text and border use surface and ink, not ink on a dark scrim` (fixes the contrast defect)
Implementation: scale the thumb, not the link, so the title below does not jump. Transform and opacity only. `z-index: var(--z-sticky)` while hovered so the card sits over neighbours. Last visible card cannot be known in CSS, so origin uses `:first-child` and `:last-child` only (DEC-L8-07). The existing 4 px lift is removed (replaced by scale) and DS 11.5 hover row updated.

### Slice S08 Top navigation: IntersectionObserver solid state and fade
Files: `components/TopNav.tsx`, `TopNav.test.tsx`, `components.css`.
Failing tests:
- `nav turns solid when the sentinel leaves the viewport` (IntersectionObserver mocked in the test, no scroll listener registered)
- `nav threshold is 40px` (sentinel height)
- `nav removes the observer on unmount and when not over a hero`
- `nav is solid at load when the page is restored scrolled` (observer fires initial entry)
- `solid fade is an opacity transition on a layer, not a background gradient swap`
- `clear state text stays white on the scrim, solid state ink on surface at 4.5 contrast`
- `no IntersectionObserver available falls back to solid` (safe default)
- `focus ring colour flips to the dark ring over the clear nav` (exists, keep)
Implementation: a zero size `<span data-nav-sentinel>` absolutely positioned 40 px below the page top, placed by the nav; `.ad-nav::before` holds the solid surface with `opacity` 0 to 1 over `--motion-base`; the gradient scrim moves to `.ad-nav::after`. Heights stay 3.5 and 4.25 rem (DEC-L8-04).

### Slice S09 Focus rings and contrast defects
Files: `components.css`, `apps/web/src/app/globals.css` (shell), `packages/player/src/player.css` (seek only), tests above.
Failing tests: `tile focus draws an outline with offset on the avatar, not a bare box-shadow`, `tile ring meets 3:1 against bg and each avatar fill in the default theme` (needs the 2 px gap: ring on bg, which is 4.81), `tile and card rings survive forced colors`, `tile hover ring is not the only focus signal`, `CC badge contrast at least 4.5` (S07 owns the fix, this asserts it).
Implementation: `.ad-tile:focus-visible .ad-tile__avatar { outline: 3px solid var(--color-focus-ring); outline-offset: 3px; box-shadow: none }` (the gap shows the page background so the ring is judged against bg, not the avatar fill). Add `@media (forced-colors: active) { .ad-tile:focus-visible .ad-tile__avatar { outline-color: Highlight } }`. The ring colour on a dark bg uses `--color-focus-ring-dark`: add `.ad-tile[data-surface='dark']` hook only if the picker ever sits on a dark surface (it does not today, so no new code, test asserts the picker bg is light).

### Slice S10 Hero: scrim tokens, crossfade, rotation constant
Files: `components/Hero.tsx`, `Hero.test.tsx`, `components.css`, `tokens.css`, `apps/web/src/components/home/HomeHero.tsx` and test (constant only).
Failing tests: `hero rotation interval is HERO_ROTATE_MS 10000`, `hero crossfades slides over 350ms with opacity`, `crossfade is skipped under reduced motion`, `hero rotation pauses on hover, focus, touch and the Pause control`, `white title on the lightest scrim stop is at least 4.5` (computed with the 0.85, 0.45 and 0 stops over a white worst case image at the text position, stops chosen so the text region is at least 0.85 under it), `mobile hero scrim bottom stop covers the text block`.
Implementation: render the previous and current slide stacked, current fades in (`opacity`), previous fades out, previous removed after the transition (`transitionend` with a timer fallback of `--motion-slow`). Keep `aria-live` off while rotating automatically (current behaviour, verify) and on after the user acts.

### Slice S11 Skeleton geometry
Files: `components/Skeleton.tsx`, `Skeleton.test.tsx`, `components.css`, `apps/web/src/components/home/HomeView.tsx` (usage), `RowSkeleton` in `Row.tsx`.
Failing tests: `skeleton card basis equals the row card width token`, `skeleton row has the page gutter padding`, `skeleton card has thumb at the card ratio, two title bars at title line height and one meta bar`, `skeleton hero box has the hero ratio at mobile and desktop`, `skeleton shows after 300ms and replaces content in one step`, `reduced motion shows a static fill and keeps aria-busy`, `row loading and ready have the same height` (the row wrapper reserves `min-height` from the same formula).
Implementation: `.ad-skelcard { flex: 0 0 var(--row-card-width) }`, `.ad-skelrow { padding: var(--space-1) var(--page-gutter) }`, bar heights from `var(--text-small) * var(--leading-snug)` via `calc`. The skeleton lives inside `.ad-row` so it inherits the container.

### Slice S12 Fonts: add the vietnamese subset and the coverage gate
Files: `apps/web/src/fonts/*-vietnamese-*.woff2` (six families, same weights; Poppins four files), `apps/web/src/lib/fonts.ts`, `fonts.test.ts`, `scripts/font-coverage.mjs`, `docs/DESIGN-SYSTEM.md` 5.1, `OFL` files already present.
Failing tests first (`apps/web/src/lib/fonts.test.ts`):
- `each family ships latin, latin-ext and vietnamese files`
- `selected family lists three faces in the font stack, before the system fallback`
- `vietnamese and ext faces are not preloaded`
- `coverage: every family has a glyph for the Yoruba and Igbo set` with the set: `ọ ẹ ṣ ọ̀ ẹ̀ ń ǹ ḿ à á è é ì í ò ó ù ú Ọ Ẹ Ṣ` plus Igbo `ị ụ ọ ṅ ị̄ ụ̄ Ị Ụ Ọ` plus the naira sign `₦`. Per family, glyphs not in the font are reported by name. Today this fails for `ọ ẹ Ọ Ẹ ị ụ Ị Ụ` in all six (confirmed for U+1ECD, U+1EB9, U+1ECC, U+1EB8; `ị ụ` U+1ECB and U+1EE5 sit in the same subset so expected missing, confirm in the test run) and `ṣ` and `₦` for DM Sans, Lora, Poppins.
- `font payload per selected family stays under 60 KB compressed for latin plus first use` (DS 13 budget). Vietnamese is lazy: it is only fetched when a page needs those glyphs. If a family's latin file already uses 60 KB, the test records the figure instead of failing and the PR notes the regression as DS 13 requires.
Implementation: fetch `@fontsource-variable/<family>` vietnamese woff2 files (OFL, same licences already shipped) into `apps/web/src/fonts`, add `<family>Vi` entries with `preload: false`, extend `FAMILIES` to a three tuple, and extend `selectFonts` (`--font-sans` and `--font-display` stacks list latin, ext, vi, fallback). Naira: for DM Sans, Lora and Poppins the glyph is not in any Google subset used here, so the stack falls to the system font for U+20A6. Acceptable and recorded (system fonts carry it); if the owner wants Poppins naira in the brand font, that is a font substitution decision, not blocking. Also the theme editor font sample line (DS 11.24) shows `Ọ̀rọ̀ ẹ̀kọ́ ṣe pàtàkì` so staff see missing glyphs before saving.

### Slice S13 Empty and error copy rules
Files: `packages/ui/src/components/States.tsx`, `States.test.tsx`, `scripts/no-hardcoded-copy.test.ts`, `docs/DESIGN-SYSTEM.md` 11.20, 11.21, 14.
Failing tests: `empty state has a heading, one sentence and at most one primary action`, `error state says what happened and what to do next in two sentences or fewer`, `error state never renders a raw code as the message (reference sits in small text)`, `copy has no exclamation mark, dash character or emoji`, `row error copy is "Could not load this row. Try again." with a Retry button`, `empty row with data is hidden, My List empty state is shown`.
Copy rules added to DS 14: one sentence of help under 20 words, one action, verb first label, no blame, error shows "what happened, what to do" and a reference only in caption text. Defaults table in DS 14 stays the single source; components import them from `@ad/ui` copy constants so tests read the same strings.

### Slice S14 Tab bar tokens and behaviour
Files: `tokens.css` (`--tabbar-height`), `components.css` (tab bar and footer padding), `TopNav.test.tsx`.
Failing tests: `tab bar height token includes the safe area inset`, `footer bottom padding clears the tab bar by token, not a literal`, `tab bar hides from 960px`, `tab bar is omitted on title pages and absent on the watch route`, `tab bar items are 44px or taller and the current one carries aria-current and a 3px marker`.

### Slice S15 Guard wiring and docs finish
Files: `docs/lanes/L8-design-system.md` (lane note, what exists, scoped commands, gaps), `CHANGELOG.md` (append), `docs/DECISIONS.md` (append DEC-L8-01 to 08 as the next free D numbers), text for the main session to paste into `ai-context.md`. Flip the `it.todo` from S01. Run every L8 test file once, scoped, list them in the lane note.

PR plan: one PR per slice (15 PRs), S01 and S02 first. S03 gates S04 to S11. S12 and S13 and S14 are independent. Expected merge conflicts: `docs/DECISIONS.md` (keep both, renumber on conflict per the brief), `components.css` (other UI lanes), `tokens.css` and `docs/DESIGN-SYSTEM.md` (other planned lanes may add tokens, append only, keep mirror file in step).

## 7. UI review of the global shell (design skill checklist, against the audit)

Reviewed: root layout and shell classes (`globals.css` 1 to 60, `.web-*`), top nav, bottom tab bar, row, card, hero, skeletons, picker tile, footer. Findings are ordered by severity. IDs are used in the slices.

| ID | Severity | Finding | Where | Fix slice |
|---|---|---|---|---|
| F1 | High | Yoruba and Igbo precomposed letters `ọ ẹ ị ụ` and capitals fall back to a system font in all six families, so Nigerian titles can render in mixed typefaces and with mismatched vertical metrics. The docs claim coverage. | `apps/web/src/fonts`, `fonts.ts` | S12 |
| F2 | High | Captions badge on cards: ink text and ink border on the dark 0.85 scrim, unreadable. | `.ad-card__cc` | S07 |
| F3 | High | Mouse-out of a card is delayed 500 ms because the hover delay is on the base transition. Cards feel stuck and the lift lingers while the pointer moves to the next card. | components.css 1292 | S07 |
| F4 | Medium | Tile focus ring is a bare box-shadow with no offset, below 3:1 against the peach avatar fill, and disappears in forced colors. The `outline: none` is covered by a ring so it is not a missing focus, but it does not meet the DS 4.2 rule 4 (2 px offset, never removed). | `.ad-tile` | S09 |
| F5 | Medium | Skeleton card width ignores the row gutters and has no meta bar, so rows jump when content loads (CLS risk, DS 13 target under 0.1). | Skeleton.tsx, components.css 566 | S11 |
| F6 | Medium | Row arrows vertically at `top: 25%` of the viewport, which drifts from thumbnail centre as card width changes. | components.css 1561 | S06 |
| F7 | Medium | Last card at 1280 and above shows exactly 5 and no peek, so users do not know the row scrolls (audit adapt item). | tokens.css | S03, S06 |
| F8 | Medium | Mobile type: H1 40 px, H2 32 px, row titles 20 px on a 360 px phone. Docs designed 28, 24, 18. Hero title already works around it by component override, which is the pattern DS 5.2 forbids. | tokens.css, components.css | S03 |
| F9 | Medium | Seven rules apply `:hover` without a hover media query, so touch devices get sticky hover on player controls, chips and PWA buttons. | section 2 | S02 |
| F10 | Medium | Nav solid flip is a hard cut (gradient to colour), and uses a scroll listener on every scroll event, which the audit asks to replace by IntersectionObserver for main thread cost on low end phones. | TopNav.tsx | S08 |
| F11 | Medium | Seek bar hit area 32 px vs 44 px rule. | player.css | S02 |
| F12 | Low | Hero has no crossfade and rotation constant differs between doc, stories and code. | Hero.tsx, HomeHero.tsx | S10, S01 |
| F13 | Low | `Row.page()` smooth scrolls regardless of reduced motion preference (CSS `scroll-behavior` reset does not govern `scrollBy({behavior:'smooth'})`). | Row.tsx 61 | S05 |
| F14 | Low | Tab bar and footer use literal `3.5rem` and `4rem` that must stay equal. | components.css 2008, 2044 | S14 |
| F15 | Low | Avatar initials at 120 and 160 px use the hero type token, so the hero clamp would resize them. | components.css 933 to 938 | S03 |
| F16 | Low | `.web-chip:hover` changes the border to accent yellow. Accent is never the only boundary on light (DS 4.2 rule 2). Hover change must keep a 3:1 edge: use `--color-ink`. | globals.css 1029 | S02 |
| F17 | Info | Audit says "dark first". The DS and the owner brief are light first with dark scrims. Not a defect, a decision (DEC-L8-01). | tokens.css | none |
| F18 | Info | Good and kept: single token file, no hex in component CSS (the skill gate exists), `:focus-visible` global ring 3 px with 2 px offset (globals.css 30), skip link, `aria-labelledby` rows, `content-visibility: auto` below the fold, safe area on tab bar, `prefers-reduced-motion: reduce` already the right value. | | |

Skill checklist outcome: tokens (pass after S03 gate), contrast (F2, F4 to fix), states (hero loading and error exist, row error exists), keyboard and focus (F4, F11), touch targets (buttons currently pass because 44 is min-height; stays true after S04 because of the hit area test), skeletons (F5), reduced motion (F13, hero crossfade absent so nothing to remove yet), copy (rules added, S13), mobile first (F8).

## 8. Stories for module M47 (docs format, to append to `docs/USER-STORIES.md` and MODULES.md)

## M47 Design system tuning and guards

### M47-S01 Next card peeks at every width (Must)
As a viewer on any screen, I want to see part of the next card in every row, so that I know the row scrolls.
- AC1: Given a row on a container 360 px wide, When it renders, Then 2.3 cards are visible and the next card is partly shown.
- AC2: Given container widths 600, 960, 1280 and 1920 px, When the row renders, Then 3.3, 4.3, 5.3 and 6.3 cards are visible.
- AC3: Given the row sits in a narrower container (for example a split layout), When it renders, Then the count follows the container, not the viewport.
- AC4: Given the skeleton row, When it shows, Then card width and gutters equal the real row (no layout shift when content arrives).
- Edge: a row with fewer cards than fit shows them left aligned without arrows. Browsers without container queries use the viewport values.
- Error: not applicable.
- Empty: a row with no cards is hidden (My List shows its empty state).

### M47-S02 Hover only where hover exists (Must)
As a phone user, I want no sticky hover states, so that taps do not leave things highlighted or moved.
- AC1: Given any stylesheet, When scanned in CI, Then every `:hover` rule sits inside `@media (hover: hover)`.
- AC2: Given a rule that scales, moves or reveals, When scanned, Then it sits inside `(hover: hover) and (pointer: fine)`.
- AC3: Given a touch device, When I tap a card, Then no hover card, lift or reveal appears and the card opens.
- Edge: hybrid devices (laptop with touch) use the fine pointer rules while the mouse is the primary pointer.
- Error: CI fails with the file and line of the rule.
- Empty: not applicable.

### M47-S03 Hover card (Should)
As a desktop viewer, I want a quick preview of a title when I rest the mouse on it, so that I can decide without opening it.
- AC1: Given a fine pointer, When I rest on a card for 300 ms, Then the card scales to 1.25 over 250 ms with a strong ease out and shows title, length, subject and Play.
- AC2: Given I move the pointer away, When it leaves, Then the card returns immediately with no delay.
- AC3: Given the first card of a row, When it scales, Then it grows from the left edge. Given the last card, Then from the right edge. Others grow from the centre.
- AC4: Given the card scales, When it overlaps neighbours, Then it sits above them and is never clipped by the row.
- AC5: Given keyboard focus on a card, When focus-within applies, Then the same content shows without scale.
- AC6: Given reduced motion, When I hover, Then there is no scale and no delay, and the content shows at once.
- Edge: no video preview, ever. Title is read once by screen readers (the preview is `aria-hidden`).
- Error: not applicable.
- Empty: a card without a description shows title, length and Play only.

### M47-S04 Nav that turns solid on scroll (Must)
As a viewer, I want the top bar to stay readable over the hero and solid once I scroll, so that links are always legible.
- AC1: Given the Home page at the top, When it loads, Then the nav is clear over the hero scrim with white text.
- AC2: Given I scroll more than 40 px, When the sentinel leaves the viewport, Then the nav fades to the surface colour with ink text over 200 ms.
- AC3: Given a page restored scrolled, When it loads, Then the nav is already solid.
- AC4: Given a non hero page, When it loads, Then the nav is always solid.
- AC5: Given no IntersectionObserver, When the page loads, Then the nav is solid.
- Edge: nav height is 3.5 rem on phones and 4.25 rem from 960 px, in the same place in both states (no jump).
- Error: not applicable.
- Empty: not applicable.

### M47-S05 Row arrows and native scrolling (Must)
As a mouse user, I want arrows on a row, and as a touch user I want to swipe, so that both feel natural.
- AC1: Given a fine pointer, When I hover or focus inside a row, Then prev and next arrows appear centred on the thumbnails; the prev arrow is hidden at the start and the next at the end.
- AC2: Given I press an arrow, When the row pages, Then it moves one visible page minus one card, and focus stays on the arrow.
- AC3: Given reduced motion, When I page, Then the row jumps without smooth scrolling.
- AC4: Given a touch device, When I swipe, Then scrolling is native, snaps to a card start when near one, and the page does not scroll sideways.
- Edge: arrow targets are 44 px. Arrow keys are not hijacked.
- Error: not applicable.
- Empty: a row with all cards visible shows no arrows.

### M47-S06 Focus rings that always show and pass contrast (Must)
As a keyboard user, I want a visible ring on every focusable thing, so that I never lose my place.
- AC1: Given the profile picker, When a tile takes keyboard focus, Then a 3 px ring with a 3 px gap draws around the avatar with at least 3 to 1 contrast against the page.
- AC2: Given a card link, When focused, Then the ring draws around the thumbnail with a 2 px offset.
- AC3: Given Windows forced colors, When a tile or card is focused, Then the ring uses the system highlight colour.
- AC4: Given the default theme and every preset, When CI computes ring contrast, Then it is at least 3 to 1 against each adjacent colour.
- Edge: no component sets `outline: none` without a replacement ring (programmatic focus landmarks excepted).
- Error: CI names the selector.
- Empty: not applicable.

### M47-S07 Motion tokens and reduced motion (Must)
As a viewer who prefers less motion, I want movement removed everywhere, so that the site is comfortable.
- AC1: Given hover on desktop, When a control changes, Then it uses 250 ms with a strong ease out, and press uses 0 ms.
- AC2: Given `prefers-reduced-motion: reduce`, When any page loads, Then transitions and animations are near zero, hover cards do not scale, the hero does not crossfade or rotate, skeletons are static and rows jump instead of gliding.
- AC3: Given Data saver is on, When pages load, Then slow transitions are also removed.
- AC4: Given a stylesheet, When scanned, Then only transform, opacity and colour properties transition (progress width excepted).
- Edge: nothing flashes more than 3 times a second.
- Error: CI names the rule.
- Empty: not applicable.

### M47-S08 Button size tokens with 44 px targets (Should)
As a viewer, I want buttons that look tidy on desktop and are easy to press on a phone.
- AC1: Given a fine pointer, When a small, medium or large button renders, Then it looks 2, 2.5 or 3 rem tall and its tap area is still 44 px.
- AC2: Given a touch device, When any button renders, Then it is at least 44 px tall.
- AC3: Given two buttons side by side, When they render, Then their hit areas do not overlap (8 px between).
- Edge: icon only buttons are 44 by 44.
- Error: not applicable.
- Empty: not applicable.

### M47-S09 One type scale for docs and code (Must)
As a phone user, I want headings sized for a small screen, so that titles do not wrap into narrow columns.
- AC1: Given a viewport under 960 px, When pages render, Then H1 to lead are 28, 24, 20, 18 and 17 px.
- AC2: Given 960 px and above, When pages render, Then they are 40, 32, 24, 20 and 18 px.
- AC3: Given the hero title, When the viewport changes, Then it scales between 2 and 3.5 rem with `clamp(2rem, 5vw, 3.5rem)`.
- AC4: Given the admin base size factor 0.9 to 1.15, When set, Then all sizes scale and the layout survives 200 percent zoom.
- Edge: avatar initials do not follow the hero size.
- Error: not applicable.
- Empty: not applicable.

### M47-S10 Hero crossfade, rotation and readable text (Must)
As a viewer, I want the hero to change gently and always keep its text readable.
- AC1: Given several hero titles, When I wait, Then they rotate every 10 seconds with a 350 ms crossfade, a visible Pause control and dots.
- AC2: Given I hover, focus, touch or press Pause, When it happens, Then rotation stops.
- AC3: Given reduced motion or Data saver, When Home loads, Then the hero does not rotate and does not crossfade.
- AC4: Given any hero image, When the title shows, Then white text on the scrim is at least 4.5 to 1 against the lightest possible image.
- Edge: one title never rotates and has no dots. The hero is a still image (no video).
- Error: a missing image falls back to a solid primary panel with the title.
- Empty: no hero items hides the hero.

### M47-S11 Yoruba and Igbo letters in every font (Must)
As a Yoruba or Igbo speaker, I want my letters shown properly, so that titles and captions are correct.
- AC1: Given any of the six fonts, When text has `ọ ẹ ṣ ń ị ụ` and capitals, Then they render in the chosen font.
- AC2: Given the theme editor, When staff pick a font, Then the sample line shows these letters.
- AC3: Given CI, When fonts change, Then a coverage test lists any missing glyph by family.
- Edge: the naira sign falls back to the system font for fonts that do not carry it.
- Error: CI names family and glyph.
- Empty: not applicable.

### M47-S12 Skeletons that match the real layout (Must)
As a viewer on a slow network, I want placeholders the same size as the content, so that nothing jumps.
- AC1: Given a loading row, When the skeleton shows, Then each card matches width, 16:9 thumb, two title lines and a meta line of the real card.
- AC2: Given a wait under 300 ms, When it ends, Then no skeleton flashes.
- AC3: Given content arrives, When it replaces the skeleton, Then it appears in one step with no shift (CLS under 0.1).
- AC4: Given reduced motion, When a skeleton shows, Then it is a static fill with a hidden "Loading" label and `aria-busy`.
- Edge: a failed load shows the error state, never a skeleton.
- Error: not applicable.
- Empty: not applicable.

### M47-S13 One sentence, one action (Should)
As a viewer, I want clear messages when there is nothing to show or something fails, so that I know what to do.
- AC1: Given an empty state, When it shows, Then it has a headline, one sentence and one action.
- AC2: Given an error, When it shows, Then it says what happened and what to do next, with a reference code only in small text.
- AC3: Given any copy, When scanned in CI, Then it has no dashes, emojis or exclamation marks.
- Edge: row errors show "Could not load this row. Try again." and the other rows continue.
- Error: the error state is the story.
- Empty: My List empty says "Your list is empty." with "Browse videos".

### M47-S14 Bottom tab bar on phones (Should)
As a phone user, I want the main places one thumb away, so that I can move around easily.
- AC1: Given a phone width, When any viewer page shows, Then a 4 item bar (Home, Browse, Search, My List) sits at the bottom with the safe area inset, the current item marked by colour and a 3 px top bar.
- AC2: Given the title page or the watch page, When it shows, Then the bar is hidden.
- AC3: Given 960 px and wider, When pages show, Then the bar is hidden and the top nav shows the links.
- AC4: Given content near the page end, When I scroll, Then the footer clears the bar by exactly the bar height.
- Edge: a guest sees the same bar (no sign in wall, per the guest program).
- Error: not applicable.
- Empty: not applicable.

### M47-S15 Docs, decisions and guards stay in step (Must)
As the developer, I want docs and code to fail a check when they drift, so that the design system stays true.
- AC1: Given a number in DS sections 5, 6 or 8, When it differs from tokens.css, Then CI fails.
- AC2: Given `docs/DECISIONS.md`, When a new duplicate id is added, Then CI fails. The four known pairs are listed in a register.
- AC3: Given `ai-context.md`, When it quotes a decision number, Then it equals the highest heading.
- AC4: Given a new interactive class, When it has no touch target or focus ring rule, Then CI fails.
- Edge: allowlists carry a reason comment.
- Error: CI prints the file, line and rule.
- Empty: not applicable.

### M47-S16 Night theme preset (Could)
As the owner, I want an optional dark theme, so that the platform can look cinematic if the client prefers.
- AC1: Given the theme editor, When I pick Night, Then the colours fill and pass the contrast gate.
- AC2: Given Night is saved, When pages render, Then nav, cards, hero and player stay readable and focus rings use the dark ring.
- Edge: the default stays Default (off white).
- Error: a failing pair blocks save with the reason.
- Empty: not applicable.

Count: 16 stories (11 Must, 4 Should, 1 Could by the labels above: S01, S02, S04, S05, S06, S07, S09, S10, S11, S12, S15 Must = 11; S03, S08, S13, S14 Should = 4; S16 Could = 1).

## 9. Mockups S150 to S159

Mockups are `.dc.html` files in `/home/claude/ad/project/` named like the existing ones (`S150_rows_cards_desktop.dc.html`). Entries are appended to the numbered list in `docs/SCREEN-ARCHITECTURE.md`. Each shows default, hover, focus, active, loading, error where it applies, at 360 and 1440 unless noted.

| No | File name | Content | Stories |
|---|---|---|---|
| S150 | `S150_rows_cards_spec_desktop` | Rows and cards spec sheet at 1440 and 1920: columns 5.3 and 6.3 with the peek, gutter clamp values, card gap, row gap, arrows centred on thumbs (visible on hover, hidden at ends), See all link, card anatomy with the CC badge fix, series stack card at 16:9, Continue Watching card with progress. Annotated pixel measurements. | M47-S01, S05 |
| S151 | `S151_rows_cards_spec_mobile` | Same at 360 and 600: 2.3 and 3.3 columns, peek, no arrows, native swipe, action buttons always visible at low emphasis, snap marks. | M47-S01, S05 |
| S152 | `S152_nav_states_desktop` | Nav at 1440: clear over hero, solid after 40 px with the 200 ms fade, active link underline, hover underline, focus ring on clear and solid, search open, avatar menu. Sentinel shown as a dashed marker. | M47-S04, S06 |
| S153 | `S153_nav_tabbar_mobile` | Nav and bottom tab bar at 360: clear, solid, tab bar with safe area, current item marker, hidden on title and watch, footer clearance, 44 px target overlays. | M47-S04, S14 |
| S154 | `S154_hover_card_desktop` | Hover card timeline: rest, 300 ms delay, scale 1.25 over 250 ms; first card (origin left), middle (centre), last (origin right); content (title, length, subject, Play); focus-within variant without scale; reduced motion variant; touch variant shows none. | M47-S03, S07 |
| S155 | `S155_focus_states_sheet` | Focus state sheet, desktop and mobile: profile tile with offset ring, card link, nav links on clear and solid, row arrows, hero buttons and dots, pills, seek bar with 44 px hit area, forced colors rendering. Contrast values printed beside each (computed). | M47-S06 |
| S156 | `S156_tokens_sheet_desktop` | Tokens sheet at 1440: colour, type scale from 960 (40, 32, 24, 20, 18) with the hero clamp, spacing 4 px scale, radius, button sizes 2, 2.5, 3 rem with the 44 px hit overlay, motion table (instant 100, hover 250, press 0, base 200, slow 350, delay 300), ease curves, ratios 16:9, hero ratios, z layers. | M47-S07, S08, S09, S15 |
| S157 | `S157_tokens_sheet_mobile` | Tokens sheet at 360: mobile type scale (28, 24, 20, 18, 17), hero at 32, breakpoints 600, 960, 1280, 1920 with the columns per breakpoint, gutter clamp samples, Yoruba and Igbo specimen lines in all six fonts with the glyph coverage ticks. | M47-S09, S11 |
| S158 | `S158_skeleton_empty_error_states` | Skeleton row and hero (same geometry as the real thing, shown side by side), reduced motion static variant, empty states (My List, category), error states (row, full page, offline, playback), one sentence and one action, copy rules callouts. 360 and 1440. | M47-S12, S13 |
| S159 | `S159_hero_scrim_states` | Hero at 4:5 mobile and 16:9 desktop: scrim stops 0.85, 0.45, 0 with bands, text on the lightest image test strip, crossfade timeline at 350 ms, Pause control, dots, rotation 10 s, reduced motion and Data saver variants, fallback and skeleton. | M47-S10 |

## 10. Decisions to log (next free D numbers at merge time, highest today D-168)

| Id | Decision | Options | Why | Reversible |
|---|---|---|---|---|
| DEC-L8-01 | Keep the light default; no dark first. Add a Night preset (Could). | Dark default, light default, light with Night preset | Owner brief colours and DS are light; every colour is a token so a preset is cheap | Yes (preset) |
| DEC-L8-02 | Button sizes 2, 2.5, 3 rem visual with a 44 px hit area on fine pointers and 44 px minimum on coarse pointers | Adopt 32 px buttons as is; keep 44 only; tokens plus hit area | Meets the audit and the 44 px rule together | Yes |
| DEC-L8-03 | Series and video cards stay 16:9. Poster 2:3 is reserved, not used in v1 | 2:3 posters for series; 16:9 only | All source art is 16:9, hero art has its own cut (D-160), no poster upload for series | Yes |
| DEC-L8-04 | Nav heights stay 3.5 and 4.25 rem. Solid after 40 px by IntersectionObserver | Audit 3 and 4 rem; keep | 44 px controls need the height; threshold follows the audit | Yes |
| DEC-L8-05 | Type scale: code follows the docs (mobile 28, 24, 20, 18, 17; desktop from 960 40, 32, 24, 20, 18), hero is a clamp | Keep single values; adopt docs; adopt audit values only | Mobile first, 360 px baseline | Yes |
| DEC-L8-06 | Rows use scroll snap `proximity`, not `mandatory` | mandatory, proximity | Mandatory traps short rows and fights the hover scale | Yes |
| DEC-L8-07 | Hover card scales the thumb, origin left on first child and right on last child only | JS measured last visible origin; CSS only | Keeps CSS only, no layout measuring on hover | Yes |
| DEC-L8-08 | Add the vietnamese subset to all six fonts, loaded lazily | Latin only; latin plus ext; plus vietnamese; drop fonts that lack glyphs | Only way to render `ọ ẹ ị ụ` in the brand font | Yes |
| DEC-L8-09 | Hero rotates every 10 s by default, with Pause, off under reduced motion and Data saver | Off by default (old DS), 8 s (old stories) | Owner punch list item 6 | Yes |
| DEC-L8-10 | Duplicate decision ids are not renumbered; a register disambiguates them and a test blocks new duplicates | Renumber, register | Existing citations stay valid | Yes |
| DEC-L8-11 | Rails get a wider cap (120 rem) at 1920, text pages keep 90 rem | One cap | 6.3 columns at 1440 would be small | Yes |
| DEC-L8-12 | Up next countdown default 5 s, site setting 5 to 10 s, doc corrected from 8 | 8 s | Code and audit range | Yes |

## 11. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Changing H1 to lead on mobile alters every page layout | Visual regressions in lanes that tuned to 40 px | Slice S03 ships with a screenshot pass at 360 and 1440 of Home, Browse, Title, Account, Admin; admin uses its own `.adm-*` sizes, confirm by grep before merge |
| Container queries inside rows change `--cards-visible` away from `:root` | Components outside a row that read the token get the viewport value | Keep the `:root` values as fallback; browse grid keeps its own columns; test lists consumers |
| Scaled hover card clipped by `overflow-x: auto` on the row (overflow-y becomes auto too) | Card cut off at top and bottom | Block padding plus negative margin on the list, tested with a layout assertion and checked in the S154 mockup; fallback is to scale only opacity and shadow |
| Vietnamese subset adds payload | Page budget (fonts one family under 60 KB) | Lazy, not preloaded, loaded only when a glyph needs it; PR notes any regression per DS 13 |
| Hit area pseudo-element on buttons overlaps neighbours | Mis taps | 8 px gap rule and a test on `gap` tokens in button groups |
| Wrapping hover rules in other lanes' CSS (player, watch, pwa) conflicts with their open PRs | Merge conflicts | Wrap only, no body edits, small PR, rebase first; if a lane is mid change, defer that file and record it in the lane note |
| Guard tests are strict on first run and fail on existing code | Red CI for other lanes | Land each guard in the same PR as its fix; allowlists carry reasons; guards run only in the packages' scoped suites |
| IntersectionObserver sentinel breaks on pages with a transform parent or `position: fixed` shell | Nav never turns solid | Fallback to solid when the observer is missing and when the sentinel has no layout box on first measure; test both |
| Hero crossfade stacks two images | Double image bytes on slow networks | Only the next slide image is loaded after the first has loaded; `fetchpriority` stays on the first slide only; Data saver does not rotate so loads one image |
| `--hover-intent-delay` alias removal | Hidden consumer breaks silently | Alias kept until a grep proves no user; test fails if alias remains after S03's last commit and a consumer remains |
| Measured values in the audit are marked likely or inferred | Tuned wrong for low end Android | All numbers are tokens, tuned on a throttled Lagos class device before launch (lane note records the device pass as a manual check, not a gate) |
| M47 id may collide with another v2 lane that also claims it | Story id clash | Lane brief assigned M47 to L8; the S01 slice checks `docs/MODULES.md` on origin/main for M47 before appending and uses the next free module number if taken |

## 12. Manual checks that no test can prove (list in the lane note)

1. Scroll a Home page on a mid range Android over throttled 4G: nav fade, no jank, CLS under 0.1.
2. Windows high contrast mode: tile and card focus ring, nav, buttons.
3. Screen reader pass on a row with the hover content `aria-hidden` (one announcement per card).
4. Yoruba, Igbo and Hausa title sample in each of the six fonts at 360 px.
5. Real hero images, the lightest three, for the scrim contrast test.
