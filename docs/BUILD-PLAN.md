# Build Plan

Order of work: docs, design-system skill, mockups, then the build in parallel lanes. Everything marked [READY] in `docs/MODULES.md` is built now. Everything marked [CLIENT] stays configurable until Sister Vanessa answers.

## Phases

| Phase | Output | Gate |
|---|---|---|
| 0 Docs | PRD, MODULES, USER-STORIES, SCREEN-ARCHITECTURE, ARCHITECTURE, DATA-MODEL, SECURITY, TDD-PROTOCOL, TESTING, DESIGN-SYSTEM, ai-context | Reviewed, no em or en dashes |
| 1 Design system | `angels-delight-design-system` skill, tokens | Skill loads and reviews a sample change |
| 2 Mockups | Every screen on the canvas, document colours | Every screen in SCREEN-ARCHITECTURE has a board |
| 3 Foundation (lane A) | Monorepo, tooling, Docker, schema, storage adapter | Scoped tests green, `docker compose config` valid |
| 4 Parallel build (lanes B to J) | Features through TDD, one PR per slice | Each PR: scoped tests green, reviewer agent pass, footprint grep clean |
| 5 Hardening | Security scan, e2e of critical paths, accessibility pass | No High findings open |
| 6 Handover | HANDOVER.md, DEPLOYMENT checklist, client demo build | Ready to deploy once accounts exist |

## Lanes

Lane A must merge first. Lanes B to J then run at the same time, each in its own worktree and branch, each lane led by one agent that may spawn helpers (test writer, implementer, reviewer).

| Lane | Scope | Modules | Depends on |
|---|---|---|---|
| A Foundation | pnpm monorepo, TypeScript strict, ESLint, Vitest, Drizzle schema and migrations, config loader, storage adapter (local, MinIO, R2), Docker compose, CI | M22, M24 base | none |
| B Auth and accounts | Sign up, verify email, sign in, reset password, sessions, CSRF, rate limits, roles, account deletion | M01, M02, M12, M23 | A |
| C Viewer API | Profiles, catalog queries, home rows, browse, search, title detail, watch progress, My List, ownership checks | M03 to M07, M09, M10 | A |
| D Video pipeline | Resumable upload sessions, presigned multipart, job queue, FFmpeg HLS worker, thumbnails, caption worker, signed playback URLs | M13, M14, M15 | A |
| E Viewer UI | Tokens, components, sign in and sign up screens, profile picker, Home, Browse, Search, Title, My List, Account | M03 to M10, M26 | A, tokens |
| F Admin UI | Shell, dashboard, videos, upload UI, encoding queue, caption review, series and categories, curation, users, audit log, analytics | M12 to M17, M19, M20 | A, B, D contracts |
| G Player | hls.js engine behind our own interface (D-042), resume, captions menu, speed, quality, keyboard and touch, error recovery, up next | M08, M11 | A, C contracts |
| H Theme settings | Theme model, admin editor with live preview, contrast check, reset, CSS variable injection at render | M18 | A, tokens |
| I Low data and PWA | Data saver defaults, lazy loading, service worker, offline screen, image sizes | M25 | E |
| J Quality | Security review agent, AI-footprint review agent, accessibility agent, e2e for critical paths, scan harness notes | M23 | all |

## Per slice workflow (every lane)

1. Pick one user story from `docs/USER-STORIES.md`.
2. Write the failing test, run only that file, confirm red.
3. Implement until green. Run only that file again.
4. Reviewer agent checks: design-system skill for UI, `docs/SECURITY.md` for anything touching auth, data or uploads.
5. Grep the diff for em dashes, en dashes and emojis. Fix.
6. Commit as ARKDEV with a specific message, open a PR, merge with rebase merge.
7. Update `ai-context.md` and `CHANGELOG.md`.

## Defaults taken (recommended options, logged in docs/DECISIONS.md)

See `docs/DECISIONS.md`. Any new decision is added there at the time it is made.

## Lanes added after phase 4

The original table above stays as written. Lane notes live in `docs/lanes/`; the first line of each note is its scope.

| Note | Scope |
|---|---|
| `A2.md` | Lane A2: admin stories audit and fixes (M12 to M20, M27 to M30) |
| `B-auth.md` | Lane B: auth and accounts |
| `C-viewer-api.md` | Lane C: viewer API and domain services |
| `D-video-pipeline.md` | Lane D: Video pipeline |
| `E-viewer-ui.md` | Lane E: Viewer UI |
| `F-admin-ui.md` | Lane F: Admin UI |
| `F1-final-admin.md` | Lane F1: final admin and ops gaps |
| `F2-final-verification.md` | Lane F2: final verification and viewer leftovers |
| `F3-parity.md` | Lane F3: viewer mockup parity |
| `G-player.md` | Lane G: Player (M08, M11) |
| `H-theme.md` | Lane H: Theme settings and site configuration |
| `I-lowdata-pwa.md` | Lane I: low data, PWA, observability, analytics collection |
| `J3-design-review.md` | Lane J3: design system and accessibility review |
| `K1-viewer-integration.md` | Lane K1: viewer integration |
| `K2-video-integration.md` | Lane K2: video delivery integration |
| `K3-admin-integration.md` | Lane K3: admin integration |
| `M1-launch.md` | Lane M1: launch tooling |
| `M2-viewer-gaps.md` | Lane M2: viewer gaps |
| `M3-media-brand.md` | Lane M3: Media processing and brand kit |
| `P1-auth-pages.md` | Lane P1: sign in (S01) and sign up (S02) to the mockups |
| `P3-account-pages.md` | Lane P3: account and site screens (S27 to S31) |
| `Q1-cleanup.md` | Lane Q1: cleanup |
| `R1-stories.md` | Lane R1: three unbuilt viewer stories |
| `R2-stories.md` | Lane r2: poster fade, search progress, blur placeholders, focus recut |
| `R3-fonts-states.md` | Lane R3: Space Grotesk headings and account states |
| `V1-final-verification.md` | V1 final verification of main |
| `W1-release.md` | Lane W1: release images and no email first deploy |
| `a1-viewer-stories-audit.md` | Lane a1: viewer stories audit and fixes |
| `a3-platform.md` | Lane a3: platform stories audit and gap fixes |

Version 2 plan lanes (`docs/plan/v2/`): L1 Guest access, L2 Home, L3 Admin polish, L4 Player, L5 Engagement, L6 Discovery, L7 Languages, L8 Design system tuning (M47), L9 Monetization, L10 Account and reach.
