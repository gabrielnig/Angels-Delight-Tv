# L4 Player features (module M43) plan

Status: planning pass, docs only. Date: 24 November 2026. Base: origin/main at 08d6e86. Inputs read: the Netflix audit (sections 1 to 4, plus 5 for the guest interfaces), CLAUDE.md, docs/USER-STORIES.md (M02-S04 and all of M08), docs/DESIGN-SYSTEM.md (11.22, 11.23, 13), the design skill, `packages/player/src` (controller, keyboard, gestures, quality, resume, hlsConfig, hlsEngine, captionStyle, ui/*, player.css), `apps/web/src/features/player`, `apps/web/src/server/data/real-playback.ts`, the admin video editor and preview, `packages/video` (encode, playlist, ladder, probe) and `packages/db` schema.

## 1. Scope

In scope, with priority:

| Feature | Priority | Slices |
| --- | --- | --- |
| Skip intro and skip credits (admin markers, player Skip button, S key) | Must | L4-01 to L4-06 |
| Admin marker editor on the video page | Must | L4-06 |
| Skip recap | Could, built with the same code at no extra cost, admin may leave it empty | L4-02, L4-06 |
| Chapters (admin editable, ticks on seek bar, chapters menu) | Should | L4-01 to L4-06 |
| Autoplay next and Up Next polish (5 to 10 s cancellable countdown, credits tile, standalone next, Still watching) | Must (countdown), Should (rest) | L4-08 |
| Player settings menu (autoplay next toggle, caption appearance, subtitle language, keyboard help entry) | Should | L4-07 |
| Theatre mode (desktop) | Should | L4-09 |
| Picture in picture fix (iOS Safari, state sync) | Should | L4-10 |
| AirPlay (Safari) | Should | L4-10 |
| Chromecast sender | Could, deferred (recommendation in 1.2) | L4-15 |
| Low bandwidth behaviours and error states polish | Should | L4-11 |
| Controls fade, scrubber 5 px to 8 px with 44 px hit area, hover rules, tokens | Must | L4-04 |
| Audio track selector | Could (player menu L4-13, encode L4-14), build only if the owner confirms alternate audio content | L4-13, L4-14 |
| Marker suggestions from the worker | Could | L4-16 |
| Verification of seek preview, gestures, a11y, touch targets | Must | L4-12 |

Out of scope (owned elsewhere or skipped): Home autoplay previews consumer (hero lane; the per profile toggle already exists), likes and ratings, offline downloads, TV layout, Yoruba and other caption translations, scrubber sprites beyond current, swipe gestures for volume and brightness (skipped, see decision L4-D12), auto skip intro without a button (Could, decision L4-D5).

### 1.1 What already exists (verified in code, marked done, not re-planned)

| Item | Evidence | State |
| --- | --- | --- |
| Controls fade after 3 s, return on pointer, key, touch, stay on keyboard focus, never hide while paused or a menu is open, cursor hides | `HIDE_AFTER_MS = 3_000` in `ui/PlayerView.tsx`; tests in `ui/PlayerView.chrome.test.tsx` lines 57 to 114 | Done |
| Seek bar rail growing to 8 px on hover, drag and focus | `player.css` `.adp-seek__rail` (4 px rest) | Partly: rest size and hit area need fixing (L4-04) |
| Seek preview thumbnails from sprite map, lazy on first hover, never with Data saver, edge clamping, silent failure | `ui/SeekBar.tsx`, `sprite.ts`; six tests in `ui/SeekBar.test.tsx` | Done, re-verified in L4-12 |
| Double tap seek 10 s with ripple, accumulation, centre toggles play, thirds | `gestures.ts`, `gestures.test.ts`, `onSurfacePointerUp` | Done |
| Keyboard map (Space, K, J, L, arrows, Home, End, 0 to 9, M, C, F, N, Shift comma and period, question mark) and help dialog | `keyboard.ts`, `ui/ShortcutsDialog.tsx`, `SHORTCUT_HELP`, test 'covers every group shown in the S26 dialog' | Done; needs S and T rows (L4-03, L4-09) and a visible entry point (L4-07) |
| Picture in picture button, hidden when unsupported, toast on denial, Media Session lock screen controls | `togglePip`, `pipSupported`, media session effect in `PlayerView.tsx` | Done for Chromium and desktop Safari; gaps in 3.3 (F10) |
| Up Next: end screen with ring countdown, Cancel, Play now, Back to series, 15 s "Next" tile with dismiss, any key cancels countdown | `ui/EndScreen.tsx`, `ui/Overlays.tsx`, `controller.startCountdown`, `cancelCountdown`, `dismissUpNextTile` | Done at a fixed 5 s; polish in L4-08 |
| Per profile toggles: Autoplay next episode, Autoplay previews on Home, Data saver, default quality, default speed, captions default, caption size, background, contrast, caption language | `components/account/PlaybackSettings.tsx`, `server/data/real-account-data.ts` (`playbackPrefs` jsonb, `autoplayNext` column) | Done at `/settings/playback`; in player entry point is new (L4-07) |
| Caption styling in the player (size, background, contrast, CSS variables) and multi language caption menu (Off plus tracks) | `captionStyle.ts`, `Menus.tsx` `CaptionRows`, `multiLanguage` in `PlayerView.tsx` | Done; appearance not editable inside the player (F7) |
| Resume with minus 3 s, toast with Start over, `?t=` override, stale position ignored | `resume.ts`, `resume.test.ts` | Done |
| Quality menu, Data saver cap, start on 360p under low data, ABR seeded from last session, 30 s buffer, retries 1, 2, 4 s | `quality.ts`, `hlsConfig.ts`, `bandwidth.ts` | Done |
| Buffering spinner after 500 ms, "Slow connection" after 8 s, recovery after 20 s, offline and back online banner | `controller.onWaiting`, `Overlays.tsx` | Done; extensions in L4-11 |
| Error states: connection lost, offline, session expired, removed, cannot play (with reference), unsupported browser | `ErrorOverlay` in `ui/Overlays.tsx`, `PlayerErrorKind` | Done |
| Poster, first frame fade, safe area insets, landscape phone fill, reduced motion, forced colours | `player.css` | Done |
| Full screen, orientation lock on phones, native iOS full screen | `toggleFullscreen`; tests lines 142 to 200 | Done |
| Playback metrics and telemetry | `controller.telemetry.test.ts`, `features/player/telemetry.ts` | Done |

### 1.2 Cast and AirPlay: scope decision and recommendation

Findings that drive the decision:

1. `createPlayerEngine` tries hls.js (MSE) first and native HLS second (`hlsEngine.ts` line 303). Safari with MSE plays through a `MediaSource`, which AirPlay and the Remote Playback API cannot hand to a receiver. The receiver must fetch the HLS URL itself.
2. The native path already exists and carries the token as `?pt=` (`withNativeToken` in `token.ts`), because native HLS cannot set headers. That is the same shape a receiver needs. Segment URLs are signed and need no cookie, so a receiver can fetch them.
3. Chromecast needs the Google Cast sender SDK (a third party script from gstatic, a new CSP `script-src` entry, an NDPA disclosure), a registered receiver application id (a Google Cast developer account and a fee, which is a client input), CORS headers on playlists, keys and segments for the receiver origin, and a token that outlives the session. Chrome already offers "Cast..." for the whole tab with no code, which covers the occasional need.
4. Guest tokens will have 15 to 20 minute segment TTLs (audit section 5). A receiver cannot refresh a token, so any cast session longer than the TTL stops for guests. Signed in accounts keep 2 hours.

Recommendation (logged as L4-D8):

- Build AirPlay now (Should): it needs no SDK, no account and no CSP change, only a Safari feature check and an engine switch to native HLS for the casting session.
- Defer the Chromecast sender to Could (L4-15) with a written spec, and ship a Help article line "Use Cast from the Chrome menu". Revisit once the client supplies a Cast developer account and there is real demand.
- For both, cast sessions for guests show a one line note "Guests can cast for about 15 minutes. Sign in for longer." only if the guest TTL lands as planned in L1.

## 2. Build list

Rules for every slice: branch from a fresh `origin/main` (`git fetch origin +refs/heads/main:refs/remotes/origin/main`), failing test first, run only the named files with `pnpm vitest run <path>`, run `scripts/footprint-check.sh`, grep the diff for em dashes, en dashes and emojis, run the design skill review on every UI slice, one PR per slice, rebase merge. Decision numbers L4-Dn below are placeholders: take the next free D-number from `docs/DECISIONS.md` at merge time. Migration number is "next free" on main at merge time (today 0036).

Order of merge: L4-00, L4-01, L4-02, L4-04 (parallel with 02), L4-03, L4-05, L4-06, L4-07, L4-08, L4-09, L4-10, L4-11, L4-12, then the Could slices. L4-04 and L4-09 touch `player.css` and `PlayerView.tsx`, so merge L4-04 first and rebase.

### L4-00 Docs first (stories, module, design system)

Branch `l4/docs-m43`. Files: `docs/USER-STORIES.md` (M43 section and the M08 and M02 edits in section 4), `docs/MODULES.md` (row M43 "Player features: skip, chapters, theatre, cast, player settings", Viewer and Admin, [READY]; change "36 modules" to "37"), `docs/SCREEN-ARCHITECTURE.md` (screens S110 to S119 listed in section 6, and the new admin route `/admin/videos/[id]/markers`), `docs/DESIGN-SYSTEM.md` section 11.22 (seek rail 5 px to 8 px, 44 px hit area, Skip button, chapters, theatre, settings menu) and 11.23 (countdown 5 to 10 s). No code, no test. Done when `grep -c "M43-S" docs/USER-STORIES.md` is 17 or more.

### L4-01 Markers and chapters data

Branch `l4/markers-data`. Migration `packages/db/migrations/main/NNNN_video_markers_chapters.sql`, additive, no rewrite of existing tables:

```sql
CREATE TABLE video_markers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  kind text NOT NULL,
  start_ms integer NOT NULL,
  end_ms integer,
  created_by uuid REFERENCES accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_markers_kind_known CHECK (kind IN ('intro', 'recap', 'credits')),
  CONSTRAINT video_markers_start_nonneg CHECK (start_ms >= 0),
  CONSTRAINT video_markers_end_after_start CHECK (end_ms IS NULL OR end_ms > start_ms),
  CONSTRAINT video_markers_end_required CHECK (kind = 'credits' OR end_ms IS NOT NULL),
  CONSTRAINT video_markers_video_kind_uniq UNIQUE (video_id, kind)
);
CREATE TABLE video_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  start_ms integer NOT NULL,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_chapters_start_nonneg CHECK (start_ms >= 0),
  CONSTRAINT video_chapters_title_length CHECK (char_length(title) BETWEEN 1 AND 60),
  CONSTRAINT video_chapters_video_start_uniq UNIQUE (video_id, start_ms)
);
CREATE INDEX video_chapters_video_idx ON video_chapters (video_id, start_ms);
```

A null `end_ms` on credits means "to the end of the video", so a replaced video with a different length never leaves a stale end. Chapter order is the order of `start_ms`, so there is no position column to keep in sync. Update the drizzle journal (`packages/db/migrations/main/meta`) and `packages/db/src/schema/content.ts` (`videoMarkers`, `videoChapters`, exported from `index.ts`). Rollback is `DROP TABLE` of both; nothing else references them.

Code:
- `packages/video/src/markers/validate.ts`: pure `validateMarkers(input, durationMs)`, `validateChapters(input, durationMs)`, `parseChapterText(text)` (pasted "0:00 Title" lines), `parseClock(text)`.
- `packages/video/src/markers/service.ts` with `MarkerService.get(videoId)`, `getPublished(videoId)` (no viewer argument, so guests and accounts use the same call), `replace(actor, videoId, { markers, chapters })` in one transaction, audit row `video.markers.update` with counts. Export from `packages/video/src/index.ts`.
- `apps/web/src/lib/admin/can.ts`: add `'video.markers': 'editor'`.
- Limits: at most one marker per kind, at most 50 chapters, chapter title 1 to 60 characters, first chapter at 0, chapters at least 5 s apart, markers inside `durationMs`, markers must not overlap, intro and recap at least 3 s long.

Failing tests first (names):
- `packages/video/src/markers/validate.test.ts`: 'accepts an intro that ends after it starts', 'rejects an intro that ends before it starts', 'rejects overlapping markers', 'rejects a marker past the video duration', 'treats credits with no end as ending at the video end', 'rejects an intro shorter than 3 seconds', 'rejects a chapter list that does not start at zero', 'rejects chapters closer than 5 seconds', 'rejects more than 50 chapters', 'trims titles and rejects empty or over 60 character titles', 'parses pasted lines in mm:ss and h:mm:ss', 'rejects 1:99 as a time', 'reports line numbers for bad pasted lines'.
- `packages/video/src/markers/service.int.test.ts`: 'replaces markers and chapters in one transaction', 'rolls back everything when one chapter is invalid', 'writes an audit row with counts', 'refuses a viewer role', 'returns published markers without any viewer', 'deletes markers when the video is deleted', 'does not return markers of an unpublished video through getPublished'.
- `packages/db/src/schema/markers.int.test.ts`: 'rejects an unknown marker kind', 'rejects an end before the start', 'requires an end for intro and recap', 'allows credits without an end', 'allows one marker per kind per video', 'rejects two chapters at the same time', 'rejects a chapter title over 60 characters'.
- `apps/web/src/lib/admin/can.test.ts`: 'lets editors edit markers and denies viewers and unknown roles'.

Worker changes: none.

### L4-02 Player core (markers, chapters, skip action)

Branch `l4/player-core`. Files:
- `packages/player/src/markers.ts`: types `PlayerMarkers { intro?, recap?, credits? }` (seconds, `end: number | null`), `normalizeMarkers(input, duration)`, `activeMarker(markers, time, duration, hasNext)` returning `{ kind, skipTo, nextLesson }` or null.
- `packages/player/src/chapters.ts`: `normalizeChapters`, `chapterAt(chapters, time)`, `chapterTicks(chapters, duration)`.
- `packages/player/src/types.ts`: add `marker: ActiveMarker | null` and `chapter: { index: number; title: string } | null` to `PlayerState`; add optional `onSkip(kind, from, to)` to `PlaybackTelemetry`.
- `packages/player/src/keyboard.ts`: new action `{ type: 'skip' }` on S and s, returned only when `ctx.hasSkip`; `{ type: 'theatre' }` on T only when `ctx.hasTheatre` (used by L4-09). `ShortcutContext` gains `hasSkip` and `hasTheatre`.
- `packages/player/src/controller.ts`: options `markers` and `chapters`; `onTime` updates `state.marker` and `state.chapter` only when they change (no render per tick); `skip()` method; `dispatch` handles `skip`; resume landing inside a window shows the marker at once; a marker the viewer already skipped is not re-offered until they seek back before its start. Export from `index.ts`.

Failing tests first:
- `packages/player/src/markers.test.ts`: 'finds no marker outside every window', 'finds the intro inside its window', 'treats a null credits end as the video end', 'returns the window end as the skip target', 'marks credits as next lesson when a next title exists', 'ignores a marker shorter than 3 seconds', 'drops windows beyond the duration once it is known', 'credits wins over recap when windows touch'.
- `packages/player/src/chapters.test.ts`: 'returns the chapter that contains a time', 'returns null before the first chapter', 'gives tick positions as fractions of the duration', 'drops chapters at or past the duration', 'sorts and removes duplicate starts'.
- `packages/player/src/keyboard.test.ts` (extend): 'maps S to skip only while a skip window is active', 'maps T to theatre only when theatre is available', 'still ignores S from editable targets'.
- `packages/player/src/controller.markers.test.ts`: 'exposes the active marker while the time is inside a window', 'clears the marker when playback leaves the window', 'shows the marker at once when resume lands inside the intro', 'skip seeks to the end of the window and keeps playing', 'skip on credits with a next title plays the next title', 'skip on credits without a next title seeks to the end and shows the end screen', 'does not offer a skipped marker again in the same pass', 'offers it again after seeking back before its start', 'announces the skip button once per window', 'reports a skip to telemetry with kind, from and to', 'does not change state on ticks that stay inside the same window'.

### L4-03 Player UI: Skip button, chapters, help rows

Branch `l4/player-skip-chapters-ui`. Mockups S110 to S113 must be approved first (section 6). Files:
- `packages/player/src/ui/SkipButton.tsx` (new). Bottom right above the control bar, safe area aware, 44 px target, label "Skip intro", "Skip recap", "Skip credits" or "Next lesson" plus a small "S" key hint on desktop only. Rendered before the controls in the DOM so it is first in Tab order after the video (M08-S25 AC3 updated). Fades in with opacity only (200 ms token), stays while the window lasts, hides after 8 s without hover or focus and returns on pointer move or key press, never overlaps the Up Next tile (tile moves up 56 px while the button shows).
- `packages/player/src/ui/SeekBar.tsx`: new props `chapters`, draws a 2 px gap tick at each chapter start (rail segments), tooltip shows chapter title above the time, `aria-valuetext` appends the chapter ("2 minutes 14 seconds of 6 minutes, chapter Mixing colours").
- `packages/player/src/ui/Menus.tsx`: `MenuId` adds `'chapters'`; `ChapterRows` (time, title, current marked); chapters button (list icon in `ui/icons.tsx`) between captions and speed, hidden when there are no chapters, folded into the Settings sheet on compact screens as a "Chapters" section.
- `packages/player/src/ui/PlayerView.tsx`: props `markers`, `chapters`; wires S key, skip button, chapters menu; current chapter title shown next to the time on desktop ("1:42 / 4:30  Mixing colours", ellipsis at 24ch).
- `packages/player/src/keyboard.ts` `SHORTCUT_HELP`: rows `['S'] Skip intro, recap or credits`, `['T'] Theatre mode`.
- `packages/player/src/player.css`: `.adp-skip`, `.adp-seek__tick`, `.adp-chapter` rules, tokens only, `@media (hover: hover) and (pointer: fine)` for hover.
- `packages/shared/src/messages/en-ng.ts`: `player.skip.intro`, `player.skip.recap`, `player.skip.credits`, `player.skip.next`, `player.chapters`, `player.chapter.current`, `player.announce.skipAvailable`. No dashes in copy.

Failing tests first:
- `packages/player/src/ui/SkipButton.test.tsx`: 'shows Skip intro inside the intro window and nothing outside', 'shows the S key hint on desktop only', 'is the first focusable control after the video', 'has a 44 px target', 'shows Next lesson on credits when a next title exists', 'shows Skip credits on credits without a next title', 'hides after 8 seconds without hover or focus and returns on pointer move', 'stays visible while it has focus', 'click seeks to the window end and moves focus to the play button', 'is announced once through the live region', 'has no animation under reduced motion'.
- `packages/player/src/ui/SeekBar.chapters.test.tsx`: 'draws one tick per chapter start', 'draws no ticks without chapters', 'shows the chapter title above the time on hover', 'adds the chapter to aria-valuetext', 'keeps the tooltip inside the bar near the edges with a long title'.
- `packages/player/src/ui/Menus.chapters.test.tsx`: 'lists chapters with times and marks the current one', 'selecting a chapter seeks to its start and closes the menu', 'arrow keys move between chapters and Escape returns focus', 'hides the chapters button when there are none', 'puts chapters in the settings sheet on compact screens'.
- `packages/player/src/ui/ShortcutsDialog.test.tsx` (new, small): 'lists S and T', 'traps focus and closes on Escape'.

### L4-04 Player chrome fixes (scrubber, hover, tokens)

Branch `l4/player-chrome`. Fixes findings F1 to F5 and F14 in section 3. Files: `packages/player/src/player.css`, `packages/player/src/ui/PlayerView.tsx` (Back link in `.adp-top`), `docs/DESIGN-SYSTEM.md` 11.22 (already edited in L4-00).
- `.adp-seek` height from 2rem to `var(--touch-target)` (44 px); rail rests at 5 px and grows to 8 px on hover, drag and focus (transform: scaleY on a fixed 8 px rail so only transform animates; thumb scales with it).
- All `:hover` rules (`.adp-ctl`, `.adp-seek`, `.adp-menu__row`, `.adp-btn--primary`, `.adp-btn--ghost`) wrapped in `@media (hover: hover) and (pointer: fine)`; touch gets the pressed state only.
- Raw `150ms`, `200ms`, `120ms` replaced by motion tokens from `@ad/ui/tokens.css` (`--motion-fast` and siblings; confirm token names when building).
- `.adp-top` shows a Back link (title and Back in full screen and phone landscape per DESIGN-SYSTEM 11.22), using the `links.backHref` already passed through `OverlayLinks`; leaving full screen first, then navigating.

Failing tests first (edit `packages/player/src/ui/PlayerView.chrome.test.tsx`, the touch layout block at the end):
- change 'keeps a 32 px tall hit area on the seek bar' to 'keeps a 44 px tall hit area on the seek bar'.
- add 'rests the rail at 5 px and grows it to 8 px on hover, drag and focus', 'animates the rail with transform only', 'wraps every hover rule in hover and fine pointer', 'uses no raw millisecond durations outside reduced motion', 'shows a Back link in the top bar in full screen and on a phone in landscape', 'leaves full screen before navigating back'.

### L4-05 Web delivery and guest safe wiring

Branch `l4/watch-markers-wiring`. Files:
- `apps/web/src/lib/data/playback.ts`: `WatchData` gains `markers: { intro?, recap?, credits? }` and `chapters: Array<{ startSeconds: number; title: string }>` (both optional in fixtures).
- `apps/web/src/server/data/real-playback.ts`: new private `extrasFor(videoId)` calling `MarkerService.getPublished`, used by both `forStandalone` and `forEpisode` and written so it takes no viewer, so the L1 guest branch calls the same function.
- `apps/web/src/lib/data/playback.fixture.ts` and `features/player/fixture-adapters.ts`: seeded markers and chapters for the demo video.
- `apps/web/src/features/player/WatchClient.tsx`: pass `markers` and `chapters` to `Player`; `Player.tsx` forwards them to the controller and `PlayerView`.
- `packages/analytics/src/events.ts`: new event `player_skip` with `{ videoId, kind, from, to }` (kind enum intro, recap, credits, next); `features/player/telemetry.ts` sends it. Anonymous, same identity rules as the other events.

Failing tests first:
- `apps/web/src/server/data/real-playback.int.test.ts` (extend): 'returns markers and chapters for a published video', 'returns the same markers for a guest viewer', 'returns empty markers for a video with none', 'drops a marker that falls past the duration instead of failing the page'.
- `apps/web/src/features/player/WatchClient.test.tsx` (extend): 'passes markers and chapters to the player', 'renders a Skip intro button when resume lands inside the intro'.
- `apps/web/src/features/player/telemetry.test.ts` (extend): 'sends a player_skip event with kind, from and to'.
- `packages/analytics/src/events.test.ts` (extend): 'accepts a player skip event', 'rejects an unknown skip kind', 'rejects a negative position'.

### L4-06 Admin marker and chapter editor

Branch `l4/admin-markers`. Mockup S119. Route `/admin/videos/[id]/markers` (editor role), linked from the video edit page (S45) by a "Skip and chapters" section card showing a one line summary ("Intro 0:12 to 0:48, credits from 5:10, 6 chapters" or "Not set") and an "Edit" button. Files:
- `apps/web/src/app/admin/(shell)/videos/[id]/markers/page.tsx` and `loading.tsx` (server component, loads the video, markers, chapters, preview session like the existing `/preview` route).
- `apps/web/src/components/admin/MarkerEditor.tsx` (client): the existing admin preview player on top; below it two panels. Markers panel: for Intro, Recap, Credits a row with start and end `mm:ss` inputs, "Use current time" buttons for start and end, nudge buttons minus and plus 1 s, a "Test" button that plays from 3 s before the window, and Clear. Chapters panel: table of time and title with "Add chapter at current time", inline title edit, delete, and "Paste a list" (parses "0:00 Title" lines with a preview of what will be saved and line errors). A "Copy from another episode" select (same series only) copies markers (not chapters) so a series with a fixed intro length takes seconds.
- `apps/web/src/components/admin/VideoEditor.tsx`: summary card and link.
- `apps/web/src/app/admin/(shell)/videos/[id]/markers/actions.ts`: `saveMarkersAction(videoId, payload)` calling `MarkerService.replace`, revalidating `/admin` and the watch path; returns field errors keyed like `updateVideoAction`.
- `apps/web/src/components/admin/PreviewPlayer.tsx`: expose `onReady(controller)` so the editor can read `currentTime` and call `seekTo` (check the current file when building).
- Dirty state guard on leaving, explicit Save button, save error persists as a toast, success toast "Saved. Viewers see this now."
- Chapters and markers apply immediately for published videos (no republish step) and the page revalidates the watch route.

Failing tests first:
- `apps/web/src/components/admin/MarkerEditor.test.tsx`: 'fills the start field from the current player time', 'rejects an end before the start with an inline message', 'blocks overlapping markers', 'warns when credits start before half of the video', 'adds a chapter at the current time and keeps the list sorted', 'refuses a first chapter that is not at zero', 'parses a pasted list and shows line errors', 'copies markers from another episode of the same series', 'test button seeks to 3 seconds before the window', 'asks before leaving with unsaved changes', 'is keyboard operable with visible focus and 44 px targets'.
- `apps/web/src/app/admin/(shell)/videos/[id]/markers/actions.test.ts`: 'saves for an editor', 'returns field errors for invalid input', 'denies a viewer role', 'revalidates the watch path'.
- `apps/web/e2e/admin-markers.e2e.ts`: 'editor sets an intro and a viewer sees Skip intro on the watch page'.

### L4-07 Player settings menu

Branch `l4/player-settings`. Mockups S115 and S116. Goal: one predictable place, like Netflix and YouTube, instead of loose buttons.
- Desktop: keep Captions, a single Settings button replaces separate Speed and Quality buttons. The panel has rows with current value: Speed, Quality, Audio (only when more than one track, L4-13), Autoplay next (switch), Captions appearance (opens a submenu with live preview), Keyboard shortcuts (opens the existing dialog, desktop only). Compact screens already use a bottom sheet and gain the same rows.
- Subtitle languages: the captions menu keeps Off plus languages; adds "Caption settings" footer link to the appearance submenu. The last chosen language is remembered (already stored through `captionLanguage`); default track order is profile language, then English, then first approved.
- Autoplay next switch writes `autoplayNext` through `onPreferencesChange` (already synced to the profile by `serverChanges`), so it is the same flag as `/settings/playback` (M02-S04) and changes the end screen at once.
- Caption appearance: size, background, contrast (existing) plus new `edge` (none, shadow, outline). `CaptionStyle` gains `edge`; `captionStyleVars` adds `--adp-cue-edge`; `normalizeCaptionStyle` defaults old stored values to `shadow`. Persisted through the profile settings (`playbackPrefs` jsonb, no migration) with new key `captionEdge`, and for guests through the device store.
- `apps/web/src/components/account/PlaybackSettings.tsx` gains the Edge row so the two screens agree; `real-account-data.ts` validates and saves `captionEdge`.

Files: `packages/player/src/ui/SettingsMenu.tsx` (new), `ui/CaptionAppearance.tsx` (new), `ui/Menus.tsx`, `ui/PlayerView.tsx`, `captionStyle.ts`, `types.ts` (`captionStyle` becomes controllable: `setCaptionStyle`), `controller.ts` (`setCaptionStyle`, persists), `apps/web/src/features/player/preferences.ts` (guest device store for caption style: key `ad.player.caption.<profileId or guest>`), `WatchClient.tsx`, the two web files above, `player.css`, messages.

Failing tests first:
- `packages/player/src/ui/SettingsMenu.test.tsx`: 'shows speed, quality, autoplay next and caption appearance rows with current values', 'hides the audio row with one track', 'toggling autoplay next updates preferences and the end screen', 'opens the keyboard dialog from its row on desktop only', 'arrow keys, Escape and focus return work in submenus', 'folds into the bottom sheet on compact screens'.
- `packages/player/src/ui/CaptionAppearance.test.tsx`: 'changes size, background, contrast and edge with a live preview', 'preview meets 4.5 to 1 contrast in high contrast', 'reset restores the default', 'announces each change'.
- `packages/player/src/captionStyle.test.ts` (extend): 'accepts edge none, shadow and outline', 'defaults a missing edge to shadow', 'emits the edge variable'.
- `apps/web/src/features/player/preferences.test.ts` (extend): 'keeps the caption style on the device when there is no profile sync', 'ignores corrupt stored style'.
- `apps/web/src/components/account/PlaybackSettings.test.tsx` (extend): 'shows and saves the caption edge'.
- `apps/web/src/server/data/real-account-data.int.test.ts` (extend): 'saves and reads captionEdge', 'rejects an unknown edge'.

### L4-08 Up Next and autoplay polish

Branch `l4/up-next`. Mockup S117.
- Countdown length from site settings (M29) `playerCountdownSeconds`, integer 5 to 10, default 5 (decision L4-D4). `WatchClient` passes `countdownSeconds`; the controller clamps to 5 to 10.
- Credits tile: when a credits marker exists and a next title exists, the Next tile and the "Next lesson" skip button appear at credits start instead of the last 15 s rule; without a marker the 15 s rule stays.
- Ring: use the countdown ring with `stroke-dashoffset` on a 1 s linear step (kept: it is a progress indicator, the documented exception), under reduced motion the ring is static and only the number changes.
- Cancel never navigates; after Cancel the card stays with Play next and Back to series (exists). Add: pressing Escape cancels (any key already cancels), and cancel is announced.
- Standalone titles: `real-playback.ts forStandalone` currently returns `next: null`, so M08-S13 AC4 is not met. Add `bestRelatedNext(detail.related, progress)`: first related title in the same category that is published, kids safe on a kids profile, and not finished by this profile (guests: not finished in local progress, client side filter).
- Still watching: count consecutive autoplays without any pointer, touch or key input in `sessionStorage` key `ad:autoplay-streak`; at 3 the next autoplay shows "Still watching?" with Keep watching and Stop, no countdown (saves data on Nigerian plans). Reset by any input. Raised from Could to Should.
- Data saver: do not prefetch the next video until Play now or the countdown ends (M08-S13 AC5, verify by test).

Files: `packages/player/src/controller.ts`, `ui/EndScreen.tsx`, `ui/Overlays.tsx` (tile offset with skip button), `ui/StillWatching.tsx` (new), `player.css`, `apps/web/src/server/data/real-playback.ts`, `apps/web/src/lib/data/playback.fixture.ts`, site settings schema and form (`apps/web/src/components/admin/site/SiteSettingsView.tsx`, config key in `@ad/config`), `WatchClient.tsx`.

Failing tests first:
- `packages/player/src/controller.upnext.test.ts`: 'uses a countdown of 5 to 10 seconds and clamps other values', 'cancel stops the countdown and keeps the card', 'Escape cancels the countdown', 'shows the Next tile at credits start when a marker exists', 'falls back to the last 15 seconds without a marker', 'does not prefetch the next video under Data saver before Play now', 'asks Still watching after three autoplays without input', 'any input resets the streak', 'Keep watching continues the countdown flow'.
- `packages/player/src/ui/EndScreen.test.tsx` (new): 'shows the ring and the seconds left', 'ring is static under reduced motion', 'shows Play next and Back to series after cancel', 'shows Replay and Back with no next title'.
- `packages/player/src/ui/StillWatching.test.tsx`: 'focuses Keep watching and traps focus', 'Stop returns to the title page'.
- `apps/web/src/server/data/real-playback.int.test.ts` (extend): 'gives a standalone video the best related next title', 'skips finished titles', 'skips titles that are not kids safe on a kids profile', 'gives no next title when none qualifies'.
- `apps/web/src/components/admin/site/SiteSettingsView.test.tsx` (extend): 'saves a countdown between 5 and 10 and rejects 4 and 11'.

### L4-09 Theatre mode

Branch `l4/theatre`. Mockup S114. Desktop only (min width 960 px, fine pointer). Not a player internal: the watch page owns the layout, the player only offers the button and the T key.
- `PlayerView` props `theatre?: boolean`, `onTheatreToggle?: () => void`; button (wide rectangle icon) left of full screen, hidden on compact, in full screen and when `onTheatreToggle` is absent (so the admin preview opts out).
- `WatchClient` owns state, device level persistence in `localStorage` key `ad.player.theatre` (a layout choice about this screen, like volume), sets `data-theatre` on the watch layout.
- `apps/web/src/features/player/watch.css`: in theatre the player spans the viewport width up to 100vw with `max-height: 80vh` and keeps 16:9 via letterbox, the Up next column moves below the title, the page stays scrollable; transition on transform and opacity only, none under reduced motion.
- Layout shift: the 16:9 box is reserved before hydration using the stored value read in a blocking inline attribute-free way (class set server side is not possible, so reserve the default box and animate the switch once).

Failing tests first:
- `packages/player/src/ui/PlayerView.theatre.test.tsx`: 'shows the theatre button on desktop only', 'hides it in full screen and without a handler', 'T toggles theatre', 'button reflects state with aria-pressed and a label that says Exit theatre mode'.
- `apps/web/src/features/player/WatchClient.test.tsx` (extend): 'remembers theatre mode on this device', 'sets data-theatre on the layout', 'ignores a corrupt stored value'.
- `apps/web/src/features/player/watch.css.test.ts` (new): 'theatre rules use tokens and no hover only effects', 'theatre applies only from 960 px'.

### L4-10 Picture in picture fix and AirPlay

Branch `l4/pip-airplay`. Mockup S114 (AirPlay connected overlay).
PiP gaps (F10): iOS Safari lacks `document.pictureInPictureEnabled` but supports `video.webkitSetPresentationMode('picture-in-picture')`; the button has no pressed state; `enterpictureinpicture` and `leavepictureinpicture` are not observed, so the surface shows a blank player with no explanation. Fix: feature check covers both APIs, button `aria-pressed`, while in PiP the surface shows "Playing in a small window. Bring it back" with a button, captions stay on, end screen still shows.
AirPlay:
- `packages/player/src/airplay.ts` (pure helpers plus a thin browser adapter): `airplaySupported(video)`, `watchAirplayAvailability(video, cb)` using `webkitplaybacktargetavailabilitychanged`, `showAirplayPicker(video)` calling `webkitShowPlaybackTargetPicker`, `wirelessActive(video)` from `webkitcurrentplaybacktargetiswirelesschanged`.
- Engine rule: hls.js video elements cannot be sent to a receiver. When the viewer opens the picker on a Safari that supports native HLS, the controller reloads the video through the native engine at the current time (token as `?pt=`), then shows the picker. A site level setting is not needed. The quality menu hides while the native engine is active (existing behaviour) and returns when casting stops and the viewer taps Play (we do not auto switch back mid playback).
- The button shows only when a target is available (Safari reports this). While wireless: surface text "Playing on AirPlay", controls stay, quality and captions follow device behaviour.
- Spike first (first commit of the slice, documented in the PR): run on a real iPhone and a Mac with an Apple TV, record whether Safari's MSE path can AirPlay with the `<source>` fallback; if it can, drop the engine switch and keep hls.js (smaller change). This needs a physical device, so it is the one part of the plan that cannot be proven in CI.
- Guests: token TTL note from 1.2.

Failing tests first:
- `packages/player/src/airplay.test.ts`: 'is unsupported without the webkit picker method', 'reports availability from the webkit event', 'hides the button when no target is available', 'calls the picker with the video element', 'tracks wireless playback state'.
- `packages/player/src/controller.airplay.test.ts`: 'switches to the native engine at the current time before showing the picker', 'keeps the position and play state through the switch', 'does not switch when the engine is already native', 'shows an error toast when the switch fails and keeps playing locally'.
- `packages/player/src/ui/PlayerView.pip.test.tsx`: 'shows the PiP button when only the webkit API exists', 'sets aria-pressed while in picture in picture', 'shows the in a small window message and a Bring back button', 'hides the button where neither API exists', 'shows a toast when PiP is denied'.
- `packages/player/src/ui/PlayerView.airplay.test.tsx`: 'shows the AirPlay button only when a target is available', 'shows Playing on AirPlay while wireless', 'is reachable in Tab order before full screen'.

### L4-11 Low bandwidth and error states

Branch `l4/lowdata-errors`. Mockup S118. Mostly verification and small additions:
- Start quality: verified `pickStartHeight` starts on 360p under `lowData` and 480p otherwise, with the ABR seed from the last session. Add tests that prove `detectLowData` covers `saveData`, `effectiveType` 2g and 3g and `downlink` under 1.5 (check the existing function and extend the list if a case is missing). M08-S01 AC4 wording stays.
- Rebuffer messages: after the existing 500 ms spinner and 8 s "Slow connection. Switching to lower quality" (Auto only), add: when the viewer has locked a quality and stalls for 8 s, show "Slow connection. Try Auto or a lower quality" with an inline button that opens the quality menu. After two stalls within 60 s on Auto while Data saver is off, show a once per video persistent hint "Videos load slowly right now. Turn on Data saver to use less data" with a Turn on button (sets `dataSaver` for the profile through `onPreferencesChange`) and Dismiss. Never blames the user, one sentence, one action.
- Error states: audit the six `ErrorOverlay` messages against the copy rules (no dashes, no blame, one action) and add the missing reference code line on `connection-lost` after 3 consecutive retries. Add a distinct `markers`-free path: marker, chapter or caption failures never surface an overlay (silent or toast).
- Verify no marker or chapter fetch happens separately (they arrive with the page), so there is no extra request on a slow network.
- Edge case: skip button under a stalled player still works (seek during buffering shows spinner, position kept).

Failing tests first:
- `packages/player/src/controller.lowdata.test.ts`: 'starts on 360p under Save-Data', 'starts on 360p on 2g and 3g effective types', 'starts on 480p on a fast connection', 'shows the locked quality hint after 8 seconds of stall', 'suggests Data saver after two stalls in 60 seconds on Auto', 'suggests Data saver only once per video', 'does not suggest when Data saver is already on', 'Turn on sets the preference and caps to 360p', 'seek during a stall keeps the position'.
- `packages/player/src/ui/Overlays.test.tsx` (new): 'each error shows one title, one sentence and one action', 'shows the reference code on cannot play', 'copy has no dashes'.
- `apps/web/e2e/watch-3g.e2e.ts` (Playwright with throttling per the existing `picker-cache-3g.e2e.ts`): 'starts within 8 seconds on slow 3G', 'starts on the lowest rung', 'shows the slow notice, never a blank screen'.

### L4-12 Verification pass (no new features)

Branch `l4/player-verify`. Runs and, where a gap shows, adds the missing test:
- Seek preview: `ui/SeekBar.test.tsx` (six tests exist). Add 'tooltip stays above the controls in full screen', 'sprite with a 404 shows only the time', and a Playwright check in `apps/web/e2e/watch.e2e.ts` ('hovering the seek bar shows a preview image when a sprite exists').
- Mobile gestures: `gestures.test.ts` covers thirds, accumulation and centre toggle. Add `ui/PlayerView.gestures.test.tsx`: 'single tap shows then hides controls', 'double tap right third seeks 10 and shows the ripple label', 'taps on the Skip button do not trigger a surface double tap', 'taps on controls never seek'. Real device pass on a low end Android in Lagos is a manual checklist item in the PR.
- Touch targets: extend `apps/web/e2e/touch-targets.e2e.ts` with the Skip button, chapters button, settings button, theatre and AirPlay buttons (44 by 44) and the 44 px seek bar.
- A11y: extend `apps/web/e2e/a11y.e2e.ts` for the watch page with skip window visible, chapters menu open, settings menu open (axe, no serious violations), Tab order matches M08-S25 AC3 as updated.
- Controls fade: the existing three second tests stay; add 'Skip button and chapters menu keep controls visible'.
- Run `scripts/footprint-check.sh`, design skill review of the whole player against sections 3 and 5 below, write `docs/lanes/L4-player.md`.

### L4-13 Audio track menu (Could)

Branch `l4/audio-menu`. Build only if the owner confirms alternate audio exists (question 1). Player side only; it is small and safe to ship dormant because it shows nothing with one track.
- `engine.ts`: `EngineEvent` adds `{ type: 'audio-tracks'; tracks: Array<{ id: string; label: string; language: string }>; active: string }`; `PlayerEngine` adds `setAudioTrack(id)`; `hlsEngine.ts` maps hls.js `audioTracks` and `audioTrackController`.
- `PlayerState.audio: { tracks, active }`; controller `selectAudio(id)` keeps position, persists `audioLanguage` on the device (not the profile).
- Menu row "Audio" inside Settings (L4-07), hidden for fewer than two tracks. Never shown for the native engine unless the browser exposes `audioTracks`.
Failing tests: `packages/player/src/hlsEngine.audio.test.ts` 'maps hls.js audio tracks to engine events', 'switches the track without changing position'; `packages/player/src/controller.audio.test.ts` 'exposes tracks and the active one', 'selecting a track calls the engine and announces it', 'remembers the language on this device and prefers it next time', 'shows nothing with one track'; `ui/SettingsMenu.test.tsx` 'shows the audio row with two tracks' (added in L4-07, skipped until this slice).

### L4-14 Audio track encode support (Could, larger, separate decision)

Today every rendition muxes one AAC track (`0:a:0` in `encodeRungArgs`, `codecsFor` adds `mp4a.40.2`, `buildMasterTemplate` has no `EXT-X-MEDIA`). Multiple audio tracks need demuxed audio renditions, which changes the pipeline, the master playlist, the edge allowlist and storage, so it is a project of its own and stays Could until content exists.
Design when approved:
- Migration `NNNN_audio_tracks.sql`: `audio_tracks (id, video_id fk cascade, language, label, default boolean, kbps, status, segment_count, created_at)`, unique `(video_id, language)`.
- `packages/video/src/probe.ts`: return all audio streams with language tags; `encode/ffmpeg.ts`: `encodeAudioTrackArgs` (one AAC 96 kbps HLS rendition per track, same key and IV rules as video, `-map 0:a:N`); video rungs drop audio when alternates exist (`-an`) and `codecsFor` omits audio from the video CODECS when audio is demuxed.
- `packages/video/src/playlist.ts`: `buildMasterTemplate` writes `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME,LANGUAGE,DEFAULT,AUTOSELECT,URI="audio-<lang>.m3u8"` and `AUDIO="aud"` on each `STREAM-INF`; `rewriteMaster` and `VARIANT_LINE` accept `audio-xx.m3u8` and the `URI="..."` attribute form; `apps/edge/src/handler.ts` allowlist adds `audio-*.m3u8` and its segments; `apps/web` play route serves them under the same token rules.
- `packages/video/src/encode/pipeline.ts`: one extra encode step per track (worker job `video.encode_audio`), counted in progress, failure of one alternate does not fail the video; admin upload lets an editor attach extra audio files on the video page (S45).
- Existing videos stay single track with no re-encode.
Failing tests (when built): `playlist.test.ts` 'writes EXT-X-MEDIA for each audio track and links the variants', 'keeps single track masters byte identical', 'rewrites audio playlist uris with the token query'; `ffmpeg.test.ts` 'maps the nth audio stream to its own rendition', 'drops audio from video rungs when alternates exist'; `probe.test.ts` 'returns every audio stream with language'; `pipeline.int.test.ts` 'encodes alternate audio and publishes a master with media entries', 'a failed alternate does not fail the video'; edge `handler.test.ts` 'serves audio playlists and rejects unknown names'.

### L4-15 Chromecast sender (Could, spec only)

Not built in this program (decision L4-D8). Spec for later: lazy load of the Cast sender script only after the viewer taps a Cast button (never on page load), CSP `script-src` gets `https://www.gstatic.com` for that route only, a registered styled media receiver app id as a client input in `CLIENT-INPUTS.md`, a `?pt=` token query on the master and key URLs with TTL matching the cast session, CORS headers from the edge for `*.googleusercontent.com` style receiver origins (verify), sender state mapped to the same `wireless` state as AirPlay so the UI is shared. Tests then: `cast.test.ts` 'loads the SDK only after the first tap', 'maps session state to the wireless state', 'sends the current position and resumes locally on disconnect'.

### L4-16 Marker suggestions (Could)

Worker job `video.suggest_markers` after encoding (`apps/worker/src/handlers.ts`, `packages/video/src/encode/suggest.ts`): ffmpeg `blackdetect` and `silencedetect` on the last 20 percent to suggest a credits start, with no new table: suggestions are returned to the editor only (kept in the job result). Admin sees "Suggested: credits at 5:08" with Accept. Intro detection is not attempted (needs audio fingerprinting across episodes). Tests: `suggest.test.ts` 'finds a black frame run near the end', 'returns nothing when no black frames exist', 'never suggests before half the video'; `handlers.test.ts` 'does not fail the video when detection fails'.

## 3. UI review of the current player (against audit sections 2 and 3, DESIGN-SYSTEM 11.22, 13, and the design skill)

Reviewed: `packages/player/src/player.css`, `ui/PlayerView.tsx`, `ui/SeekBar.tsx`, `ui/Menus.tsx`, `ui/EndScreen.tsx`, `ui/Overlays.tsx`, `Player.tsx`, `apps/web/src/features/player/*`, `apps/web/src/server/data/real-playback.ts`. Method: code and tests read, greps from the skill on `player.css`. Nothing was run in a browser (planning pass); S110 to S119 and the L4-12 manual pass cover the visual check.

Passing: no hardcoded hex or `rgb` in `player.css` (all colours via tokens); reduced motion block kills animation and transition inside `.adp`; forced colours handled; safe area insets on controls, top bar and sheets; every `.adp-ctl` uses the 44 px token; icon only buttons have `aria-label`; menus use `role="menu"`, arrow keys, Escape, focus return; live region present; poster fallback; `aria-valuetext` on the seek slider; captions toggle `aria-pressed`; volume hidden without audio; focus ring present (7 `outline` rules, none `none` without replacement); cursor hides with controls; controls never hide while paused, focused or menu open.

Findings:

| Id | Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- | --- |
| F1 | High | Seek bar hit area is 32 px; DESIGN-SYSTEM 11.22 and the audit require 44 px. The test and M08-S09 edge case encode the old 32 px. | `.adp-seek { height: 2rem }`, `PlayerView.chrome.test.tsx` 'keeps a 32 px tall hit area' | L4-04 test and CSS, story edit in section 4 |
| F2 | Medium | Rail rests at 4 px, the brief and audit say 5 px growing to 8 px. Height animation, not transform. | `.adp-seek__rail { height: 4px; transition: height 120ms }` | L4-04 (scaleY on a fixed rail) |
| F3 | High | No hover rule is wrapped in `@media (hover: hover)`; touch devices get sticky hover on controls, menu rows and buttons. | `grep -c "hover: hover" player.css` is 0; five `:hover` rules | L4-04 |
| F4 | Medium | Raw durations (120, 150, 200 ms) instead of motion tokens; skill says durations are tokens. | `player.css` lines 63, 91, 115, 223 | L4-04 |
| F5 | Low | Countdown ring animates `stroke-dashoffset`. Acceptable as a progress indicator; keep and note the exception in DESIGN-SYSTEM 11.23. Static under reduced motion already. | `player.css` line 764 | L4-08 doc note |
| F6 | Medium | Countdown fixed at 5 s with no setting; audit asks 5 to 10 s cancellable. | `controller.ts` `countdownSeconds ?? 5`, no web wiring | L4-08 |
| F7 | Medium | Caption appearance (size, background, contrast) can only be changed at `/settings/playback`, not in the player; no edge style option. | `PlaybackSettings.tsx`, `Menus.tsx` | L4-07 |
| F8 | Medium | Settings are scattered: separate Speed and Quality buttons on desktop, a Settings sheet on mobile that lacks autoplay and captions appearance. | `PlayerView.tsx` lines 575 to 675 | L4-07 |
| F9 | Medium | Keyboard help opens only by pressing question mark; no visible entry point; no S, T rows. | `onKeyDown` `help` action, `SHORTCUT_HELP` | L4-03 rows, L4-07 entry |
| F10 | Medium | PiP hidden on iOS Safari (uses `document.pictureInPictureEnabled` only), no pressed state, no `enterpictureinpicture` and `leavepictureinpicture` handling, surface is empty while in PiP. | `PlayerView.tsx` lines 127 and 155 | L4-10 |
| F11 | High | M08-S13 AC4 is not met: standalone titles get `next: null` in the real service, so no Up Next after a standalone video. | `real-playback.ts forStandalone` returns `next: null` | L4-08 |
| F12 | Medium | DESIGN-SYSTEM 11.22 says the top bar has title and Back in full screen and phone landscape; the code renders title only. | `.adp-top` in `PlayerView.tsx` | L4-04 |
| F13 | Medium | A locked quality that stalls gets only a spinner (the slow notice runs only on Auto), and repeated stalls on Auto give no way to save data. | `controller.onWaiting` returns early when `selected !== 'auto'` | L4-11 |
| F14 | Low | Any key press cancels the autoplay countdown, including volume keys. Intentional and kept, but must be documented in M08-S13 AC2. | `onKeyDown` | story edit |
| F15 | Low | `DEFAULT_PREFERENCES.autoplayNext` is false while the server default and DB column are true. Real data wins, fixtures show false. Align the fixture and the player default to true to avoid surprises in demos. | `types.ts`, `real-account-data.ts` | L4-08 (one line plus test) |
| F16 | Low | Tab order must put the new Skip button right after the video; M08-S25 AC3 lists the old order only. | story text | L4-03, story edit |
| F17 | Info | Mobile gestures: double tap thirds, accumulation, centre toggle all tested. No swipe volume or brightness (skipped on purpose, L4-D12). | `gestures.ts` | L4-12 verifies |
| F18 | Info | Seek preview verified by six tests, lazy and Data saver safe. | `SeekBar.test.tsx` | L4-12 adds two edges |

## 4. User stories

Module row for `docs/MODULES.md`: `| M43 | Player features: skip, chapters, player settings, theatre, cast | Viewer and Admin | [READY] |`. Dependencies: M08, M16, M11, M02, M29, M31, M35, M36.

### 4.1 New section (append to `docs/USER-STORIES.md` after M36, before the final rule)

```
## M43 Player features

### M43-S01 Skip intro (Must)
As a viewer, I want to jump past the opening of a lesson, so that I get to the content without waiting.
- AC1: Given the video has an intro marker, When playback is inside the intro window, Then a "Skip intro" button shows at the bottom right above the controls.
- AC2: Given the button shows, When I click it, tap it, or press S, Then playback seeks to the end of the window and keeps playing.
- AC3: Given I resume or seek into the intro window, When playback is inside it, Then the button shows at once.
- AC4: Given the window ends or I skip, When it passes, Then the button is gone and does not return unless I seek back before the start.
- AC5: Given no input, When 8 seconds pass with the button showing and no pointer over or focus on it, Then it fades out, and it returns on pointer move or key press while the window lasts.
- AC6: Given a screen reader, When the window opens, Then the live region says "Skip intro available" once.
- Edge: a video with no marker never shows the button and the S key does nothing.
- Error: a failed marker load leaves normal playback untouched.
- Empty: not applicable.

### M43-S02 Skip credits and next lesson (Must)
As a viewer, I want to leave the end credits quickly, so that I move on to the next lesson or finish.
- AC1: Given a credits marker and a next title, When the credits window starts, Then the button reads "Next lesson" and the Up next tile shows, and pressing it (or S) plays the next title.
- AC2: Given a credits marker and no next title, When the window starts, Then the button reads "Skip credits" and pressing it seeks to the end and shows the end screen.
- AC3: Given a credits marker with no end time, When saved, Then the window runs to the end of the video.
- Edge: with Autoplay next on, finishing the credits still runs the countdown (M08-S13).
- Error: not applicable.
- Empty: not applicable.

### M43-S03 Skip recap (Could)
As a viewer of a series, I want to skip the recap of the last lesson, so that I do not hear it twice.
- AC1: Given a recap marker, When playback is inside its window, Then the button reads "Skip recap" with the same behaviour as M43-S01.
- Edge: an episode can have a recap and an intro, shown one after the other.
- Error: not applicable.
- Empty: not applicable.

### M43-S04 Admin sets skip markers (Must)
As an admin, I want to set where the intro, recap and credits are, so that viewers get a Skip button at the right moment.
- AC1: Given the video page, When I open "Skip and chapters", Then I see the video with Intro, Recap and Credits rows, each with start and end times.
- AC2: Given the video is playing in the editor, When I press "Use current time" on a start or end field, Then the field takes the player time.
- AC3: Given a bad entry (end before start, overlap, past the end, intro under 3 seconds), When I save, Then an inline message says what to fix and nothing is saved.
- AC4: Given I press Test on a row, When pressed, Then playback starts 3 seconds before the window.
- AC5: Given I save a published video, When saved, Then viewers get the markers on their next page load with no republish.
- AC6: Given a series, When I choose "Copy from another episode", Then the markers (not chapters) of that episode fill the rows for review.
- Edge: credits starting before half of the video show a warning, not an error.
- Error: a failed save keeps my edits and shows a persistent error toast.
- Empty: with no markers the video page summary says "Not set".

### M43-S05 Chapters on the seek bar and a chapters menu (Should)
As a viewer, I want to see the sections of a lesson and jump to one, so that I can find the part I need.
- AC1: Given the video has chapters, When the seek bar shows, Then a small gap marks each chapter start.
- AC2: Given I hover or drag the bar, When over a chapter, Then the tooltip shows the chapter title above the time.
- AC3: Given I open the Chapters menu, When it shows, Then I see each chapter with its start time and the current one marked, and choosing one seeks to its start.
- AC4: Given a phone, When I open Settings, Then Chapters is a section of the bottom sheet.
- AC5: Given a screen reader, When I focus the seek bar, Then the value text includes the chapter title.
- Edge: a video without chapters shows no gaps, no button and no tooltip title.
- Error: not applicable.
- Empty: not applicable.

### M43-S06 Admin edits chapters (Should)
As an admin, I want to name the sections of a lesson, so that viewers can navigate it.
- AC1: Given the editor, When I press "Add chapter at current time", Then a row with that time appears and the list stays sorted.
- AC2: Given the first chapter, When it is not at 0:00, Then saving is refused with "The first chapter must start at 0:00".
- AC3: Given chapters, When two are closer than 5 seconds or a title is empty or over 60 characters, Then saving is refused with the row marked.
- AC4: Given I paste lines like "0:00 Welcome", When I press Parse, Then a preview and line errors show before anything is saved.
- Edge: at most 50 chapters.
- Error: as M43-S04.
- Empty: with no chapters the list shows "No chapters yet. Add one at the current time."

### M43-S07 Audio track selector (Could)
As a viewer, I want to pick another spoken language when a video has one, so that I can follow in the language I know best.
- AC1: Given a video with two or more audio tracks, When I open Settings, Then an Audio row lists them and choosing one switches without losing my place.
- AC2: Given a video with one audio track, When I look at Settings, Then no Audio row shows.
- AC3: Given I chose a language, When I open another video, Then that language is preferred when it exists (this device only).
- Edge: tracks that fail to load fall back to the default track with a toast.
- Error: switch failure keeps the current track and shows "Audio could not change".
- Empty: see AC2.

### M43-S08 Theatre mode (Should)
As a desktop viewer, I want a wider player, so that I can see more without full screen.
- AC1: Given a desktop at 960 px or wider, When I press the theatre button or T, Then the player widens to the full page width (at most 80 percent of the screen height) and the Up next list moves below.
- AC2: Given I turn it on, When I reload or open another video, Then theatre mode is remembered on this device.
- AC3: Given a phone or tablet in portrait, When I look at the controls, Then there is no theatre button.
- Edge: leaving full screen returns to the previous layout.
- Error: not applicable.
- Empty: not applicable.

### M43-S09 AirPlay (Should)
As a Safari viewer, I want to send the lesson to an Apple TV or speaker, so that a group can watch.
- AC1: Given Safari reports an AirPlay target, When controls show, Then an AirPlay button shows, and with no target it is hidden.
- AC2: Given I pick a device, When playback moves, Then the position is kept and the player says "Playing on AirPlay".
- AC3: Given a guest with a short playback token, When casting, Then a note says casting can stop after about 15 minutes and offers Sign in.
- Edge: if switching to the AirPlay capable stream fails, playback stays on this device with a toast.
- Error: "Could not connect to that device".
- Empty: not applicable.

### M43-S10 Chromecast (Could)
As a Chrome viewer, I want to cast to a TV, so that I can watch on a big screen.
- AC1: Given the Cast sender is enabled and a device is found, When I tap Cast, Then playback continues on the device from the same position.
- AC2: Given I never tap Cast, When the page loads, Then no Google script loads.
- Edge: until built, the Help page says to use Cast from the Chrome menu.
- Error: as M43-S09.
- Empty: not applicable.

### M43-S11 Player settings menu (Should)
As a viewer, I want one settings menu in the player, so that I find speed, quality, captions and autoplay in one place.
- AC1: Given the player, When I open Settings, Then I see rows with current values: Speed, Quality, Audio (when relevant), Autoplay next, Caption appearance and Keyboard shortcuts (desktop).
- AC2: Given I switch Autoplay next, When toggled, Then it saves for this profile (the same setting as M02-S04) and the end screen follows at once.
- AC3: Given a phone, When I open Settings, Then it is a bottom sheet with the same rows.
- AC4: Given a kids profile, When I open Settings, Then only parent-approved rows show.
- Edge: a guest's choices stay on this device.
- Error: a failed save rolls the switch back with a toast.
- Empty: not applicable.

### M43-S12 Caption appearance in the player (Should)
As a viewer who reads captions, I want to change how they look while watching, so that I can read them comfortably.
- AC1: Given captions are available, When I open Caption appearance, Then I can change size, background, contrast and edge (none, shadow, outline) with a live preview on the video.
- AC2: Given I change an option, When selected, Then it applies at once, saves for the profile and shows in `/settings/playback`.
- AC3: Given high contrast, When previewed, Then the text and background meet 4.5 to 1.
- AC4: Given Reset, When pressed, Then the readable default returns.
- Edge: guests keep the choice on this device.
- Error: a failed save keeps the local look and shows a toast.
- Empty: with no caption track the entry is hidden.

### M43-S13 Up next countdown setting and credits tile (Should)
As an admin, I want to set how long the Up next countdown runs, so that it fits our viewers.
- AC1: Given Site settings, When I set the countdown to a whole number from 5 to 10, Then the end screen uses it.
- AC2: Given a value outside 5 to 10, When I save, Then it is refused with the allowed range.
- AC3: Given a credits marker and a next title, When the credits start, Then the Up next tile shows then instead of 15 seconds before the end.
- Edge: reduced motion shows the number without the ring animation.
- Error: not applicable.
- Empty: not applicable.

### M43-S14 Still watching check (Should)
As a viewer on a data plan, I want autoplay to stop when I am not there, so that data is not wasted.
- AC1: Given three episodes autoplayed with no tap, key or pointer input, When the third ends, Then "Still watching?" shows with Keep watching and Stop and no countdown.
- AC2: Given any input at any time, When it happens, Then the count resets.
- AC3: Given Stop, When pressed, Then I go to the series page.
- Edge: the count lives for the tab session only.
- Error: not applicable.
- Empty: not applicable.

### M43-S15 Slow network help in the player (Should)
As a viewer on a weak connection, I want a clear way to use less data, so that I keep watching.
- AC1: Given quality is locked and playback stalls for 8 seconds, When the notice shows, Then it says "Slow connection. Try Auto or a lower quality" with a button that opens the quality menu.
- AC2: Given Auto and two stalls within 60 seconds with Data saver off, When the second stall begins, Then a hint offers "Turn on Data saver" once per video.
- AC3: Given I turn it on, When pressed, Then quality is capped at 360p and the setting saves for the profile.
- Edge: no hint when Data saver is already on.
- Error: failure to save shows a toast and the cap still applies for this video.
- Empty: not applicable.

### M43-S16 Marker suggestions (Could)
As an admin, I want a suggested credits start, so that I set markers faster.
- AC1: Given a finished encode, When I open the editor, Then a suggestion such as "Credits at 5:08" shows with Accept.
- AC2: Given no black frames near the end, When I open the editor, Then no suggestion shows.
- Edge: suggestions never fill a field without Accept.
- Error: detection failure is silent.
- Empty: not applicable.

### M43-S17 Player features for guests and accounts alike (Must)
As a visitor without an account, I want skip, chapters, theatre and settings to work, so that watching is the same for everyone.
- AC1: Given a guest playback session, When the page loads, Then markers and chapters arrive with the page exactly as for accounts.
- AC2: Given a guest, When I change Autoplay next, caption appearance, theatre or speed, Then it is kept on this device only, with no sign in wall.
- AC3: Given a guest, When I open the Settings menu, Then rows that need an account (none today) show a "Sign in to save" note instead of failing.
- Edge: signing in later imports nothing automatically except what M01-S13 and the guest progress import already cover.
- Error: not applicable.
- Empty: not applicable.
```

### 4.2 Exact edits to existing stories (apply in L4-00)

M02-S04 (line 179 to 186):
- Title unchanged. Replace the opening sentence with: "As a viewer, I want to set autoplay next, autoplay previews, data saver, default captions, caption appearance and speed memory for each profile, so that each person gets their own habits."
- Add after AC3: "AC4: Given I change caption size, background, contrast or edge in the player (M43-S12) or here, When saved, Then both places show the same choice."

M08-S01:
- AC4 replace with: "Given Save-Data is on or the connection reports 2G or 3G, When playback starts, Then the first rendition is the 360p (start low, then adapt up); otherwise the 480p."
- Add Edge: "Guests start the same way (see M43-S17)."

M08-S03:
- AC2 unchanged. AC3 replace with: "Given I hover or drag, When over the bar, Then a time tooltip shows, a preview image when sprites exist, and the chapter title when chapters exist (M43-S05)."
- Add AC5: "Given chapters exist, When the bar shows, Then each chapter start is marked with a gap in the rail."

M08-S07:
- AC1 add at the end: "The scrubber rests at 5 px and grows to 8 px on hover, drag or focus."

M08-S08:
- AC1: append "; S skip intro, recap or credits while a Skip button shows (M43-S01); T theatre mode on desktop (M43-S08)." (replace the final period).
- AC2: append "The dialog is also reachable from the Settings menu on desktop."

M08-S09:
- Edge replace with: "Edge: one handed use does not need precise taps on a thin seek bar (touch area is extended vertically to 44 px)."

M08-S12:
- AC2 replace "(phase 2)" with nothing: "Given the menu has languages, When I choose one, Then the track switches immediately."
- Add AC4: "Given captions are available, When I open Caption settings in the menu, Then I can change size, background, contrast and edge with a live preview (M43-S12)."

M08-S13:
- AC1 replace "a 5 second countdown" with "a countdown of 5 to 10 seconds (site setting, default 5, M43-S13)".
- AC2 append: "Pressing Escape or any other key also cancels it."
- Edge replace with: "Edge: after 3 consecutive autoplayed episodes with no input, show "Still watching?" instead of the countdown (Should, M43-S14)."
- Priority line unchanged (Must).

M08-S14:
- AC1 replace with: "Given the remaining time is 15 seconds or less, or a credits marker has started, whichever comes first, When the video plays, Then a small "Next: <title>" tile slides in at the bottom right and can be dismissed. While a Skip button shows, the tile sits above it."

M08-S17:
- AC1 append: "On a locked quality the text is "Slow connection. Try Auto or a lower quality" with a button that opens the quality menu (M43-S15)."

M08-S19:
- AC1 replace with: "Given PiP is supported (including iOS Safari presentation mode), When I tap the PiP button, Then the video floats, the button shows as pressed, controls remain, and the player surface says it is playing in a small window with a Bring back button."

M08-S25:
- AC3 replace the order with: "Given Tab order, When I tab, Then it flows Skip button (when showing), play, seek, time, volume, chapters, captions, settings, picture in picture, AirPlay, theatre, full screen with a visible focus ring."

M08-S26:
- AC1 append: "On desktop theatre mode (M43-S08) widens the player and moves Up next below."

M08-S27 to S31: no change.

Edits owned by lane L1 (guest) that this lane relies on, not repeated here: M08-S01 AC2 and S16 (guest progress), M01-S13, M07-S06. Do not edit those lines in L4-00 to avoid merge conflicts; re-read them after L1 merges.

## 5. Interfaces with the guest lane (L1) and other lanes

| Interface | This lane's rule | What L1 must keep |
| --- | --- | --- |
| `getWatchData(videoId, viewer)` | Markers and chapters come from `extrasFor(videoId)`, no viewer argument, called on both branches | The guest branch calls `extrasFor` and returns the same shape |
| `SessionProvider` and `PlaybackSession` in `packages/player/src/token.ts` | Unchanged; AirPlay reuses the current token as `?pt=` | A guest token still carries the same fields the player reads (`token`, expiry); the TTL for guests (15 to 20 min) is the AirPlay limit |
| `PlayerPreferences` and `loadPreferences` (`features/player/preferences.ts`) | New device level keys: `captionStyle`, theatre, audio language, autoplay streak (sessionStorage) | `prefsSync` is undefined for guests, so `onPreferencesChange` must still save locally; guests use profile id `guest` in the storage key |
| `ViewerContext` in `lib/data/playback.ts` | Not touched | L1 turns it into a union; this lane only reads `kids` and `profileId` through `WatchClient` props, so its code needs no change beyond types |
| `progressTransport` | Skip, chapters and theatre are independent of it | `local` mode must keep working with the new Skip seek (seek triggers the same progress write) |
| Analytics identity | `player_skip` carries no identity | Daily hash id rules unchanged |
| Admin routes `/admin/videos/[id]/markers` | Editor role, under existing admin guard | None |
| Site settings | New key `playerCountdownSeconds` | Do not rename the settings table or form while L4-08 is open |

Rebase order if both lanes open PRs: L1 first for `real-playback.ts` and `WatchClient.tsx`, then L4-05 and L4-08 rebase onto it. L4-05 keeps its `real-playback.ts` change to one new private method and two call lines to keep conflicts small.

## 6. Mockups (S110 to S119)

Files go in the mockup folder with the existing naming (`S110_player_skip.dc.html`, mobile variants end in `_m`), copying player chrome, tokens and copy from `S23_player_menus`, `S24_player_states`, `S25_end_screen`, `S26_shortcuts` and `S45_video_edit`. Each file shows default, hover (desktop), focus, active, disabled, loading and error states where they apply, plus reduced motion notes. No emojis, no dashes in copy.

| No. | Screen | Content |
| --- | --- | --- |
| S110 | Skip buttons, desktop | Skip intro entering, hover, focus with S hint, fading out; Next lesson on credits with Up next tile above it; Skip recap; no marker state |
| S111 | Skip buttons, mobile (`S111_player_skip_m`) | Portrait and landscape; 44 px button above the control row; safe area; tile offset |
| S112 | Chapters, desktop | Seek bar with gaps, hover tooltip with chapter title and preview, chapters menu popover, current chapter label by the time, long title ellipsis |
| S113 | Chapters, mobile (`S113_player_chapters_m`) | Bottom sheet section in Settings, scrubber 5 px rest, 8 px active, 44 px hit area drawn with the zone outlined |
| S114 | Layout and cast states, desktop | Default layout vs theatre mode with Up next below, theatre button states, AirPlay button, "Playing on AirPlay" overlay, "Playing in a small window" PiP overlay, guest cast note |
| S115 | Player settings menu, desktop | Rows with values, Audio row (hidden with one track, shown with two), Autoplay next switch, Caption appearance submenu with live preview and Reset, Keyboard shortcuts row, updated shortcuts dialog with S and T |
| S116 | Player settings, mobile (`S116_player_settings_m`) | Bottom sheet with the same rows, caption appearance sheet, kids profile reduced rows |
| S117 | Up next | Countdown ring at 5 and at 10 seconds, Cancel then Play next and Back to series, credits Next lesson state, Still watching dialog; desktop and mobile side by side, reduced motion variant |
| S118 | Low bandwidth and error states | Spinner, slow connection notice on Auto, locked quality notice with Open quality button, Data saver hint, offline, connection lost with reference, cannot play, removed; desktop and mobile |
| S119 | Admin skip and chapters editor | Video page summary card (S45 addition), editor page with player, three marker rows with Use current time, nudge, Test, Clear, validation errors, credits warning, chapters table, paste dialog with line errors, copy from another episode, save bar, dirty guard; desktop with a stacked mobile frame |

Design skill review runs on each built slice against these mockups; any gap found is fixed in the slice, not deferred.

## 7. Decisions to log (take the recommended option, do not ask)

| Id | Decision | Options | Why | Reversible |
| --- | --- | --- | --- | --- |
| L4-D1 | Markers and chapters live in two new tables, not a jsonb column on `videos` | Tables; jsonb column | Constraints (kind, ordering, uniqueness) enforced by the database, audit per save, simple deletes with cascade, trivial query by video | Yes (drop tables, no other table references them) |
| L4-D2 | Credits marker may have no end (runs to video end); intro and recap need an end | Always require end; null end for credits | A replaced video of a different length never leaves a stale window | Yes |
| L4-D3 | Marker and chapter edits apply to published videos at once, no republish | Require republish; immediate | Corrections are small and frequent; the data is display only | Yes |
| L4-D4 | Up Next countdown default 5 s, site setting range 5 to 10 | Fixed 5; default 8; setting | Matches M08-S13 today, honours the audit range, lets the owner tune on real viewers | Yes |
| L4-D5 | No auto skip of intros (button only) | Button only; per profile "skip intros automatically" | Fewer settings, less surprise on lessons where the intro carries content; revisit if viewers ask | Yes |
| L4-D6 | Skip button uses the S key, fades after 8 s idle, returns on input | Always visible; timed | Matches Netflix, keeps the picture clear | Yes |
| L4-D7 | Theatre mode is a device level layout choice owned by the watch page | Profile setting; device | It describes this screen, like volume; no schema or sync needed | Yes |
| L4-D8 | AirPlay now, Chromecast deferred to Could with a written spec | Both; AirPlay only; neither | AirPlay needs no SDK, account or CSP change; Cast needs a Google app id (client input), a third party script and CORS work; Chrome tab cast covers the gap | Yes |
| L4-D9 | Alternate audio tracks stay Could; player menu (L4-13) can ship dormant, encode (L4-14) waits for content | Build now; Could | Every rendition muxes one AAC track today; demuxed audio changes pipeline, master playlist and edge, a large change with no content yet | Yes |
| L4-D10 | Player settings menu consolidates Speed and Quality into one Settings button on desktop | Keep separate buttons; consolidate | One place for autoplay, captions appearance and shortcuts, same as the mobile sheet, fewer controls | Yes |
| L4-D11 | Caption `edge` option added; stored in `playbackPrefs` jsonb, no migration | New column; jsonb | The jsonb already holds caption choices and is validated in the app | Yes |
| L4-D12 | No swipe gestures for volume or brightness | Add; skip | Not in the audit, conflicts with page scroll and double tap, device volume buttons already work | Yes |
| L4-D13 | Still watching prompt after 3 unattended autoplays, counted per tab session | Never; per account; per session | Saves data on Nigerian plans with no storage or account dependency | Yes |
| L4-D14 | Seek rail rests at 5 px, grows to 8 px, hit area 44 px (DESIGN-SYSTEM and M08-S09 updated) | Keep 4 px and 32 px | Follows the audit and the touch target rule; old values contradicted DESIGN-SYSTEM 11.22 | Yes |
| L4-D15 | Standalone Up next uses the first unfinished related title in the same category | None for standalone; related | Completes M08-S13 AC4 with data already loaded | Yes |

## 8. Risks and dependencies

- Guest lane L1 changes how sessions start and how `real-playback.ts` and `WatchClient.tsx` are shaped. Mitigation: section 5 interfaces, small diffs in shared files, rebase after L1.
- Guest token TTL (15 to 20 min) limits AirPlay and any future Cast session; receivers cannot refresh tokens. Mitigation: copy in M43-S09 AC3, signed in accounts keep 2 hours.
- AirPlay behaviour on MSE video is the least certain item and needs a physical iPhone and Apple TV; the spike in L4-10 decides between keeping hls.js and switching to native for the session. Cannot be proven in CI.
- Migration number collisions with other lanes: use next free at merge, keep additive, resolve by renumbering the file and the journal entry.
- `player.css` and `PlayerView.tsx` are touched by L4-03, L4-04, L4-07, L4-09, L4-10. Mitigation: merge order in section 2, small PRs, rebase before each.
- Skip button and Up next tile overlap on small phones. Mitigation: tile offset rule and S110, S111, S117 mockups.
- Markers drift when a video is re-encoded or replaced with a different cut: markers are display only and validated against duration on every load (L4-05 test 'drops a marker that falls past the duration'); the editor shows a warning when `durationMs` changed since the last save (store nothing new, compare to the max marker time).
- Editors set bad markers (credits too early). Mitigation: warning at under 50 percent, Test button, and a viewer cannot lose content since skip only seeks forward.
- Admin editor reuses the preview session route (staff only); a change to that route in the guest lane would break the editor. Keep the editor on `/admin/videos/[id]/preview` semantics.
- Cloudflare free plan limits (about 1,200 plays a day) are reached sooner with guests; unrelated to this lane but sprites, markers and chapters add no media requests (they ship with the page).
- NDPA: `player_skip` is anonymous; the Cast SDK (if ever built) is a new third party and needs the privacy page updated first.
- Test discipline: only scoped `pnpm vitest run <file>`; DB tests need `TEST_DATABASE_ADMIN_URL` and `pg_ctlcluster 16 main start`, stop it at the end.

## 9. Counts

Slices: 17 (L4-00 to L4-16; 13 build slices at Must or Should, 4 Could). Stories: 17 new (M43-S01 to S17: 4 Must, 9 Should, 4 Could) and 13 existing stories edited (M02-S04 and M08-S01, S03, S07, S08, S09, S12, S13, S14, S17, S19, S25, S26). Mockups: 10 (S110 to S119). Decisions: 15 (L4-D1 to D15). UI findings: 18 (3 High, 9 Medium, 4 Low, 2 Info). Migrations: 1 required (markers and chapters), 1 conditional (audio tracks, L4-14). Worker changes: none required, 2 Could (L4-14, L4-16).

## 10. Owner questions (genuine)

1. Will any lesson have a second spoken language (for example Yoruba narration over English) at launch? If yes, L4-13 and L4-14 move from Could to Should and need sample files; if no, they stay parked.
2. Is Chromecast needed at launch? The recommendation is AirPlay now and Chromecast later because Cast needs a Google Cast developer account (a client input) and a third party script; say yes only if the client will provide the account.
