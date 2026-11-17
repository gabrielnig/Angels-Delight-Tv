# AI Context Matrix

## 1. Project Overview and Current State
Angels Delight TV: free, self-hosted, Netflix-style educational video platform for Sister Vanessa. Stack: Next.js (TypeScript strict) with `/admin`, Postgres (Drizzle), pg-boss, FFmpeg worker, faster-whisper service, Cloudflare R2 plus CDN, Video.js v10 with hls.js. Developer identity: ARKDEV.
State: documentation, design system, skill and mockups done (docs/, `.claude/skills/angels-delight-design-system`). Build starts with lane A (foundation). See `docs/BUILD-PLAN.md`.

## 2. Known Knowns (finalized core)
Architecture and security decisions in `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/DECISIONS.md`. Do not change without logging a decision.

## 3. Known Unknowns (immediate roadmap)
Lane A to J in `docs/BUILD-PLAN.md`. Client inputs pending: colours, domain, name, logo, content, languages, launch date, account ownership.

## 4. Unknown Knowns (implicit patterns)
Owner works in checkpointed batches, wants brief output, recommended options taken without asking, tests first and scoped only, commits as ARKDEV with no AI attribution, emojis, em dashes or en dashes.

## 5. Unknown Unknowns (blindspot log)
- High: Video.js v10 stability unverified (fallback Vidstack). Check at lane G start.
- Medium: Cloudflare Worker free plan limit (about 1,200 plays per day).
- Medium: NDPA obligations (registration, children's data) need a Nigerian practitioner.
- Low: MinIO community image availability for local dev.
