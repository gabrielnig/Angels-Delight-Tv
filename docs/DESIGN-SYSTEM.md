# Angels Delight TV: Design System

Status: v1, 2026-11-17. Owner: ARKDEV. Reviewer: the `angels-delight-design-system` skill.
Default token file: `.claude/skills/angels-delight-design-system/reference/tokens.css` (mirrors section 3).

This is an original system. It adopts shared streaming patterns (shelves, hero, resume-first home, profile gate, skeleton loading, timed up-next) and none of any platform's assets, names, marks or exact artwork treatments. Research basis: `docs/research/netflix.md`, `docs/research/other-platforms.md`, and `/home/claude/shared-protocols/docs/UI-UX-STANDARD.md`.

Contents
1. Principles
2. Research to decision map
3. Theme tokens
4. Contrast rules
5. Typography
6. Spacing, grid, layout
7. Radius and elevation
8. Motion
9. Iconography
10. Imagery and aspect ratios
11. Components
12. Page templates
13. Mobile and low data rules
14. Content and microcopy
15. Do and don't

---

## 1. Principles

1. **Content first.** Thumbnails and the video are the colour. Chrome stays quiet. Yellow is rationed so it still means "look here".
2. **Mobile first, low data first.** Design at 360px wide on a low end Android on patchy data, then scale up. Every feature has a light path.
3. **Everything the client may change is a token.** Colours, fonts, sizes, logo and platform name come from the theme. Nothing client facing is hardcoded.
4. **Familiar before clever (Jakob).** Shelves, a hero, a profile gate, a player that behaves like other players. Originality lives in colour, type, tone and the pastel up-next tiles, not in odd navigation.
5. **Fewer choices (Hick, Miller).** One primary action per view. Group things in sets of 5 to 7. Hide secondary settings.
6. **Instant feedback (Doherty).** Any press shows a response in under 400ms, usually under 100ms. Optimistic updates for safe actions with rollback.
7. **Build for interruption.** Uploads resume. Playback recovers. Pages show something useful offline or on error.
8. **Accessible by default.** WCAG 2.2 AA minimum, keyboard complete, captions first class, reduced motion respected.
9. **Plain words.** Short sentences, everyday English for a Nigerian audience, no jargon, no blame.
10. **Calm admin.** The admin is dark at the side, light in the work area, dense but never cramped, always honest about progress.

## 2. Research to decision map

| Research finding | Decision here |
|---|---|
| Transparent nav over hero, solid on scroll; artwork is the visual | Top nav is transparent over hero with a scrim, solid `--color-surface` after 40px scroll (11.8) |
| Cards: 2:3 and 16:9, about 6 visible on desktop, about 2.5 on mobile with a peeking card | Our videos are 16:9. 5.3 visible from 1280 and 6.3 from 1920, 2.3 on mobile, so the next card always peeks (6, 10) |
| Hover preview expands after a delay, costs data | No video preview. On hover a card scales to 1.25 after `--hover-card-delay` and shows title, length, subject and Play. Touch has none (11.5) |
| Thin progress bar on Continue Watching | 4px rail, accent fill, on the card bottom (11.5) |
| Continue Watching and My List first, resume button says Resume | Home order puts Continue Watching first for returning users; hero and detail button switch to "Continue" with time left (11.7, 12) |
| Profile gate after sign in, kids flag, PIN optional | Profile picker tiles page, kids safe flag, no PIN in v1 (11.9) |
| Skeleton placeholders, dark canvas hides gaps | Skeleton with matched geometry, shimmer left to right (11.14) |
| Dense autoplay video heroes cost data | Hero is a still image. No autoplay anywhere on Home (11.7) |
| YouTube data saver, quality control, double tap seek, speed menu | Data saver switch, quality menu, double tap 10s, speed menu (11.22, 13) |
| Up next end card with countdown | Pastel up-next tiles, 5s countdown, cancellable (11.23) |
| Apple: hero 3 to 8 items, alt text must include banner text | Hero carousel max 5 items, rotating by default with a Pause control, alt text includes any text in image (11.7) |
| Resumable uploads, per file lanes, honest progress | Upload dropzone and queue lane per UI standard section 4 (11.17) |
| Single colour token system that propagates (Hawkins style) | One token file, theme editor writes tokens, components read tokens only (3, 11.24) |
| Showmax failed on cost, relevance and data mattered | Light pages, small images, local tone, no paid UI (13, 14) |

## 3. Theme tokens

All tokens are CSS custom properties on `:root`. Admin theme settings write overrides to the database and the server renders them into a `<style id="theme">` block. Default values are in `tokens.css`. Rules:

- Components use `var(--token)` only. Hex, rgb and font names never appear in component CSS.
- Token groups: **Themeable** (admin can change, contrast checked), **Derived** (computed from themeable ones, shown read only), **Fixed** (not editable).
- Tailwind, if used, maps its theme to these variables. It never defines colours of its own.

### 3.1 Colour tokens

| Token | Default | Group | Use |
|---|---|---|---|
| `--color-bg` | `#F5F5F2` | Themeable | Page background |
| `--color-surface` | `#FFFFFF` | Themeable | Cards, nav (solid), modals, inputs |
| `--color-ink` | `#1A1C22` | Themeable | Primary text |
| `--color-muted` | `#5B606B` | Themeable | Secondary text, captions, icons |
| `--color-border` | `#DEDDD6` | Themeable | Decorative dividers and card edges |
| `--color-primary` | `#1F6FB5` | Themeable | Banner blue: primary buttons, links, active tab, selected, focus on light |
| `--color-accent` | `#FFC93C` | Themeable | Accent yellow: progress fill, highlight badge, hero secondary, focus on dark |
| `--color-on-primary` | `#FFFFFF` | Derived | Text on primary (auto white or ink, whichever passes) |
| `--color-on-accent` | `#1A1C22` | Derived | Text on accent |
| `--color-primary-hover` | `#1B5F9C` | Derived | 10 percent darker |
| `--color-primary-active` | `#174F83` | Derived | 20 percent darker |
| `--color-primary-tint` | `#E3F1FF` | Derived | Selected row, info background |
| `--color-accent-hover` | `#F2B84B` | Derived | Accent hover |
| `--color-accent-active` | `#E0A63A` | Derived | Accent pressed |
| `--color-border-strong` | `#8A8D94` | Derived | Input and control edges (needs 3:1) |
| `--color-surface-sunken` | `#ECEAE3` | Derived | Table header, skeleton base, disabled fill |
| `--color-focus-ring` | `#1F6FB5` | Derived | Focus ring on light surfaces |
| `--color-focus-ring-dark` | `#FFC93C` | Derived | Focus ring on dark surfaces |
| `--color-success` / `-tint` | `#1E7A46` / `#E4F4EA` | Fixed | Success text, icon, background |
| `--color-danger` / `-tint` | `#B42318` / `#FDECEA` | Fixed | Error and destructive |
| `--color-warning` / `-tint` | `#8A5A00` / `#FFF3D6` | Fixed | Warning |
| `--color-info` / `-tint` | `#1F6FB5` / `#E3F1FF` | Fixed | Info |
| `--color-sidebar-bg` | `#17181C` | Fixed | Admin sidebar |
| `--color-sidebar-ink` / `-muted` | `#FFFFFF` / `#A9AEB9` | Fixed | Sidebar text |
| `--color-sidebar-hover` / `-active` | `#23252B` / `#2E3138` | Fixed | Sidebar item states |
| `--color-sidebar-accent` | `#FFC93C` | Fixed | Active item marker |
| `--color-player-bg` | `#0E0F13` | Fixed | Player and letterbox |
| `--color-player-ink` / `-muted` | `#FFFFFF` / `#B4B8C2` | Fixed | Player text and icons |
| `--color-player-rail` / `-buffer` | `#6A6E78` / `#9CA0AA` | Fixed | Seek bar rail (3:1 on the player surface, R34) and buffered |
| `--color-player-border` | `#3A3D46` | Fixed | Player menu borders, dividers and the countdown ring track |
| `--color-player-surface-raised` | `#1B1D24` | Fixed | Player menus, tooltips and popovers |
| `--color-player-switch-off` | `#6E7179` | Fixed | Off track of a player switch row |
| `--color-tile-*` | sky, mint, lemon, peach, lavender | Fixed | Pastel up-next and category tiles (ink text only) |

Status colours are fixed so a client colour change cannot make an error look like a success. Status is never conveyed by colour alone: always an icon and a word.

### 3.2 Why some tokens are fixed

The dark sidebar and dark player stay fixed because a light theme edit must not break video viewing contrast or admin legibility. The mockups also use a dark ink `#12263A` for deep blue headings. Map it to `--color-ink` rather than adding a token.

## 4. Contrast rules

Target: WCAG 2.2 AA. Normal text 4.5:1. Large text (24px, or 19px bold) 3:1. UI components, focus rings and meaningful icons 3:1 against adjacent colours. Ratios use the WCAG relative luminance formula and were computed for the defaults.

### 4.1 Computed defaults

| Pair | Ratio | Result | Allowed use |
|---|---|---|---|
| Ink `#1A1C22` on bg `#F5F5F2` | 15.59 | AAA | All text |
| Ink on surface `#FFFFFF` | 17.03 | AAA | All text |
| Muted `#5B606B` on bg | 5.77 | AA | Body size secondary text |
| Muted on surface | 6.31 | AA | Body size secondary text |
| White on blue `#1F6FB5` | 5.25 | AA | Primary button text, any size |
| Blue on bg | 4.81 | AA | Links and blue text on page |
| Blue on surface | 5.25 | AA | Links and blue text on cards |
| White on blue hover `#1B5F9C` | 6.64 | AA | Hover state |
| Ink on yellow `#FFC93C` | 11.09 | AAA | Accent button text, badge text |
| Ink on yellow hover `#F2B84B` | 9.52 | AAA | Accent hover |
| Yellow on bg | 1.41 | Fail | Never text, never the only boundary on light |
| Yellow on sidebar `#17181C` | 11.55 | AAA | Sidebar active marker, focus ring on dark |
| Yellow on player `#0E0F13` | 12.47 | AAA | Focus ring in player |
| Yellow on player rail `#3A3D46` | 7.06 | Pass | Progress fill on rail |
| Border `#DEDDD6` on bg | 1.25 | Decorative only | Dividers, card edges. Never the only edge of an input |
| Border strong `#8A8D94` on bg | 3.04 | Pass (3:1) | Input, checkbox, select edges |
| White on sidebar | 17.74 | AAA | Sidebar text |
| Sidebar muted `#A9AEB9` on sidebar | 7.98 | AAA | Inactive sidebar items |
| White on player | 19.15 | AAA | Player text |
| Player muted `#B4B8C2` on player | 9.65 | AAA | Timestamps |
| Danger `#B42318` on bg | 6.02 | AA | Error text |
| White on danger | 6.57 | AA | Destructive button |
| Danger on danger tint `#FDECEA` | 5.75 | AA | Error banner |
| Success `#1E7A46` on bg | 4.90 | AA | Success text |
| Warning `#8A5A00` on bg | 5.43 | AA | Warning text |
| Ink on primary tint `#E3F1FF` | 14.83 | AAA | Selected rows, info |
| White on scrim over thumbnail | at least 4.5 | Required | See 4.3 |

### 4.2 Rules

1. Text pairs must reach 4.5:1 (3:1 only for large text). UI edges and icons reach 3:1.
2. Accent yellow is a fill, a bar or a ring. It is never text on a light surface. Text on yellow is `--color-on-accent`.
3. Inputs, checkboxes, radios and selects use `--color-border-strong`, not `--color-border`.
4. Focus ring: 3px, `--color-focus-ring` on light, `--color-focus-ring-dark` on dark, 2px offset, never removed. Use `:focus-visible`.
5. Disabled controls are exempt from contrast but must also show a not allowed cursor, lowered opacity and `aria-disabled` or `disabled`. Never use disabled for an action the user needs explained: keep it enabled and explain on press.
6. Text over images always sits on a scrim (`--color-scrim-top`, `--color-scrim-bottom`) or a solid chip. Check against the lightest part of the image, not the average.
7. Do not use colour alone. Pair with text, icon or shape (error icon, selected tick, progress label).
8. Do not put muted text on tinted or image backgrounds unless the pair is computed.

### 4.3 Theme editor contrast gate

The theme editor computes these checks live and shows a warning chip beside each failing field.

| Check | Minimum | On fail |
|---|---|---|
| ink on bg and on surface | 4.5 | Block save |
| muted on bg and on surface | 4.5 | Block save |
| on-primary on primary | 4.5 | Auto switch on-primary to white or ink, whichever passes. Warn if neither passes |
| primary on bg (links) | 4.5 | Warn, allow save with a "Links may be hard to read" note |
| on-accent on accent | 4.5 | Auto switch, warn if neither passes |
| border-strong on bg | 3.0 | Auto derive a darker value |
| focus ring on bg | 3.0 | Auto derive |

"Block save" means the Save button stays disabled with the reason beside it. A "Reset to default" action is always present.

## 5. Typography

### 5.1 Curated font list

Free Google Fonts under the SIL Open Font License. Self-host WOFF2, ship the latin, latin-ext and vietnamese subsets (the vietnamese subset holds the precomposed Yoruba and Igbo letters ọ, ẹ, ị, ụ; ṣ and ń come from latin-ext), `font-display: swap`. Load at most one family at a time, regular 400, medium 500, semibold 600 and bold 700 only (variable font file if smaller).

| Font | Feel | Default | Notes |
|---|---|---|---|
| Space Grotesk | Geometric grotesque, as in the mockups | Yes (headings) | Display only (D-162). Body stays Inter |
| Inter | Neutral, close to Netflix style grotesque | Yes (body) | Best legibility on small Android screens |
| DM Sans | Geometric, friendly | | Good for headings |
| Poppins | Rounded geometric, bold | | Heavier, wider, check line length |
| Nunito | Soft, rounded | | Warm, suits kids profile |
| Lora | Serif, editorial | | Use for display only. Body stays sans |

Admin chooses one family for `--font-sans`. Fallback stack is always `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`, so first paint never waits on a font. Do not add fonts outside this list without a decision logged in `docs/DECISIONS.md`. Serif and Space Grotesk choices apply to `--font-display` only.

### 5.2 Type scale (base 16px, mobile first)

| Role | Token | Mobile | Desktop 960px and up | Weight | Line height |
|---|---|---|---|---|---|
| Hero title | `--text-hero` | 32 (h2 token) | 56 | 700 | 1.15 |
| H1 page title | `--text-h1` | 28 | 40 | 700 | 1.15 |
| H2 section | `--text-h2` | 24 | 32 | 700 | 1.15 |
| H3 | `--text-h3` | 20 | 24 | 600 | 1.3 |
| H4, row title | `--text-h4` | 18 | 20 | 600 | 1.3 |
| Lead | `--text-lead` | 17 | 18 | 400 | 1.5 |
| Body | `--text-body` | 16 | 16 | 400 | 1.5 |
| Small | `--text-small` | 14 | 14 | 400 | 1.5 |
| Caption | `--text-caption` | 13 | 13 | 400 | 1.4 |
| Micro label | `--text-micro` | 11 | 11 | 600, uppercase, 0.04em | 1.2 |

Component CSS uses the tokens above. Responsive sizes are set with media queries that reassign the token values, not by component overrides. Body never goes below 16px in forms (stops iOS zoom). Caption and micro never carry essential information alone.

### 5.3 Rules

- Maximum line length 70 characters for paragraphs, 45 for card descriptions.
- Sentence case everywhere. No all caps except micro labels.
- Titles on cards clamp to 2 lines, descriptions to 2 (cards) or 3 (hero) with ellipsis, and the full text sits in the accessible name or a title attribute on desktop.
- Numerals: use tabular numerals (`font-variant-numeric: tabular-nums`) for times, sizes, percentages and table columns.
- Respect user font size: use rem, never lock text in px. The layout must survive 200 percent zoom.

### 5.4 What admin may change

| Setting | Range | Token |
|---|---|---|
| Font family | Curated list only | `--font-sans`, `--font-display` |
| Mono font | System stack, no web font, recovery codes only (R38) | `--font-mono` |
| Base size factor | 0.9 to 1.15, step 0.05 | `--type-scale` |
| Weight | Not editable | fixed |
| Line height | Not editable | fixed |
| Colours | Section 3.1 Themeable only | see 3.1 |
| Logo, platform name | Upload and text | content settings, not tokens |
| Radius | Not editable in v1 | fixed |

## 6. Spacing, grid, layout

- 4px base scale: `--space-1` 4, 2 8, 3 12, 4 16, 5 20, 6 24, 8 32, 10 40, 12 48, 16 64, 20 80. No other values.
- Breakpoints (min width, mobile first): base 0, `sm` 600, `md` 960, `lg` 1280, `xl` 1920 (content stops growing at `--content-max` 1440).
- Page gutter: 16 (base), 24 (sm), 40 (md), 48 (lg).
- Grid: 4 columns base, 8 at sm, 12 at md and up, 16px gutters on mobile, 24px from md.
- Rows: `--cards-visible` 2.3 (base, the partial card tells people to swipe), 3.3 (sm), 4.3 (md), 5.3 (lg), 6.3 (xl, 1920 and up). Gutter `--page-gutter` is `clamp(1rem, 4vw, 3.5rem)`. Breakpoints are 600 (sm), 960 (md), 1280 (lg) and 1920 (xl). Card gap 8, 12 from md. Row gap `--row-gap` 32. Section gap 64.
- Browse grid (category page, search results): 2 columns base, 3 at sm, 4 at md, 5 at lg.
- Safe areas: honour `env(safe-area-inset-*)` on fixed bars and the player.
- Touch targets at least 44 by 44 CSS pixels with 8px between neighbours. A smaller visible icon gets padding to reach 44.

## 7. Radius and elevation

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 4 | Badges, tags, tooltips |
| `--radius-sm` | 8 | Buttons, inputs, cards, thumbnails |
| `--radius-md` | 12 | Panels, tiles, dropzone |
| `--radius-lg` | 16 | Modals, bottom sheets |
| `--radius-pill` | full | Pills, chips, toggle |
| `--radius-circle` | 50% | Avatars, icon buttons |

Elevation is mostly flat, using borders and surface contrast. Shadows only for things that float.

| Level | Token | Use |
|---|---|---|
| 0 | `--shadow-0` | Cards at rest, tables, panels (use 1px `--color-border`) |
| 1 | `--shadow-1` | Sticky nav on scroll, hovered card |
| 2 | `--shadow-2` | Dropdown, popover, toast |
| 3 | `--shadow-3` | Modal, bottom sheet |
| up | `--shadow-up` | Sticky bar fixed to the bottom edge (title page Play bar), shadow falls upward |

Z order: base 0, sticky 10, nav 20, overlay 30, modal 40, toast 50.

## 8. Motion

| Token | Value | Use |
|---|---|---|
| `--motion-instant` | 100ms | Press feedback, colour change |
| `--motion-fast` | 150ms | Hover, focus, pill select |
| `--motion-base` | 200ms | Dropdowns, tabs, toasts in |
| `--motion-slow` | 350ms | Modal and sheet, hero crossfade |
| `--motion-spin` | 700ms | One turn of a spinner |
| `--motion-shimmer` | 1.4s | One pass of a skeleton or progress shimmer |
| `--ease-standard` | cubic-bezier(0.4, 0, 0.2, 1) | Default |
| `--ease-enter` | cubic-bezier(0, 0, 0.2, 1) | Things arriving |
| `--ease-exit` | cubic-bezier(0.4, 0, 1, 1) | Things leaving |
| `--hover-card-delay` | 300ms | Card hover on enter only, so passing the cursor does not trigger it. `--hover-intent-delay` stays as an alias for one release |

Rules:
- Animate `transform` and `opacity` only. Never animate width, height, top or left (exception: progress bar width, 300ms ease-out, per UI standard).
- Feedback under 400ms always. Nothing decorative runs longer than 400ms.
- Shimmer: 1.4s linear loop, left to right. One shimmer per page region, not per element.
- Hero crossfade 350ms. Auto rotate is on, 10 s per slide, paused by hover, focus, touch and the Pause control, off under reduced motion and Data saver.
- **Reduced motion** (`prefers-reduced-motion: reduce`): durations become near zero (the tokens do this), no parallax, no scale on hover, no shimmer (use a static sunken fill), no hero rotation, no autoplay of anything, smooth scrolling off, up next countdown remains but without animated ring (number only). State changes still happen, only movement is removed.
- Data saver on: also drop the slow transitions.
- No flashing content. Nothing flashes more than 3 times per second.

## 9. Iconography

- One icon set, outline style, 24px grid, 1.5px stroke, rounded joins, drawn as inline SVG using `currentColor`. Recommended source: Lucide (ISC licence) so the set is open and consistent. Do not mix sets.
- Sizes: 16 (inline with text), 20 (buttons, table actions), 24 (nav, player secondary), 32 (player primary play, empty states 48 to 64).
- Icon colour follows text colour tokens. Icons never carry meaning alone: add a visible label, or `aria-label` on icon only buttons plus a tooltip on hover and focus.
- Decorative icons get `aria-hidden="true"`.
- Required set: play, pause, resume, skip back 10, skip forward 10, volume, mute, captions, settings, fullscreen, exit fullscreen, speed, quality, plus, check, close, search, back, chevron left and right, menu, more, trash, edit, upload, retry, eye, eye off, user, users, lock, info, warning, error, success, wifi off, data saver, clock, list (My List), download is not used.
- Sprite or per icon import, tree shaken. No icon font.

## 10. Imagery and aspect ratios

| Asset | Ratio | Source size | Delivered widths |
|---|---|---|---|
| Video card thumbnail | 16:9 | 1280 by 720 | 320, 480, 640 |
| Series card | 16:9 (2:3 poster is not used in v1, DEC-L8-03) | 1280 by 720 | 320, 480, 640 |
| Hero, desktop | 16:9 (stretches to 21:9 crop by CSS) | 1920 by 1080 | 960, 1440, 1920 |
| Hero, mobile | 4:5 | 1080 by 1350 | 540, 720 |
| Watch page up next tile | 16:9 | 1280 by 720 | 240, 320 |
| Avatar | 1:1 | 256 by 256 | 64, 128, 256 |
| Logo | free | SVG preferred | n/a |
| Open graph | 1200 by 630 | n/a | n/a |

Rules:
- Use `aspect-ratio` on every image box so nothing shifts. Set `width` and `height` or the ratio on the element.
- Deliver WebP (AVIF later), JPEG fallback, with `srcset` and `sizes`. `loading="lazy"` for everything below the fold, `fetchpriority="high"` on the first hero image only. Decoding async.
- Quality 70 to 75 for cards, 78 for hero. Card images target under 30 KB, hero under 120 KB.
- Placeholder: a 20px blurred or dominant colour fill (derived at upload) so something is visible before the image arrives.
- Alt text: the video title for cards (or empty if the title is adjacent as text), and for hero include any text burned into the image.
- Text on thumbnails is discouraged. Titles are rendered as live text.
- If an image fails: show a `--color-surface-sunken` box with the title text and a small play icon. Never a broken image icon.
- Thumbnail choice: admin picks one of up to 3 candidates per video. Optional simple A/B later.
- No stock photo of real people unless licensed. AI generated art is labelled in admin metadata.

---

## 11. Components

Common rules for every component, so they are not repeated each time:

- **States** are always designed: default, hover, focus, active (pressed), disabled, loading, error. Where a state does not apply it says so.
- Hover applies only under `@media (hover: hover)`, so touch never gets stuck hover.
- Focus uses the ring in 4.2 rule 4. Focus order follows visual order.
- Loading locks the component size so nothing shifts.
- Minimum touch target 44px. Disabled controls use `--color-surface-sunken` fill, `--color-muted` text and `not-allowed` cursor.
- Responsive notes assume mobile first and describe what changes upward.
- Respect reduced motion (section 8).

### 11.1 Button

Variants

| Variant | Fill | Text | Border | Use |
|---|---|---|---|---|
| Primary | `--color-primary` | `--color-on-primary` | none | One per view: Play, Sign in, Save |
| Accent | `--color-accent` | `--color-on-accent` | none | Hero secondary highlight, "Upload videos". At most one per view, never beside primary in the same group on the viewer side |
| Secondary | `--color-surface` | `--color-ink` | 1px `--color-border-strong` | Cancel, More info |
| Ghost | transparent | `--color-primary` | none | Tertiary, inline actions |
| Danger | `--color-danger` | white | none | Delete, remove |
| Icon | transparent or surface | `--color-ink` | none | Single icon, circle, 44px |
| On dark | rgba white 16 percent | `--color-player-ink` | none | Over hero and player |

Sizes: Small 36px tall (admin tables only, still 44px hit area via padding), Medium 44px (default), Large 52px (hero, auth). Padding 0 20px (M), 0 24px (L). Radius `--radius-sm`. Label 16px, weight 600. Icon plus label gap 8px. Full width on mobile for auth and form submit, auto width from `sm`.

States

| State | Primary | Notes |
|---|---|---|
| Default | primary fill | |
| Hover | `--color-primary-hover` | `hover: hover` only |
| Focus | 3px ring, 2px offset | `:focus-visible` |
| Active | `--color-primary-active`, scale 0.98 for `--motion-instant` | scale removed under reduced motion |
| Disabled | sunken fill, muted text | `disabled` attribute |
| Loading | label stays, spinner replaces icon or sits before label, width locked, `aria-busy="true"`, pointer events off | Spinner only under 3s. Longer work uses progress |
| Error | Button itself does not turn red. Error shows in the form or toast with a Retry action | |

Accessibility: native `<button>` or `<a>`. Links that look like buttons are links (navigate), buttons act. Icon only buttons need `aria-label`. Toggle buttons (My List) use `aria-pressed`. Do not disable submit to force correctness: validate on submit and explain.

### 11.2 Inputs (text, email, textarea, select, checkbox, radio, switch)

- Height 48px (text, select), textarea min 96px. Padding 0 14px. Font 16px (`--text-body`). Radius `--radius-sm`. Background `--color-surface`. Edge 1px `--color-border-strong`. Label above, always visible (no placeholder only labels). Helper text below in `--text-caption` muted. Required fields say "(required)" in the label text, optional fields say "(optional)". Do not rely on an asterisk.
- Placeholders show an example, not the label, and are never the only guidance.
- Checkbox and radio: 24px visual, 44px hit area, label clickable. Switch: 48 by 28, label left, state text "On" or "Off" beside it.

| State | Look |
|---|---|
| Default | border strong |
| Hover | border `--color-ink` |
| Focus | 2px `--color-primary` border plus ring |
| Active (typing) | as focus |
| Disabled | sunken fill, muted text |
| Loading | trailing spinner inside field (for async checks such as username), `aria-busy` |
| Error | 2px `--color-danger` border, error icon, message under field in `--color-danger` with `id`, input `aria-invalid="true"` and `aria-describedby` pointing at message |
| Success (optional) | small tick, used sparingly |

Validation: lazy then eager. Validate on blur the first time, then on change so the error clears as soon as it is fixed. On submit failure, focus the first invalid field and show a summary at the top of long forms.
Correct `type`, `inputmode`, `autocomplete` and `enterkeyhint` on every field. Mobile: native pickers for select where the list is long. Accept liberal input (spaces in phone numbers, mixed case emails), output strict.

### 11.3 OTP input

- Six slots (length configurable), each 48 wide by 56 tall on mobile, 56 by 64 from `sm`, gap 8. One real input holds the string state, slots are presentational, so paste, autofill and screen readers behave.
- `inputmode="numeric"`, `autocomplete="one-time-code"`, `pattern="[0-9]*"`, `maxlength` equals length. Strip non digits on paste. Auto advance on type, backspace moves back. Submits automatically when full, with a visible loading state.
- Resend link locked behind a 30 to 60s countdown: "Send a new code in 0:42". After the countdown it becomes a Ghost button "Send a new code".
- States: default (strong border), focus (active slot ring), filled (ink digit), error (danger border on all slots, shake removed under reduced motion, message "That code is not right. Check it and try again."), disabled during verify, loading (spinner under slots), success (tick, then continue).
- Accessibility: group label "Enter the 6 digit code we sent to your email". Announce errors with `role="alert"`. Do not move focus between slots using separate inputs.

### 11.4 Password input with strength

- Input with visibility toggle (icon button, `aria-pressed`, label "Show password" or "Hide password"). `autocomplete="new-password"` on sign up and reset, `current-password` on sign in. Never block paste.
- Strength meter below: 4 segments plus a word (Too short, Weak, Okay, Strong). Colour plus word, never colour only. Segment colours use danger, warning, info, success tokens. Compute with zxcvbn, lazy loaded only on sign up and reset screens.
- Live checklist (length first): "At least 10 characters" (hard rule), "Not a common password" (hard rule), "Better with a mix of words you can remember" (hint). Length over symbol rules. Checklist items show tick or circle plus text.
- States per 11.2. Error text names the fix: "Use at least 10 characters."
- Caps lock hint when detected: "Caps Lock is on".

### 11.5 Cards

#### Video card (16:9)

- Anatomy: thumbnail (16:9, `--radius-sm`), duration badge bottom right (micro text on `--color-player-control-bg`), title (2 lines max, `--text-small` semibold) below, optional meta line (category, length) in muted caption.
- Size: width set by row (`--cards-visible`). Min tap area is the whole card.
- Whole card is one link to the title page. A separate "Add to My List" icon button sits top right, 44px hit area, revealed on hover and focus-within on desktop, always visible on touch at low emphasis.

| State | Look |
|---|---|
| Default | image, badge, title |
| Hover (desktop, `hover: hover` and `pointer: fine`, row at least 600px wide) | after `--hover-card-delay` (enter only) the thumbnail scales to `--card-scale` 1.25 over `--motion-hover` with `--ease-out-strong`, shows title, length, subject and Play. Origin left for the first card, right for the last. No video preview |
| Focus | ring around the thumbnail, actions revealed |
| Active | scale 0.98 |
| Disabled | not used. Unavailable videos are not shown to viewers |
| Loading | skeleton card (11.14) |
| Error | image fallback (section 10), card stays usable |

Accessibility: card is an `<a>` with accessible name "Title, 4 minutes". Actions are siblings, not nested inside the link. Lazy loaded image with alt empty when title text is adjacent.

#### Continue watching card

- Same as video card plus: progress bar overlaid at the bottom of the thumbnail (4px high, rail `--color-player-rail`, fill `--color-accent`), a Play icon button always visible, text "12 min left" or "Resume at 3:41" under the title, and a "Remove from row" action in an overflow menu (44px target, `aria-label` "Remove {title} from Continue watching").
- Progress bar has `role="progressbar"` with `aria-valuenow`, and an accessible text "60 percent watched".
- Ordering: most recently watched first. A title leaves the row at 95 percent watched (setting).
- Optimistic remove with an undo toast ("Removed. Undo").
- States: as video card. Error: progress bar hidden if position unknown, card links to start.

#### Series card

- Same 16:9 thumbnail with a stacked edge on the right and bottom (two offset sheets in `--color-border`) and a count badge "8 episodes". Links to the series detail page. States as video card. On the detail page, episodes list as rows with number, thumbnail (small), title, length and progress.

### 11.6 Rows with paging arrows and touch scroll

- A row has a title (H4, left, linked "See all" on the right for category rows), and a horizontal scroller.
- Implementation: native `overflow-x: auto` with `scroll-snap-type: x proximity`, `scroll-padding` equal to the gutter, hidden scrollbar, `overscroll-behavior-x: contain`. Touch scroll is plain native swipe. Cards use `flex: 0 0 calc((100% - gaps) / var(--cards-visible))`.
- Paging arrows (desktop with `hover: hover` and `pointer: fine` only): 44 by 44 circle buttons on the left and right edges, vertically centred on the thumbnails, `--color-surface` fill with `--shadow-2`, chevron icon. Visible when the row is hovered or focused within. Click scrolls by one visible page (minus one card for context). Hidden at the start or end. They are also keyboard focusable and have `aria-label` "Previous titles" and "Next titles".
- Row is a `<section aria-labelledby>`, the list is `role="list"` or a real `<ul>`. Cards are tab stops, arrow keys are not hijacked in v1. After paging, focus stays on the arrow.
- States: loading (skeleton row, 6 cards), empty (row hidden, never an empty shelf, except My List which shows an empty state), error (row shows inline "Could not load this row. Try again." with a Retry button, other rows continue).
- Mobile: no arrows, the last card peeks. Add `content-visibility: auto` for rows below the fold.
- Never nest vertical scrolling inside rows.

### 11.7 Hero banner

- Content: still image, title (`--text-hero`), one to two line description, meta (category, length), primary action "Play" (or "Continue", with time left), secondary "More info". No autoplay video, no sound.
- Layout mobile: 4:5 image, scrim at the bottom, text and buttons stacked inside at the bottom, buttons full width. Desktop: 16:9 up to a max height of 70vh, text block on the left at most 40 characters wide per line, `--color-scrim-bottom` and a left scrim.
- Carousel: 1 to 5 items, dots indicator (44px hit area, current marked with accent fill plus `aria-current`), rotating by default (section 8), swipe on touch, arrows beside Pause on desktop.
- States: loading (skeleton with the hero box, text bars), error (fall back to a solid `--color-primary` panel with title text), reduced motion (no crossfade, no parallax).
- Text sits on scrim so white text reaches 4.5:1. Title is live text, not baked into the image. Alt text includes any baked text.
- Resume logic: if the signed in profile has progress on the featured title, the primary button becomes "Continue" and shows "12 min left".

### 11.8 Top navigation (viewer)

- Height `--nav-height` (56 mobile, 68 from `md`). Logo (links home) left, primary links (Home, Browse, My List) then search and profile avatar on the right.
- Mobile: logo, search icon, avatar in the top bar. A bottom tab bar (Home, Browse, Search, My List) with 4 items, 56px tall, icon plus label, current item marked with `--color-primary` icon and text plus a 3px top bar. Safe area padding. The bottom bar hides on the watch page.
- Desktop: text links, 16px semibold. Active link has a 3px `--color-primary` underline.
- Behaviour: transparent with a top scrim over the hero, becomes `--color-surface` with `--shadow-1` after 40px scroll (a sentinel and IntersectionObserver). On non hero pages it is always solid. Text colour flips with background to keep contrast (white on scrim, ink on surface).
- States per link: default, hover (underline), focus (ring), active (`aria-current="page"`), loading none.
- Accessibility: `<nav aria-label="Main">`, skip link "Skip to main content" is the first focusable element, bottom tab bar is `<nav aria-label="Primary">`.

### 11.9 Profile avatar and profile picker tiles

- Avatar: circle, sizes 32 (nav), 40, 64 (menu header), 120 to 160 (picker). Initial letter on a pastel `--color-tile-*` fill with ink text, or a chosen illustration from a small admin set of 12. No uploaded photos in v1 (privacy and data).
- Avatar menu (from the nav avatar): profile names (switch), Manage profiles, Account, Help, Sign out. Opens as a popover on desktop and a bottom sheet on mobile.
- Picker page "Who is watching?": a grid of tiles, 2 across on mobile, 3 to 5 across on desktop, each tile is a button with avatar and name beneath, plus an "Add profile" tile (max 5 profiles). A "Manage profiles" button toggles edit mode where each tile shows an edit badge.
- Tile states: default, hover (avatar ring `--color-primary` 3px), focus (ring), active (scale 0.98), disabled (not used), loading (skeleton tiles), error (message "We could not load profiles. Try again." with Retry).
- Kids profile: a "Kids" badge on the tile and a safe flag in edit form. Kids mode hides unsafe categories, hides search suggestions beyond approved titles, and uses the Nunito pairing only if the admin enables it (not automatic).
- Accessibility: tiles are buttons with name "Switch to {name}" and "Kids profile" where relevant. Edit form uses 11.2 inputs.

### 11.10 Search

- Entry: search icon in the nav opens a full width bar (desktop: expands in place, 320px to 480px; mobile: full screen overlay with a Back button). Input 48px, `type="search"`, `enterkeyhint="search"`, clear button 44px.
- Behaviour: debounced 250ms suggestions (titles, categories) in a listbox below, recent searches (last 5, device only) when empty, results page at `/search?q=`. Results are a browse grid with count: "12 videos for 'farming'".
- States: default, focus, loading (3 skeleton rows under the field, no blocking), error ("Search is not working right now. Try again."), empty ("No videos found for 'xyz'. Check the spelling or try a shorter word." then 3 suggested categories as pills).
- Accessibility: `role="combobox"` with `aria-expanded`, `aria-controls`, `aria-activedescendant`, suggestions in `role="listbox"`. Esc closes. Announce result count with `aria-live="polite"`.

### 11.11 Filters and pills

- Pill: 36px tall visible with 44px hit area, padding 0 16px, `--radius-pill`, 14px semibold. Inactive: `--color-surface` fill, 1px `--color-border-strong`, ink text. Active: `--color-primary` fill, on-primary text, tick icon prefixed (not colour alone). Used for categories, filters, view switch.
- Pill rows scroll horizontally on mobile with no wrap, wrap on desktop only if three or fewer lines are needed.
- Selecting a pill updates the content beneath instantly, no full reload, URL query updated.
- States: default, hover (border ink), focus (ring), active (selected, `aria-pressed` for toggles or `aria-selected` in a tablist), disabled (sunken), loading (content below shows skeleton, pill stays active), error (inline message under the row).
- A single "Filters" button on mobile opens a bottom sheet with sort and category groups and a sticky "Show 24 videos" apply button. Admin tables use the same pills for status filters with counts.

### 11.12 Modal and bottom sheet

- Modal: centred, max width 480 (small), 640 (medium), 90vh max height, `--radius-lg`, `--shadow-3`, surface fill, scrim `rgba` ink 60 percent. Header (H3, close button 44px), body (scrolls), footer (actions right aligned, primary on the right, Cancel secondary).
- Mobile: becomes a bottom sheet anchored to the bottom, full width, top radius, drag handle, max height 90vh, actions stacked full width.
- Behaviour: `role="dialog"` with `aria-modal="true"`, labelled by its title. Focus moves into the dialog on open (first heading or first field), is trapped, Esc closes (unless a destructive confirm with unsaved data asks first), focus returns to the trigger. Background scroll locked and inert. Click on scrim closes except for destructive or form dialogs.
- Destructive confirm: title says what will happen ("Delete this video?"), body says the consequence ("This removes it for everyone. This cannot be undone."), buttons "Delete video" (danger) and "Keep it" (secondary). Never "OK" and "Cancel" for destructive actions.
- States: open animation 200ms (opacity plus translateY 8px), reduced motion no transform. Loading (primary button loading, dialog stays open), error (inline danger banner at top of body, dialog stays open).

### 11.13 Toast

- Position: bottom centre on mobile above the tab bar, bottom left on desktop. Max one visible, queue others. Width up to 360, `--radius-sm`, `--shadow-2`.
- Storage notice: the notice sits bottom right on desktop (1024 px and wider) and above the tab bar on phones, on the overlay layer (30, below modal 40 and toast 50). A toast never overlaps it: below 1024 px and on phones the toast lifts above the notice by the notice height plus 12 px (`--notice-h`, 0 when the notice is hidden).
- Variants: success (success tint, tick icon), info (info tint, info icon), warning, error (danger tint, error icon). Always icon plus text. Optional action (Undo, Retry) as a Ghost button.
- Timing: info and success auto dismiss at 5s (range 4 to 6s) and pause on hover and focus. Error toasts persist until dismissed. Close button 44px.
- Accessibility: container `role="status"` `aria-live="polite"`, errors use `role="alert"`. Never the only place an error is shown for a form field. Do not steal focus. Under reduced motion, no slide, fade only.
- Copy is one sentence, past tense for success: "Added to My List."

### 11.14 Skeleton

- Matched geometry for the thing it replaces (card 16:9 plus two text bars, hero box plus bars, table rows, avatar circles) so there is no layout shift.
- Base `--color-surface-sunken`, shimmer highlight left to right 1.4s. Show after 300ms of waiting, so quick loads never flash. Replace content in one step, no staggered pop in.
- Reduced motion: static fill. Mark the container `aria-busy="true"` and give it a visually hidden "Loading" text. Individual skeleton shapes are `aria-hidden`.
- Never use a skeleton for something that failed. Show an error state.
- Spinners are only for inline actions under 3s and are 20px, `currentColor`, with `role="status"` text hidden.

### 11.15 Tabs

- Used in admin (Details, Captions, Thumbnails, Publish) and viewer title page (Episodes, More like this, Details).
- Two styles: underline tabs (viewer, 3px `--color-primary` underline on active, ink text) and pill tabs (admin, per 11.11). Height 48. Tab labels sentence case, max 2 words. Scroll horizontally on mobile with an edge fade hint, no wrapping.
- States: default (muted), hover (ink), focus (ring), active (`aria-selected="true"`, ink and primary underline), disabled (sunken, not focusable skipped by arrows), loading (panel shows skeleton), error (panel shows error state).
- Accessibility: `role="tablist"`, `tab`, `tabpanel`, roving tabindex, Left and Right arrows move, Home and End jump, activation follows focus when panels are cheap, otherwise Enter or Space. Sync to URL hash or query.

### 11.16 Table (admin)

- Used for videos, users, audit log. Container `--color-surface`, 1px `--color-border`, `--radius-md`. Header row `--color-surface-sunken`, 13px semibold, sticky. Row height 56 (comfortable), 44 (compact toggle). Zebra off, hover row `--color-primary-tint`. Numbers right aligned with tabular numerals.
- Columns example (videos): checkbox, thumbnail 64 by 36, title (link) plus category, status badge, length, views, updated, actions menu.
- Features: sort (button in header, `aria-sort`), filter pills above, search, bulk select with a sticky bulk action bar, cursor pagination ("Load more" or Prev and Next), state synced to URL query, scroll offset cached in `sessionStorage`.
- Mobile: tables become stacked cards (title, status badge, two key facts, actions menu). No horizontal scrolling for critical tasks. If a wide table must exist, make the first column sticky.
- States: loading (skeleton rows), empty (11.20), error (11.21 inside the table body with Retry), row selected (primary tint plus tick), row action loading (spinner in action button), disabled actions (explain in a tooltip on focus).
- Accessibility: real `<table>`, `<th scope>`, caption or `aria-label`, action menus are buttons with `aria-haspopup="menu"`.

### 11.17 Upload dropzone and queue lane

Follows UI standard section 4.

**Dropzone**
- 160px min height, dashed 2px `--color-border-strong`, `--radius-md`, surface fill. Icon, title "Drop videos here", secondary "or choose from your device" (a real button, 44px), hint "MP4, MOV or MKV. Up to 4 GB each. You can add many at once."
- Dragover: three signals at once: border becomes solid `--color-primary`, background `--color-primary-tint`, microcopy becomes "Release to upload".
- States: default, hover, focus (ring on the button), active drag, disabled (during maintenance, with reason), error (file type or size rejected: inline list "movie.avi is not supported. Use MP4, MOV or MKV."), loading n/a.
- Keyboard and touch: the button opens the native picker with `multiple`. Dropzone itself is not the only way.

**Queue lane (one per file, independent)**
- Layout: row with file type icon or thumbnail (64 by 36), name (truncate middle), size, status text, progress bar, percentage, speed, ETA, and actions (Pause, Cancel, Retry, Remove).
- Statuses: Waiting, Uploading (honest progress: "62 percent, 8.4 MB/s, about 2 min left"), Paused, Processing ("Preparing your video, 3 of 4 sizes done"), Done ("Uploaded just now" badge, with Replace and Remove), Failed ("Upload failed. 90 percent was saved." with Retry, resumes from the stored byte offset, not zero).
- A failure or dropped connection in one lane never blocks the others. Concurrency 2 to 3 lanes. Network drop shows a lane level "Waiting for network" and resumes automatically with backoff, plus a banner "You are offline. Uploads will continue when you are back online."
- Progress bar per 11.18. Do not use an infinite spinner for uploads.
- Done lane becomes a rich preview card: thumbnail, type and exact size, completion badge, Replace and Remove.
- Accessibility: each lane is a list item with `role="progressbar"` and a text status read via `aria-live="polite"` at 10 percent steps, not every tick. Retry and Cancel have names that include the file name. Closing the tab while uploading warns with `beforeunload`.

### 11.18 Progress

- Bar: 8px high (4px on cards), `--radius-pill`, rail `--color-surface-sunken` (light) or `--color-player-rail` (dark), fill `--color-primary` (admin) or `--color-accent` (viewer watch progress). Width transitions 300ms ease-out. Label shows the number. Never a bar without a number on admin tasks.
- Indeterminate bars are allowed only for waits under 3s and for unknown processing steps, paired with text ("Preparing your video"). Reduced motion: static striped fill, no sweep.
- `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`.
- Steppers (sign up "Step 1 of 3"): text plus segment bar, current segment `--color-primary`.
- States: default, complete (tick, `--color-success`), error (danger fill with Retry), paused (muted fill and "Paused" text).

### 11.19 Badges

- Shape: `--radius-xs`, 24px tall, 8px padding, 12px (use 13 caption) semibold, icon optional at 16px.
- Variants (all icon or word plus colour): Neutral (surface sunken, ink), Info (info tint, info text), Success (Published), Warning (Needs review, Scheduled), Danger (Failed), Accent (New: `--color-accent` with `--color-on-accent`), Kids (primary tint, ink, shield icon), Duration (on `--color-player-control-bg`, white).
- Admin statuses: Draft, Uploading, Processing, Needs captions, Ready, Scheduled, Published, Failed. Each has an icon plus text.
- States: static, not interactive. If a badge is a filter, it is a pill (11.11).
- Accessibility: text carries meaning, never colour alone. Duration badge text "4:12" has a visually hidden "4 minutes 12 seconds" in the card name.

### 11.20 Empty states

- Anatomy: simple line illustration (48 to 96px, `currentColor` muted), H3 headline, one sentence of help, one primary action.
- Catalogue:
  - My List empty: "Your list is empty." "Tap the plus on any video to save it for later." Button "Browse videos".
  - Continue watching empty: row hidden.
  - Search empty: see 11.10.
  - Category empty: "Nothing here yet." "New videos are added often. Check another category." Button "Back to Home".
  - Admin videos empty: "No videos yet." "Upload your first video to get started." Button "Upload videos" (accent).
  - Admin queue empty: "Nothing uploading." No action.
- Tone is encouraging, never blaming. Empty states are `role="status"` only if they appear after a user action (filter, search).

### 11.21 Error states

Types: inline field error (11.2), banner (page level, danger tint, icon, message, action), full page (404, 500, offline), row level (11.6), playback (11.22), toast (11.13).

- Always say what happened, what it affects and what to do next, in plain words. Offer a retry or a way out. Never show raw codes as the message. A short reference code may sit in small text for support ("Reference: AD-4F2A").
- Examples: Offline: "You are offline. Check your data or Wi-Fi, then try again." Not found: "We could not find that page. It may have moved." Button "Go to Home". Server: "Something went wrong on our side. Try again in a moment."
- Full page: 64px icon, H2, sentence, primary button, secondary link. Keep the nav so the user can leave.
- Offline pattern: a slim banner under the nav, cached pages still readable, actions queued where safe.
- Accessibility: `role="alert"` for errors appearing without navigation, focus moved to the heading on full page error.

### 11.22 Player controls (dark player)

- Player container `--color-player-bg`, 16:9, full width on mobile (edge to edge), max 1100px on desktop above the title, with the page remaining off white around it. Controls overlay on a bottom scrim, and a top bar with title and Back (only in fullscreen and mobile landscape).
- Control bar (left to right): Play or Pause (32px icon, 52px target), Back 10 and Forward 10 (desktop and mobile), Volume (desktop only, slider on hover and focus), time "1:42 / 4:30" (tabular, `--color-player-muted`), spacer, Captions, Speed, Quality, Fullscreen. Mobile shows Play, seek bar, time, Captions, Settings (speed and quality inside), Fullscreen.
- Seek bar: 5px rail growing to 8px on hover, drag and focus (transform only), buffered `--color-player-buffer`, played `--color-accent`, thumb 16px circle `--color-player-ink`. Hit area 44px high. Time tooltip on hover or drag.
- Behaviour: controls show on tap or mouse move and hide after 3s of play (not while paused, focused or the menu is open). Double tap left or right skips 10s with a brief ripple label. Tap toggles controls, play from the big centre button. Space or K play pause, Left and Right 5s seek (J and L 10s), Up and Down volume, M mute, C captions, F fullscreen, Esc exits, number keys jump, `,` and `.` frame when paused is not needed. Shortcuts work when the player has focus.
- Settings menu: one overlay panel with Captions (Off, English, later others) and caption appearance (size Small, Medium, Large, Extra large, background Solid or Clear), Speed (0.5, 0.75, 1, 1.25, 1.5, 2), Quality (Auto, 1080p, 720p, 480p, 360p) with data estimates ("About 20 MB per minute"), and "Data saver" switch (caps at 480p). Menus are radio lists with a tick.
- Resume: starts at saved position with a toast "Continuing from 3:41" and a "Start over" action. Position saves every 10s and on pause, hide and exit.
- States: default, hover (icons brighten), focus (yellow ring `--color-focus-ring-dark`), active, disabled (Captions disabled when no track, with tooltip "No captions for this video"), loading (centre spinner after 300ms of buffering, then "Still loading. Your connection is slow." after 6s with a "Lower quality" action), error (overlay on dark: "This video could not play." plus "Try again" and "Lower quality" buttons, and a reference code in small text).
- Captions: on by default for Nigerian audience when the admin sets so. Caption text is white on semi opaque black (`rgba` ink 75 percent), at least 4.5:1, positioned above controls. Sizes scale. Never hidden by controls.
- Accessibility: all controls are buttons with names, `aria-pressed` for toggles, sliders have `aria-valuetext` ("1 minute 42 seconds of 4 minutes 30 seconds"). Controls reachable by keyboard and not trapped. Reduced motion: no ripple, no autoplay, no auto next without confirmation.

### 11.23 Up next tile

- Appears in two places: in a right column or below the player (list of up to 5 tiles), and as an end card during the last 10 seconds.
- Tile: pastel fill from `--color-tile-*` (rotating by position), `--radius-md`, 16:9 thumbnail left (120 wide) or top (mobile full width), title (ink, 2 lines), length, and a small "Up next" micro label. Ink on pastel is at least 12:1.
- End card: "Next: {title}" with a 5 second countdown ring (site setting 5 to 10) (number only under reduced motion), primary button "Play now" and secondary "Cancel". Autoplay next is off by default and a setting in the profile, and always off in Data saver. The countdown stops on Cancel or any key.
- States: default, hover (lift 2px, shadow 1), focus (ring), active, loading (skeleton), empty (hidden), error (hidden, no retry noise), current (the playing item gets a "Now playing" badge and no link).
- Accessibility: tile is a link named "Play next: {title}, {length}". Countdown announced once ("Next video starts in 5 seconds") with `aria-live="polite"`, not each second.

### 11.24 Theme editor (admin)

- Location `/admin/settings/theme`. Two columns on desktop (controls left 360px, live preview right), single column on mobile with a "Preview" tab.
- Controls grouped: Brand (platform name, logo upload with alt text, favicon), Colours (the 7 themeable colours with swatch, hex input, a colour picker), Fonts (curated list dropdown with a sample line in each font, size factor slider 0.9 to 1.15), Preview mode toggle (Home, Watch, Auth, Admin).
- Live preview: an iframe or scoped container that applies draft tokens as CSS variables immediately. Draft is not saved until "Save theme". Preview never changes the admin's own appearance unless the admin turns on "Apply to admin".
- Contrast: each colour field shows the live ratio and a Pass or Fail chip with icon and text, per 4.3. Fail messages say what to change: "Text and background are too close. Make one darker."
- Buttons: Save theme (primary, disabled with reason when blocked), Reset to default (secondary, confirm dialog "Reset all colours and fonts to the Angels Delight defaults?"), Revert changes (ghost). Last saved time and who saved it are shown. Every save writes an audit log entry. Keep the last 5 versions for rollback.
- States: default, hover and focus per child controls, loading (Save shows spinner, preview dims slightly), error (save failure banner with the reason), disabled (read only for roles without permission, with explanation), unsaved changes (badge "Unsaved changes" and `beforeunload` guard).
- Accessibility: colour inputs have a text hex field so no one depends on the picker. Swatches have names ("Banner blue, #1F6FB5"). Pass and Fail are text, not just colour.
- Storage: values saved as the token names in 3.1 only. Unknown keys rejected server side. Values validated as hex.

### 11.25 Admin shell (sidebar, header, page container)

- Sidebar: `--color-sidebar-bg`, 240px wide (`--admin-sidebar-width`), logo and platform name top, nav groups: Overview, Videos, Series, Captions, Home rows, Users, Analytics, Theme, Audit log. Item 44px tall, 20px icon, label 15px, active item `--color-sidebar-active` fill with a 3px `--color-sidebar-accent` marker, hover `--color-sidebar-hover`, focus ring `--color-focus-ring-dark`.
- Collapse: below `md` the sidebar becomes an off canvas drawer opened by a menu button in a 56px top bar. Between `md` and `lg` it may collapse to icons with tooltips.
- Header in the work area: breadcrumb, H1, page actions on the right (primary action on the far right). Work area is `--color-bg` with surface panels.
- Counts (Needs captions: 3) are badges in the sidebar, text plus number.

### 11.26 Auth screens

- Centred card (max 400px), logo above, H1, inputs, one primary full width button, secondary links beneath ("Forgot your password?", "New here? Create an account"). Sign up shows "Step 1 of 3" when multi step. Email verification screen uses the OTP component. Password reset has request, code or link, and new password screens.
- Errors do not reveal whether an email exists ("If that email has an account, we sent a link.").
- After sign in the destination is the profile picker (11.9).

---

## 12. Page templates

Each template lists regions in order. All are mobile first and use the shell for that audience.

| Template | Regions | Notes |
|---|---|---|
| Home | Top nav, hero banner, Continue watching row (if any), My List row (if any), curated rows (e.g. New, Learn a skill, Health, Money), footer | 5 to 8 rows at launch. Rows lazy render below the fold |
| Browse by category | Nav, H1 with category, filter pills (sort, length), video grid, load more | Cursor pagination, state in the URL |
| Title detail (video) | Nav, banner image with scrim, title, meta, Play or Continue, My List toggle, description, captions note, tabs (Details, More like this) | Detail is a page. A modal is not used |
| Series detail | As title detail plus episode list with progress and a season selector if more than one | Episode rows are 44px+ tall targets |
| Watch | Dark player, title and description under it, action row (My List, Share), up next tiles (right column on desktop, below on mobile), tabs (Details, Transcript) | Page background stays `--color-bg`. Bottom tab bar hidden. Back goes to the previous page |
| Search | Nav with open search, recent or suggestions, results grid, empty state | |
| My List | Nav, H1, grid, empty state | Remove via card action with undo |
| Profile picker | Logo only top bar, "Who is watching?", tiles, Manage profiles | No nav |
| Manage profile | Form: name, avatar, kids flag, delete | Delete uses destructive confirm |
| Account | Email, password change, devices (later), sign out | Tabs or stacked sections |
| Auth (sign in, sign up, verify, reset) | Centred card (11.26) | |
| 404, 500, offline | Full page error (11.21) | Keep nav |
| Admin dashboard | Sidebar, header, stat tiles (views, watch time, videos, queue), recent activity, alerts (Needs captions) | Charts follow the `dataviz` skill and use theme colours |
| Admin videos | Header with Upload (accent), filter pills with counts, table | |
| Admin upload | Dropzone, queue lanes, metadata drawer per file | Non blocking lanes |
| Admin video edit | Tabs: Details, Thumbnails, Captions, Publish | Autosave drafts, Publish needs confirmation |
| Admin captions review | Player, transcript list with editable cues, Approve | |
| Admin home rows | Draggable list of rows with preview and drag handle plus Up and Down buttons | Keyboard reorder is required |
| Admin users | Table, profile counts | |
| Admin analytics | Date range pills, charts, top videos table | |
| Admin theme | Theme editor (11.24) | |
| Admin audit log | Filterable table | |

## 13. Mobile and low data rules

Mobile first
- Design and test at 360 by 640 first, then 390, 768, 1024, 1440. Test on a throttled mid range Android.
- Thumb zone: primary actions in the lower half. Bottom tab bar for viewers. No hover only features. No tiny controls.
- Single column forms, correct keyboards, 16px inputs, avoid fixed elements that cover content when the keyboard opens.
- Respect orientation: player goes landscape in fullscreen, lock not forced.
- Gestures always have a visible alternative (double tap skip has buttons).

Low data and slow network
- Budget per page (compressed): initial JS under 170 KB, CSS under 40 KB, fonts one family subset under 60 KB, Home above the fold images under 200 KB. Each regression needs a note in the PR.
- Server render pages. Ship little client JS. Split heavy parts (zxcvbn, theme editor, upload) so viewer pages do not load them.
- Images: responsive `srcset`, WebP, lazy, dominant colour placeholder. No autoplay video, no GIFs, no hover preview clips. Hero is a still.
- Video: HLS adaptive. Start at 360 or 480p on cellular (Network Information API when present, otherwise after first segment timing). Quality menu shows approximate data use per minute. "Data saver" setting (profile level, default on for cellular) caps at 480p, disables autoplay next and prefetch, and loads smaller thumbnails. Never preload video on Home.
- Prefetch only on strong intent (pointerdown, focus), and never in Data saver.
- Cache app shell and fonts with a service worker. Pages already visited stay readable offline. Show a clear offline banner.
- Retry with exponential backoff. Never lose a typed form or a resumable upload because of a drop.
- Show something within 1 second: skeleton first, content next. No layout shift (CLS under 0.1). Target LCP under 2.5s on a throttled 4G profile, INP under 200ms.
- Costs are visible: before a long download or hi res play on cellular, nothing blocks, but the quality menu shows the estimate.

## 14. Content and microcopy

Voice: warm, clear, respectful, like a good teacher. Plain English a secondary school student can read. Nigerian context where natural (naira, local examples, names, places, "data" and "network"), without slang that excludes the diaspora. No Pidgin in the UI in v1 (revisit with language support), and when Yoruba, Igbo, Hausa and Pidgin arrive each gets reviewed by a native speaker.

Rules
1. Short sentences. One idea each. Aim for under 20 words in UI text and under 12 for buttons and labels.
2. Active voice. Talk to "you". Say "we" for the platform.
3. Say what the button does: "Save changes", "Delete video", "Send a new code". Never "Submit", "OK", "Click here".
4. Sentence case. No exclamation marks except real celebration (rare). No ALL CAPS.
5. Errors: what happened, what to do. No blame, no codes as the message. "That password is too short. Use at least 10 characters."
6. Empty states encourage and give the next step.
7. Numbers and time: "4 min", "1 hr 20 min", "12 min left", do not use the 24 hour clock, use "Today", "Yesterday", dates as "17 Nov 2026". Currency, if ever shown, uses the naira sign with thousands separators.
8. Data wording uses "data" and "MB". Say "About 20 MB per minute".
9. Avoid jargon: say "video quality" not "bitrate", "captions" not "WebVTT", "sign in" not "authenticate", "upload" not "ingest", "get ready" not "transcode".
10. No em dashes or en dashes anywhere (code, docs, UI, commits). Use a comma, a full stop, or "to" for ranges. Use a normal hyphen only inside compound words and file names.
11. No emojis anywhere.
12. Educational framing for content: titles say what you will learn ("How to save money on data"). Descriptions begin with a verb or the outcome.
13. Respect: no scolding, no fear marketing, kids safe wording in Kids profiles.
14. All platform copy that the client may change (name, taglines, page text) comes from settings, with these defaults as fallbacks.

Defaults

| Place | Copy |
|---|---|
| Tagline (changeable) | "Learn something new, free." |
| Hero primary | "Play" or "Continue, 12 min left" |
| Hero secondary | "More info" |
| Add to list | "Add to My List" and "Remove from My List" |
| Profile gate | "Who is watching?" |
| Sign in button | "Sign in" |
| Sign up button | "Create account" |
| Verify | "We sent a 6 digit code to {email}. Enter it below." |
| Loading long | "Still loading. Your connection may be slow." |
| Offline | "You are offline. Check your data or Wi-Fi." |
| Generic error | "Something went wrong on our side. Try again in a moment." |
| Upload failed | "Upload failed. 90 percent was saved. Tap Retry to continue." |
| Delete confirm | "Delete this video? This removes it for everyone. This cannot be undone." |
| Captions note | "Captions are on. You can turn them off in the player." |
| Data saver | "Data saver keeps video at 480p or lower to use less data." |

## 15. Do and don't

Do
- Use tokens for every colour, font size, space, radius, shadow and duration.
- Check every text pair against section 4. Compute, do not eyeball.
- Design every state: default, hover, focus, active, disabled, loading, error.
- Use skeletons that match the final layout, and progress bars with numbers for uploads.
- Keep one primary action per view and keep accent yellow rare.
- Provide keyboard, focus, 44px targets and visible labels.
- Respect reduced motion and Data saver.
- Keep text live (not baked into images) and give images alt text.
- Make theme overridable: build with the themeable tokens and test with a very different theme (for example dark ink on lemon).
- Write plain, kind microcopy. Log new decisions in `docs/DECISIONS.md`.

Don't
- Don't hardcode hex, rgb, font names or pixel font sizes in components.
- Don't use accent yellow as text or as the only edge on a light background.
- Don't rely on colour alone for status, selection or errors.
- Don't remove focus outlines. Don't use `outline: none` without a replacement.
- Don't autoplay video or audio, add hover preview clips, or use heavy animated heroes.
- Don't use infinite spinners for uploads or long tasks.
- Don't use placeholders as labels.
- Don't use hover as the only way to reach an action.
- Don't use em dashes, en dashes or emojis in any text.
- Don't copy any streaming platform's logo, colours, icons, artwork or exact layout specs.
- Don't add fonts outside the curated list or load more than one family at a time.
- Don't block the user on a disabled button without telling them why.
- Don't show raw technical errors, stack traces or codes as the message.
- Don't nest scroll areas or trap keyboard focus outside modals.
- Don't add payment, subscription, ad or upsell UI. The platform is free.
