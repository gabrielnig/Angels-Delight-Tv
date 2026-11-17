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
| G Player | Video.js v10 and hls.js integration, resume, captions menu, speed, quality, keyboard and touch, error recovery, up next | M08, M11 | A, C contracts |
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
