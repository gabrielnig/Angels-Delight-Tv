# Netflix case study for Angels Delight TV

Purpose: structured research notes on Netflix as a reference for a free, self-hosted, Netflix-style educational platform. Everything is paraphrased. Where a number is not published by Netflix, it is marked (estimate) and comes from third-party teardowns or my own reasoning. Items I could not verify from a fetched source are marked (unverified).

Research limits, stated plainly: the Netflix Tech Blog artwork post and brand.netflix.com were not reachable in this session (URL allowlist), so artwork and brand rules rest on secondary coverage. Netflix does not publish its row, card or spacing specs, so all layout numbers below are third-party estimates.

## 1. Information architecture and navigation

- Desktop web uses a minimal top bar: logo, a small set of primary links (Home, shows, movies, new and popular, My List), search, notifications, and a profile menu. The bar is transparent over the hero and becomes solid on scroll. Third-party estimate: 68px tall, solid after about 50px of scroll (estimate).
- The bar stays out of the way so artwork is the main visual (designrush analysis).
- The 2025 TV redesign moved key navigation into more visible spots and added more context around titles. A 2026 mobile redesign simplified navigation and added a vertical discovery feed that moves from short previews to full titles (cxl analysis).
- Personalisation works on three levels: which rows appear, which titles fill each row, and how titles are ordered within a row (cxl).
- Persistent returning-user rows: Continue Watching and My List (designrush).
- Estimated scale of a Netflix home page: about 40 rows, up to about 75 titles each (estimate, designrush). Early rows are personalised from history, later rows lean editorial and trending.

## 2. Page types

| Page | What it does | Notes |
|---|---|---|
| Browse (Home) | Hero billboard plus stacked horizontal rows | Rows below the fold are personalised, including a resume row |
| Hero billboard | Full width feature of one promoted title with autoplay clip, Play and More Info | Most prominent element on the page. Estimated 16:9 (estimate) |
| Rows | Horizontal carousels grouped by genre, mood or algorithm | Labels can be personalised, such as "because you watched" |
| Title detail (modal) | Opens over browse, keeps context. Synopsis, cast, episodes, similar titles | Estimated width clamp 800px to 1280px (estimate) |
| Watch page | Full viewport player, controls fade out | See section 8 |
| Search | Typed query returns a grid of matching titles | Results update as you type (general knowledge, unverified in fetched sources) |
| Profile gate | "Who is watching" screen after sign-in | Up to five profiles per account, add via a plus tile (cxl) |
| Account | Membership, plan, profiles, viewing activity, devices | Viewing activity lets you hide titles or a whole series |
| Kids | Separate profile type with restricted catalogue | Kids profiles cannot hide titles through viewing activity and cannot be transferred (documentarytube, Help Center) |

## 3. Row and card anatomy

All values below are third-party estimates (webdesignhot teardown), not Netflix specs.

- Visible cards per row: about 6 on a 1440px desktop, 4 on tablet, about 2.5 on mobile (estimate). The partial third card on mobile signals that the row scrolls.
- Poster aspect 2:3 for portrait art, with 16:9 landscape tiles also used on the home page (estimate and general knowledge).
- Gap between cards: 8px desktop, 4px mobile. Row gap about 36px. Section gap about 64px (estimate).
- Corner radius small: about 4px for posters and buttons, 6px for modals (estimate).
- Hover behaviour on desktop: after a short delay (estimate about 0.75s) the card scales up (estimate 1.4x, about 360px wide) and shows a preview clip, action buttons (play, add to list, like, more info), match and rating metadata, and genre tags (designrush, webdesignhot). The expansion lets users decide without leaving browse.
- Row paging: arrow controls appear on row edges on hover, and scrolling moves by a page of cards. On touch it is native horizontal swipe. On TV, focus moves card to card with the d-pad.
- Progress bar on Continue Watching cards: thin red fill on a grey rail at the card bottom (colour estimates in section 6).
- Recommendations can shift as you act, for example after watching trailers or rating titles (cxl).

## 4. Artwork personalisation

- Netflix picks different artwork for the same title per member. For a film with romance and comedy angles, a romance fan may see the leads together and a comedy fan may see the comic character. A fan of a particular actor is more likely to see art featuring them (Dezeen coverage of the Netflix approach).
- Netflix lets data decide which signals matter instead of fixed rules, and rotates different art across pages to learn preferences (Dezeen). The Tech Blog describes this as a bandit style experiment (not fetched, so mechanism detail is unverified here).
- Netflix reports a "significant lift" in engagement but publishes no figure in the sources I could read.
- Relevance for us: with 100 videos, per-user art personalisation is overkill. A cheap version is 2 or 3 admin-chosen thumbnails per title and a simple A/B pick (see adopt section).

## 5. Typography

- Netflix Sans is a custom face built in house with the foundry Dalton Maag, announced March 2018. Design leads were Noah Nathan and Tanya Kumar. It replaced Gotham, partly to cut licensing costs and to be more distinctive (It's Nice That).
- Character: clean, neutral geometric grotesque. Uppercase is cinematic, lowercase compact. The arched lowercase t echoes the wordmark curve. Weights include thin, light, regular, medium, bold and black (It's Nice That).
- Not available for third-party use. Fallback stack on the site is Helvetica Neue, Helvetica, Arial (webdesignhot).
- Estimated type scale (estimate, third party): billboard title 64/900, display 48, 32 and 24 at 700, row title 18/500, body 16 and 14 at 400, caption 13, legal 12, micro label 11 uppercase bold.
- Free substitutes that sit close in feel (my judgement, all open licence on Google Fonts):
  - Inter, a neutral grotesque, rated about 85 percent similar to a comparable grotesque in one similarity tool (fontalternatives, for Nitti Grotesk, not Netflix Sans, so treat as indicative only).
  - DM Sans, geometric and friendly, about 80 percent on the same tool.
  - Also worth testing: Plus Jakarta Sans, Manrope, Outfit (not checked against a source).
- Constraint from the brief: fonts come from a curated list in admin, so ship 3 or 4 vetted options and a safe system fallback. Subset and self-host fonts to save data on mobile.

## 6. Colour use

All hex values are third-party estimates (webdesignhot), not official.

- Canvas near black (about #141414), pure black for hero and player. Raised surfaces about #181818 to #2F2F2F.
- Text: white primary, light grey body (about #E5E5E5), muted grey (about #B3B3B3).
- Brand red about #E50914, used sparingly as a functional signal: logo, progress fill, selected or primary action glow (designrush).
- Small accents: green for match percentage, translucent grey glass for secondary buttons.
- Contrast: white on near black is very high. White on the red is about 4.8:1 by my own calculation, which passes AA for normal text but only just.
- Lesson: dark surround makes thumbnails pop. Red is rationed so it still means something.

## 7. Spacing, grid and motion

- Spacing scale on a 4px base: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96 (estimate).
- Page max width 1920px, content max about 1440px, breakpoints around 500, 950, 1280 and 1920 (estimate, source is internally inconsistent on the smallest).
- Buttons about 48px tall primary, icon circles 40px, inputs about 50px (estimate).
- Hawkins is the internal design system. Public facts: design tokens for colour, type and spacing, small composable components, a Professional side for studio tools and a Consumer side for public products sharing tokens and icons, used across 80 plus apps, TV and mobile (visulry summary of Netflix write-ups). Tokens centralised so one change propagates.
- Motion (estimates): fast 100ms, standard 200ms, slow 400ms, standard easing close to cubic-bezier(0.4, 0, 0.2, 1). The hover expand is slower, with a deliberate delay so passing the cursor over rows does not trigger previews.
- Mobile motion on iPhone: billboard card has a parallax tilt, a coloured border taken from the artwork, tap enlarges the card then expands to a full-screen detail view, profile switch animates the chosen avatar to the corner (TechCrunch 2023).

## 8. Player UI

- Controls appear on tap or mouse move and fade out. Audio and subtitles live in one menu reached from an icon (Help Center). On TVs the remote up or down arrow brings controls up.
- Netflix tested a TV player with grouped icons at bottom left, Skip Recap as the most prominent icon, Next Episode and settings just above a slightly larger progress bar, and audio, subtitles and subtitle appearance merged into one overlay so playback continues while you adjust (What's on Netflix report, a test, not a guaranteed ship).
- Skip intro and next episode appear as timed buttons during credits or openings (general knowledge, consistent with the test coverage above).
- Resume: the main button changes from Play to Resume and shows the current episode and progress (cxl).
- Desktop keyboard shortcuts (third party list): Space or Enter play and pause, F fullscreen, Esc exit, Left and Right arrows seek 10 seconds, Up and Down volume, M mute, S skip intro. Shortcuts work only when the player has focus. No native subtitle shortcut (documentarytube).
- Playback speed exists on mobile and varies by device and title (Help Center accessibility page). Quality is mostly automatic with data usage settings in the account (general knowledge, unverified).
- Subtitle appearance: font, size, shadow and background colour are adjustable (Help Center accessibility page).

## 9. Profiles, Continue Watching and My List logic

- Up to five profiles per account (cxl). Each profile has its own recommendations, My List, viewing history and Continue Watching row (Help Center, documentarytube).
- Continue Watching is profile specific and separate from My List. Removing from one does not change the other (documentarytube).
- Remove one title via a "remove from row" action on hover or in a title menu. Hiding a whole series happens in Viewing activity and also stops it influencing recommendations. A "hide all" clears the whole history. Changes can take up to 24 hours to show on all devices (documentarytube).
- Profile transfer carries name, icon, recommendations, My List, and settings. A Kids profile, or one with a PIN, cannot be transferred (Help Center).
- Kids profiles save audio and subtitle choices differently from adult profiles, and Kids profiles cannot hide titles via Viewing activity (Help Center).
- The exact "finished" threshold and ordering of the Continue Watching row are not published in the sources I could read. Common practice is most recently watched first and removal when about 90 to 95 percent complete (estimate, my reasoning, not Netflix confirmed).

## 10. Sign-up and sign-in flow

- Sign-up is split into labelled stages such as "Step 1 of 3", which shows remaining effort. Plan selection shows few options and repeats cancel anytime reassurance. New users can pick a few titles they like to seed recommendations. After sign-up, an autoplaying trailer and a prominent Play button push straight to viewing. On TV, sign-up can start with email or phone and finish by an activation link (cxl).
- The logged-out landing page was heavily optimised: see section 12.
- Sign-in then lands on the profile gate. Post-sign-in destination is the profile chooser, not the home page.
- Not covered by fetched sources: password reset and email verification details (unverified). Our brief already requires both.

## 11. Empty, loading and error states

Public documentation on these is thin. What I could confirm or reasonably infer:

- Loading: Netflix uses skeleton style placeholders and the dark canvas so layout does not jump (general knowledge, unverified in sources).
- Empty My List: friendly text pointing to browse (general knowledge, unverified).
- Stale Continue Watching after history edits: guidance is to restart, switch profile or sign out and in, and allow up to 24 hours (documentarytube). This implies eventual consistency across devices, which is a state we should design copy for.
- Playback errors show a numbered code and a retry (general knowledge, unverified).

## 12. What makes it feel fast

- Logged-out landing page: dropping client-side React and rewriting small features in plain JavaScript cut JS by about 200 kB (from about 300 kB) and roughly halved load time and time to interactive on desktop (Netflix engineers via Addy Osmani's case study on Medium).
- Prefetching HTML, CSS and JS for the next step of sign-up reduced time to interactive on later pages by about 30 percent. XHR prefetch cached bundles with about 95 percent success (same source).
- Server rendering kept for consistency, with the page interactive in under about 3.5 seconds in lab tests (same source).
- Hover previews load lazily and after a delay. Art is the first thing to paint, with the dark canvas hiding gaps.
- Optimistic UI in lists and resume buttons (general knowledge, unverified).

## 13. Accessibility

- About one third of Netflix members use accessibility features (Netflix, 2025 post).
- Audio description for many titles. In 2025 more than 13,000 additional hours in 34 languages (Netflix post).
- Subtitles, SDH and closed captions with adjustable font, size, shadow and background (Help Center).
- Keyboard shortcuts on computers, screen reader support, voice control, assistive listening, brightness control and playback speed on mobile (Help Center).
- Large text follows device font settings on mobile (Help Center).

## 14. Mobile layouts

- Billboard card fills most of the screen with a coloured border and parallax (TechCrunch 2023).
- Rows show about 2.5 cards with a peeking edge (estimate). Gap 4px (estimate).
- Tap on a card opens a full details view instead of a hover preview. No hover on touch.
- Bottom tab navigation for the main areas (general knowledge, unverified).
- 2026 redesign adds a vertical short preview feed (cxl).

## What to adopt for Angels Delight TV

1. Dark, art-first browse feel as an option, but keep our brief's off-white default. Make both themes available through the admin CSS variable system. Reserve the accent (banner blue or yellow) for the primary action and progress, as Netflix rations red.
2. Home structure: one hero, then 6 to 10 curated rows, each of 5 visible desktop cards (as the brief says), about 2.5 on mobile with a peeking edge, 4 on tablet. With only 100 videos, fewer rows and shorter rows beat Netflix scale.
3. Row order that matters for our users: Continue Watching first (only if present), then My List, then curated categories.
4. Profile gate after sign-in, with up to 5 profiles, a plus tile, a kids-safe flag, separate Continue Watching and My List per profile, as Netflix does.
5. Continue Watching as its own row with a thin progress bar on the card, a Resume label on the main button, and a clear remove action. Treat as finished near the end (suggest 95 percent, configurable).
6. Title detail as an overlay or page with a clear play or resume button, short synopsis, duration, captions available, episodes and similar titles.
7. Hover previews on desktop only, with a delay of about 600 to 800ms (estimate) so scrolling does not spawn them. On touch, tap opens detail. Do not autoplay video on mobile data.
8. Player: Video.js with a bottom control bar, one combined captions and settings menu, speed and quality menus, Skip intro and Up next buttons driven by admin-set markers, 10 second seek on arrow keys, Space, F, M, and captions toggle key (C). Document the keys in a help dialog.
9. Subtitle appearance settings (size, background, colour) saved per profile.
10. Staged sign-up with a visible step count and password reset and email verification clearly worded.
11. Speed: lean landing page with minimal JavaScript, prefetch the next step in sign-up and the first HLS segments on Play intent, server render browse, lazy load below-the-fold rows, small WebP or AVIF thumbnails with width and height set, skeleton rows, saved quality default to 360 or 480p on mobile data with a data saver toggle.
12. Accessibility to a higher bar: visible focus rings, full keyboard operation of rows (arrow keys and Enter), captions on by default for videos that have them, reduced motion respected, contrast warning in admin (already in the brief), text resizing, transcripts for educational videos as an addition Netflix does not need.
13. Theme tokens in the database as CSS variables, mirroring the Hawkins idea of centralised tokens.
14. Simple, original artwork support: 2 or 3 admin-uploaded thumbnails per title with optional A/B rotation in phase 2.

## What to avoid or change so ours is original, not a copy

1. Do not use Netflix red, the N monogram, the wordmark, the tudum sound, Netflix Sans, or any Netflix art, screenshots or icons. The brand rules page was not reachable, so assume all of these are protected (unverified, treat as restrictive).
2. Do not clone the exact layout. Differences to make on purpose: off-white default instead of black, blue and yellow identity, pastel up-next tiles, rounder radii (8 to 12px instead of about 4px), a different card hover (for example a lifted card with a details strip instead of a 1.4x video pop-out).
3. Use our own type pairing from the curated list, for example Inter or DM Sans for UI with a friendlier display face for headings, instead of imitating a geometric grotesque with Netflix-like weight 900 hero titles.
4. Own names: "Continue Watching" and "My List" are generic, but consider friendlier education wording such as "Pick up where you left off" and "Saved for later". Avoid copying "Top 10" mechanics, "Because you watched" phrasing exactly, or match percentages.
5. Do not copy the black-and-red hero with the gradient fade. Try a lighter hero with a clear text panel, caption on the left and the art card on the right.
6. Skip dark patterns: autoplay next with no escape, hidden cancel, tiny close buttons. Our product is free and educational, so provide a visible "stop auto-play" and session length reminder for kids.
7. Education-specific differences: show duration, topic, level, and a learning outcome line on cards. Add chapters or key points within the player, transcript view, and a "what you learned" end screen. These are not Netflix features and make us distinct.
8. Do not over-build personalisation. With 100 titles, editorial curation plus Continue Watching beats a recommendation engine.
9. Do not use the autoplaying trailer on the sign-up page. Data is expensive for our audience, so use a still image with a play-on-tap preview.
10. Avoid the Netflix level of motion. Keep 150 to 250ms transitions and honour reduced-motion, as low-end Android devices struggle.

## Gaps to close later

- Official Netflix brand guidelines page and the Tech Blog artwork post could not be fetched here. Re-check if we want to cite precise rules.
- Row, card and spacing numbers are estimates. Validate by measuring the live site in browser dev tools for study only, then design our own values.
- Empty, loading and error state behaviour is mostly unverified and needs a hands-on check.

## Sources

- https://www.itsnicethat.com/news/netflix-sans-typeface-dalton-maag-graphic-design-210318
- https://help.netflix.com/en/node/124844
- https://help.netflix.com/en/node/372
- https://help.netflix.com/en/node/116022
- https://visulry.com/article/design-system/hawkins-design-system-exploring-the-principles-and-practices-behind-our-ui-framework
- https://medium.com/dev-channel/a-netflix-web-performance-case-study-c0bcde26a9d9
- https://cxl.com/blog/netflix-design/
- https://www.designrush.com/best-designs/websites/netflix-streaming-platform
- https://www.webdesignhot.com/design.md/netflix/
- https://fontalternatives.com/alternatives/nitti-grotesk/
- https://www.dezeen.com/2017/12/20/netflix-targets-film-artwork-depending-users-viewing-habits-design-technology/
- https://techcrunch.com/2023/01/17/netflix-iphone-app-update-2023/amp/
- https://www.whats-on-netflix.com/news/first-look-netflix-new-tv-video-player-redesign/
- https://www.documentarytube.com/blog/how-to-clear-your-netflix-continue-watching-list-in-2026/
- https://www.documentarytube.com/blog/useful-netflix-keyboard-shortcuts-and-other-binge-watching-tips/
- https://about.netflix.com/en/news/our-latest-steps-in-making-content-more-accessible
