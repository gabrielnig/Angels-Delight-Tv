# Project Brief (source of truth for all docs)

**Product:** Angels Delight TV, a free, self-hosted, Netflix-style educational video streaming platform. Client: Sister Vanessa. Developer: ARKDEV (Unique, Lagos). Domain under consideration: angelsdelight.tv (not yet bought).

**Content:** 100 AI-generated educational videos at launch, 1 to 8 minutes each (about 13 hours). Likely English, to be confirmed. Nigerian languages (Yoruba, Igbo, Hausa, Pidgin) possible later.

**Audience:** Nigeria first (mobile-first, patchy and expensive data, low-end Android), then diaspora and the world. Free, no subscriptions, no payments. Live streaming is not needed now (maybe later).

**Not on YouTube.** Own pipeline.

## Chosen architecture
- Next.js (frontend and `/admin` in the same app), TypeScript, Postgres, Docker on a VPS (Contabo EU, Hetzner fallback).
- Video: direct-to-R2 upload, FFmpeg worker encodes HLS (360/480/720/1080p), stored in Cloudflare R2, served through Cloudflare CDN on a custom domain (e.g. video.yourdomain.com). Signed URLs and HLS encryption instead of DRM. Never proxy VPS-hosted video through Cloudflare.
- Player: Video.js v10 with the hls.js engine. Fallbacks: Vidstack, Plyr.
- Captions: faster-whisper produces English WebVTT automatically. If scripts exist, align them instead. Admin reviews and approves each caption track. Phase 2: translations (NLLB-200 or paid service), each language reviewed separately.
- Costs: about $12 to $17 per month running, about $40 to $45 to launch.

## Features
- Viewer: sign up, sign in, password reset, email verification, multiple profiles per account (Netflix style, kids-safe flag), Home with hero banner and horizontal rows, category browse, search, title detail, watch page, Continue Watching (resume position), My List, captions on/off and language, playback speed, quality menu, next episode or up next.
- Admin (`/admin`): login with roles, upload videos (resumable, direct to R2, multi-file queue), encoding status, thumbnails, titles, descriptions, categories, series and episodes, caption review and approve, publish and schedule, home page row curation, users and profiles overview, analytics (views, watch time), theme settings (colours, fonts from a curated list, sizes, logo, platform name, live preview, reset to default, contrast warning) stored as CSS variables in the database, audit log.

## Current visual direction (from the client document, all changeable from admin)
- Off-white background `#F5F5F2`, ink `#1A1C22`, muted `#5B606B`, border `#DEDDD6`, banner blue `#1F6FB5`, accent yellow `#FFC93C`.
- Home page: horizontal rows (5 cards visible on desktop), hero banner. Watch page: dark player on the off-white page, pastel up-next tiles. Admin: dark side menu.
- Existing mockup source files: `/home/claude/ad/project/*.dc.html` (Main, Watch, Admin, Home_OffWhite, Watch_OffWhite) if present, and the published canvas "Angels Delight TV: UI Mockups" (slug db86be39-a18d-464a-b6eb-94f76dff5653).

## Needs client input (keep configurable, do not hardcode)
Final colours, final domain and name, logo, content and scripts, languages, launch date, page texts, account ownership (Cloudflare, domain, VPS), rights confirmation.

## Build rules
TDD (failing test first, scoped runs only, never the full suite). Commits as ARKDEV, no AI attribution, no emojis, no em or en dashes. Follow `docs/AI-CODE-FOOTPRINT.md` and the protocols in `/home/claude/shared-protocols/docs/` (SECURITY-BASELINE, UI-UX-STANDARD, ai-context-protocol, PROJECT-DOCUMENT-CHECKLIST).
