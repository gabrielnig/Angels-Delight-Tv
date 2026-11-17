---
name: angels-delight-design-system
description: Reviewer for Angels Delight TV UI. Use whenever a UI change is made or proposed (components, pages, CSS, theme settings, admin screens, player, copy), before opening a PR, and when asked to audit a screen against the design system. Checks tokens, contrast, states, keyboard and focus, touch targets, skeletons, reduced motion, copy rules and mobile first.
---

# Angels Delight TV design system reviewer

Source of truth: `docs/DESIGN-SYSTEM.md`. Default tokens: `reference/tokens.css` in this skill folder (mirrors section 3 of the doc). If the two disagree, the doc wins and the token file gets fixed.

## When to invoke

- Any change to files that render UI: components, pages, layouts, CSS, Tailwind config, icons, images, the player, admin screens, the theme editor.
- Any change to user facing text: labels, errors, empty states, emails that show UI copy.
- Before opening or merging a PR that touches the above (CLAUDE.md requires this).
- When designing a new component or page: read the matching section first, then review the result.
- When the theme editor, theme tokens or fonts change.
- When asked "does this follow the design system?"

Skip for pure backend, database or infrastructure changes with no UI or copy.

## How to run a review

1. List the changed UI files (`git diff --name-only` against the base branch, UI files only).
2. Read the matching sections of `docs/DESIGN-SYSTEM.md` (see pointers below).
3. Run the quick greps below, then walk the checklist by hand for each changed component.
4. Report findings in the format at the end. If nothing is wrong, say so and list what was checked.

### Quick greps (run on changed files)

```bash
# hardcoded colours (allowed only in the token file and theme defaults)
grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(' <files>
# hardcoded fonts
grep -nE 'font-family' <files>      # only var(--font-*) allowed outside tokens
# em and en dashes, emojis
grep -nP '[\x{2013}\x{2014}]' <files>
grep -nP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' <files>
# focus removed
grep -nE 'outline:\s*(none|0)' <files>
# raw pixel font sizes and durations
grep -nE 'font-size:\s*[0-9]+px|transition:[^;]*[0-9]+m?s' <files>
```

## Review checklist

Mark each as Pass, Fail or Not applicable.

### Tokens and theming
- [ ] Tokens only. Every colour, font size, space, radius, shadow, duration and z-index is a `var(--token)` from section 3. No hardcoded hex, rgb, font names or magic numbers.
- [ ] No hardcoded fonts. Only `var(--font-sans)` and `var(--font-display)`. No font outside the curated list (Inter, DM Sans, Poppins, Nunito, Lora). One family loaded at a time, self-hosted, subset, `font-display: swap`.
- [ ] Theme overridable. Works with a very different theme (test: dark ink on lemon, large size factor 1.15). No client facing colour, name, logo or text hardcoded. Status colours, sidebar and player stay fixed tokens.
- [ ] New tokens are added to `tokens.css`, `docs/DESIGN-SYSTEM.md` section 3, and the theme editor group (Themeable, Derived or Fixed) together.

### Contrast and colour
- [ ] Text pairs at least 4.5:1 (large text 3:1). Component edges, icons and focus rings at least 3:1. Compute the ratio, do not guess.
- [ ] Accent yellow is never text and never the only edge on a light surface. Text on yellow uses `--color-on-accent`.
- [ ] Inputs and controls use `--color-border-strong`, not `--color-border`.
- [ ] Text on images sits on a scrim or chip.
- [ ] Status is never shown by colour alone: icon plus word.

### States and behaviour
- [ ] States present for every interactive element: default, hover (only inside `@media (hover: hover)`), focus, active, disabled, loading, error. Not applicable states are noted in the spec.
- [ ] Loading locks size (no layout shift). Spinner only for actions under 3s. Uploads and long tasks use a progress bar with a number.
- [ ] Skeletons match final geometry, appear after 300ms, shimmer left to right, static under reduced motion, container `aria-busy`.
- [ ] Optimistic updates have rollback and an undo or retry path.
- [ ] Empty and error states exist, with plain words and a next step.

### Keyboard, focus and accessibility
- [ ] Fully keyboard operable with logical order. Visible 3px focus ring using `:focus-visible` and the ring tokens. No `outline: none` without a replacement.
- [ ] Touch targets at least 44 by 44 CSS px with spacing. Small visuals get padding.
- [ ] Semantic elements first (button, a, nav, table, ul). ARIA only where needed and correct (`aria-invalid`, `aria-describedby`, `aria-pressed`, `aria-selected`, `role="progressbar"` with values).
- [ ] Icon only buttons have `aria-label`. Decorative icons `aria-hidden`.
- [ ] Modals trap and restore focus, close on Esc. Toasts use `role="status"` or `role="alert"`, errors persist.
- [ ] Forms: visible labels, correct `type`, `inputmode`, `autocomplete`. OTP and password follow 11.3 and 11.4. Lazy then eager validation.
- [ ] Images have `aspect-ratio`, alt text, srcset, lazy loading (except first hero). Text is live, not baked into images.
- [ ] Captions available and controls reachable in the player. No autoplay.

### Motion
- [ ] Reduced motion respected: no transform, parallax, shimmer, rotation or autoplay under `prefers-reduced-motion: reduce`. State changes still happen.
- [ ] Only transform and opacity animate (progress width excepted). Feedback under 400ms. Durations and easings are tokens.

### Mobile first and data
- [ ] Mobile first CSS (`min-width` queries). Checked at 360px, 768px, 1280px. Survives 200 percent zoom.
- [ ] No hover only features. Gestures have visible alternatives.
- [ ] Low data rules from section 13: no autoplay video, no hover preview clips, still hero, lazy rows, heavy code split out, budgets respected, Data saver honoured.

### Copy
- [ ] Plain English, short sentences, sentence case, active voice, Nigerian audience friendly (section 14).
- [ ] Buttons say what they do. Errors say what happened and what to do, with no blame or raw codes.
- [ ] No em dashes, no en dashes, no emojis anywhere (code, comments, docs, UI, commit messages).
- [ ] Editable copy comes from settings with the doc defaults as fallback.

## Reporting findings

Report as a list ordered by severity. One entry per finding:

```
[Severity] path/to/file.tsx:LINE  Short rule name
Problem: what is wrong, in one sentence, with the measured value if relevant.
Fix: the concrete change (token name, attribute, markup) and the doc section.
```

Severities:
- **Blocker**: breaks accessibility or the rules in CLAUDE.md. Hardcoded colour or font, contrast fail, missing focus, keyboard trap, em or en dash or emoji, autoplay, unthemeable client value. Must be fixed before merge.
- **Major**: missing required state, target under 44px, no skeleton or progress for a wait, no reduced motion handling, wrong component spec. Fix before merge unless logged in `docs/DECISIONS.md`.
- **Minor**: spacing off scale, inconsistent radius, copy tone, weak empty state. Fix soon.
- **Note**: suggestion or follow up.

End with a summary line: counts per severity, a verdict (Approve, Approve with minor fixes, Changes required), and the list of checks that were Not applicable. Do not fix code unless asked. If a rule in the doc is wrong or missing, say so and propose a doc edit rather than silently accepting the deviation.

## Pointers to `docs/DESIGN-SYSTEM.md`

| Topic | Section |
|---|---|
| Principles | 1 |
| Research to decision map | 2 |
| Tokens (colour, groups, fixed vs themeable) | 3 |
| Contrast table, rules, theme editor gate | 4 |
| Curated fonts, type scale, what admin may change | 5 |
| Spacing, breakpoints, grid, touch targets | 6 |
| Radius and elevation | 7 |
| Motion and reduced motion | 8 |
| Icons | 9 |
| Imagery and aspect ratios | 10 |
| Button 11.1, Inputs 11.2, OTP 11.3, Password 11.4 | 11.1 to 11.4 |
| Cards (video, continue watching, series) | 11.5 |
| Rows, paging arrows, touch scroll | 11.6 |
| Hero banner | 11.7 |
| Top nav | 11.8 |
| Avatar and profile picker | 11.9 |
| Search | 11.10 |
| Filters and pills | 11.11 |
| Modal and sheet | 11.12 |
| Toast | 11.13 |
| Skeleton | 11.14 |
| Tabs | 11.15 |
| Table | 11.16 |
| Upload dropzone and queue lane | 11.17 |
| Progress | 11.18 |
| Badges | 11.19 |
| Empty states | 11.20 |
| Error states | 11.21 |
| Player controls | 11.22 |
| Up next tile | 11.23 |
| Theme editor | 11.24 |
| Admin shell | 11.25 |
| Auth screens | 11.26 |
| Page templates | 12 |
| Mobile and low data | 13 |
| Content and microcopy | 14 |
| Do and don't | 15 |
