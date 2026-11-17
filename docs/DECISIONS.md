# Decisions Log

Format: decision, options considered, why, reversible or not. Newest first. Decisions that need the owner are decided here with the recommended option, then flagged for confirmation.

## D-001 Commit identity and merge style
- Decision: all commits authored and committed as ARKDEV, PRs merged with rebase merge so each commit keeps its author.
- Options: squash merge, merge commit, rebase merge.
- Why: squash and merge commits are authored by the token owner on GitHub, which breaks the ARKDEV rule. Verify after the first PR.
- Reversible: yes.

## D-002 Dummy content until the client supplies videos
- Decision: seed placeholder titles and generated sample clips so every screen can be built and tested.
- Why: content is a client dependency.
- Reversible: yes.

## D-003 Brand tokens
- Decision: document colours (off-white `#F5F5F2`, ink `#1A1C22`, banner blue `#1F6FB5`, accent yellow `#FFC93C`) are default theme values stored in the database and overridable from admin.
- Reversible: yes.

## D-004 Playback and account defaults
- Decision: resume 3 seconds back, ignore progress under 5 seconds, finished at 95 percent or 10 seconds left. Up to 5 profiles per account. Lockout after 5 failures in 15 minutes for 15 minutes (admin: 3 failures, 30 minutes).
- Why: sensible defaults from PRD section 8, all configurable. Reversible: yes.

## D-005 Captions gate and admin roles
- Decision: an approved caption track is required to publish (Admin can override with a reason). Roles: Super admin, Admin, Editor, Analyst, all with TOTP 2FA.
- Reversible: yes.

## D-006 Upload limits
- Decision: 8 MB parts, 3 in parallel, 5 GB per file, 2 files at once.
- Reversible: yes.

## D-007 Design system choices
- Decision: yellow is never text on light surfaces (1.41:1). Input border `#8A8D94` (3.04:1). No hover video previews and a still hero image for low data. Fonts limited to Inter, DM Sans, Poppins, Nunito, Lora, self-hosted. Theme editor blocks saving when text fails 4.5:1.
- Reversible: yes.

## D-008 Engineering defaults
- Decision: custom database-backed sessions (not Auth.js); argon2id; mandatory TOTP for staff roles; Postgres token-bucket rate limiting (no Redis); pg-boss queue; one S3 driver for R2 and MinIO plus a local driver for tests; three buckets (originals, media, backups).
- Reversible: moderate cost for auth, cheap for the rest.

## D-009 Video delivery
- Decision: HLS MPEG-TS, 6 second segments, AES-128 with one key per video wrapped by `HLS_KEK`; playlists served by the app, segments through a Cloudflare Worker with HMAC signed URLs; stateless playback token, 30 minute life.
- Why: DRM-free protection that works with the free Cloudflare plan for the first stage (about 1,200 plays per day before the paid Workers plan).
- Reversible: yes.

## D-010 Captions and data lifecycle
- Decision: faster-whisper small.en as a separate service; captions stored as revisions needing approval; per-user keys in a separate keys database, email stored as HMAC lookup hash plus ciphertext; fail-closed row level security on accounts, profiles, watch_progress, my_list.
- Reversible: yes.

## D-011 TLS minimum
- Decision: Cloudflare TLS 1.3 enabled with minimum 1.2, so older Android devices keep working.

## D-012 Test running in CI
- Decision: CI runs only tests affected by the PR (`vitest run --changed origin/main`). The nightly full-suite job is NOT enabled for now, to respect the rule of never running the full suite. Reconsider with the owner before launch.
- Reversible: yes.

## D-013 Self-healing pipeline
- Decision: advisory only. A human applies fixes and commits as ARKDEV.
