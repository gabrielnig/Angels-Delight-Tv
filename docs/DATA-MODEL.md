# Data Model

Status: design stage. Drizzle schema in `packages/db` must match this file. RLS, triggers and grants live in hand-written SQL migrations (`drizzle-kit generate --custom`). Update this file in the same change as any schema change.

Related: `docs/ARCHITECTURE.md`, `docs/SECURITY.md`.

## 1. Conventions

- Primary keys: `uuid`, generated in the app as UUIDv7 (time ordered, good for cursor pagination), database default `gen_random_uuid()` as fallback. Exceptions noted (`bigint identity`).
- Timestamps: `timestamptz`, stored in UTC. `created_at` default `now()`. `updated_at` maintained by trigger.
- Text columns have length `CHECK`s. Enums are Postgres enums.
- Foreign keys are explicit about `ON DELETE`. Soft delete (`deleted_at`) only where noted.
- Money: none. The platform is free.
- PII columns end in `_enc` (AES-256-GCM, per-user key, see SECURITY.md section 10) or `_hash` (HMAC or SHA-256).
- Pagination: cursor based on `(sort_column, id)`. No offset queries.
- Search: Postgres full text with the `simple` configuration plus `pg_trgm`. Extensions: `pgcrypto`, `pg_trgm`, `citext`.

## 2. Databases, schemas and roles

| Database or schema | Contents | Notes |
|---|---|---|
| `ad` (schema `public`) | All tables in this file except `user_keys` | Main app database |
| `ad` (schema `pgboss`) | pg-boss tables | Managed by pg-boss. Not edited by hand |
| `ad_keys` (separate database) | `user_keys` | Separate credentials, separate backup retention |

| DB role | Used by | Privileges |
|---|---|---|
| `ad_migrator` | Deploy-time migration step only | Owns objects, DDL. Never used by a long-running container |
| `ad_app` | `apps/web` | DML on app tables. No DDL, no `BYPASSRLS`, not superuser. `audit_log`: INSERT and SELECT only |
| `ad_worker` | `apps/worker` | DML on `videos`, `renditions`, `video_keys`, `assets`, `captions`, `caption_tracks`, `jobs`, `upload_sessions`, `view_events`, `video_daily_stats`, `rate_limit_buckets`, `pgboss.*`. SELECT on `settings`. No access to `accounts`, `profiles`, `sessions`, `email_tokens`, `mfa_*`, `consents` |
| `ad_keys_app` | `apps/web` on `ad_keys` | SELECT, INSERT on `user_keys` |
| `ad_keys_shred` | `apps/worker` on `ad_keys` | DELETE only on `user_keys`, plus SELECT on the `account_id` column because a DELETE with a WHERE clause needs it |
| `ad_maintenance` | Retention prune job | SELECT, DELETE on `audit_log` and `view_events`. The only role the `audit_log` immutability trigger lets through |

Foreign key checks run as the table owner, so the worker can write rows that reference `accounts` without being granted access to it.

Roles are created by `packages/db/sql/roles.sql` (compose init and the integration tests run it). The migrations skip a grant block when its role does not exist, so they also run on a plain developer database. `ad_migrator` is a member of `ad_worker` so it can set default privileges for the tables pg-boss creates. The `pgboss` schema is created by migration 0005 and pg-boss runs with `createSchema: false`, because `ad_worker` has no CREATE on the database. `FORCE ROW LEVEL SECURITY` also binds the table owner, so `accounts` has a read-only policy for `ad_migrator` that the SECURITY DEFINER helpers (`auth_find_account`, `keep_one_active_admin`) rely on.

## 3. Enums

| Enum | Values |
|---|---|
| `account_role` | `viewer`, `editor`, `admin` |
| `account_status` | `active`, `suspended`, `deleted` |
| `video_kind` | `standalone`, `episode` |
| `video_status` | `uploading`, `uploaded`, `validating`, `encoding`, `ready`, `failed` |
| `publish_state` | `draft`, `scheduled`, `published`, `unpublished` |
| `rendition_status` | `pending`, `encoding`, `ready`, `failed` |
| `caption_source` | `whisper`, `aligned`, `manual`, `translation` |
| `caption_status` | `draft`, `in_review`, `approved`, `rejected`, `superseded` |
| `upload_kind` | `video`, `image`, `caption` |
| `upload_status` | `initiated`, `uploading`, `completing`, `completed`, `aborted`, `expired`, `failed` |
| `job_status` | `queued`, `running`, `succeeded`, `failed`, `failed_permanent`, `cancelled` |
| `row_kind` | `hero`, `curated`, `category`, `recently_added`, `continue_watching`, `my_list`, `popular` |
| `token_purpose` | `verify_email`, `reset_password`, `change_email` |
| `theme_status` | `draft`, `published`, `archived` |
| `asset_purpose` | `logo`, `favicon`, `thumbnail`, `hero`, `series_art` |
| `asset_status` | `processing`, `ready`, `failed` |

## 4. Identity and access tables

### 4.1 `accounts`

Login identity. "Users" in the UI and brief means accounts. Role lives here.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | no | | PK |
| `email_hash` | bytea | yes | | HMAC-SHA256(`EMAIL_HASH_PEPPER`, normalized email). Null only when deleted |
| `email_enc` | bytea | yes | | AES-256-GCM with the user DEK. Null only when deleted |
| `display_name_enc` | bytea | yes | | Optional, encrypted |
| `password_hash` | text | yes | | argon2id PHC string. Null when deleted |
| `role` | account_role | no | `viewer` | |
| `status` | account_status | no | `active` | |
| `email_verified_at` | timestamptz | yes | | Unverified accounts cannot create profiles or play video |
| `locale` | text | no | `en` | BCP-47, length 2 to 35 |
| `password_changed_at` | timestamptz | no | `now()` | Sessions older than this are revoked on change |
| `last_login_at` | timestamptz | yes | | |
| `suspended_reason` | text | yes | | Why staff suspended this viewer. Staff only. Set by `staff_set_account_status` |
| `suspended_at` | timestamptz | yes | | |
| `created_at`, `updated_at` | timestamptz | no | `now()` | |
| `deleted_at` | timestamptz | yes | | |

Constraints: `CHECK ((status = 'deleted') = (deleted_at IS NOT NULL))`; `CHECK (status = 'deleted' OR (email_hash IS NOT NULL AND email_enc IS NOT NULL AND password_hash IS NOT NULL))`.

Indexes: `UNIQUE (email_hash) WHERE email_hash IS NOT NULL`; `(role) WHERE role <> 'viewer'`; `(status)`; `(created_at DESC, id)` for admin listing.

Ownership and RLS: policy `accounts_self` for `ad_app`: `USING (id = current_setting('app.account_id', true)::uuid)`. Policy `accounts_admin_read` (SELECT only): `current_setting('app.actor_role', true) = 'admin'`. Role and status changes go through an admin service that sets `app.actor_role = 'admin'` and writes an audit entry. The last remaining active admin cannot be demoted, suspended or deleted (enforced in the service and by a deferred constraint trigger).

Pre-login lookups by `email_hash` use a narrow `SECURITY DEFINER` function `auth_find_account(hash)` returning only id, password hash, status, role, so the app role needs no blanket read policy.

### 4.2 `user_keys` (database `ad_keys`)

| Column | Type | Null | Notes |
|---|---|---|---|
| `account_id` | uuid | no | PK. No foreign key (different database) |
| `dek_wrapped` | bytea | no | 32 byte data key wrapped with `FIELD_KEK` (AES-256-GCM, AAD = account id) |
| `kek_version` | smallint | no | For KEK rotation |
| `created_at` | timestamptz | no | |

Deleting the row is the crypto-shredding event. No UPDATE privilege is granted except by the rotation tool role.

### 4.3 `account_deletions`

Evidence of deletion without PII.

| Column | Type | Null | Notes |
|---|---|---|---|
| `account_id` | uuid | no | PK. Opaque id |
| `requested_at` | timestamptz | no | |
| `main_data_purged_at` | timestamptz | yes | Set when relational rows are deleted |
| `dek_destroyed_at` | timestamptz | yes | Set when the keys DB row is gone |
| `backups_clear_after` | timestamptz | yes | `dek_destroyed_at` plus keys DB backup retention |

Index: `(dek_destroyed_at) WHERE dek_destroyed_at IS NULL` for the retry job.

### 4.4 `profiles`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | no | | PK |
| `account_id` | uuid | no | | FK `accounts` ON DELETE CASCADE |
| `name_enc` | bytea | no | | Encrypted display name, 1 to 30 chars before encryption |
| `avatar_id` | text | no | | Key into a fixed preset list. No user uploaded avatars |
| `is_kids` | boolean | no | false | Kids profile flag |
| `is_primary` | boolean | no | false | First adult profile of the account |
| `pin_hash` | text | yes | | argon2id of a 4 digit PIN, guards leaving a kids profile and editing profiles. A child gate, not a security boundary |
| `language` | text | no | `en` | Preferred caption language |
| `autoplay_next` | boolean | no | true | |
| `data_saver` | boolean | no | false | Caps quality at 480p |
| `position` | smallint | no | 0 | Display order |
| `created_at`, `updated_at` | timestamptz | no | `now()` | |

Constraints: `CHECK (NOT (is_primary AND is_kids))`; `CHECK (position BETWEEN 0 AND 9)`.

Indexes: `(account_id, position)`; `UNIQUE (account_id) WHERE is_primary`.

Trigger: refuse insert when the account already has `settings.limits.max_profiles` profiles (default 5), under a row lock on the account.

RLS: `profiles_owner` (`ALL`): `USING` and `WITH CHECK (account_id = current_setting('app.account_id', true)::uuid)`. Admin overview: `profiles_admin_read` (SELECT) for `app.actor_role = 'admin'`, exposed only through a DTO that omits `pin_hash`.

### 4.5 `sessions`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `account_id` | uuid | no | FK `accounts` ON DELETE CASCADE |
| `token_hash` | bytea | no | SHA-256 of a 256-bit random token. The raw token only exists in the cookie |
| `created_at` | timestamptz | no | |
| `last_seen_at` | timestamptz | no | Updated at most once per 10 minutes |
| `idle_expires_at` | timestamptz | no | Viewer 30 days, staff 60 minutes, sliding |
| `absolute_expires_at` | timestamptz | no | Viewer 90 days, staff 8 hours |
| `revoked_at` | timestamptz | yes | |
| `mfa_verified_at` | timestamptz | yes | Required for staff sessions |
| `reauth_at` | timestamptz | yes | Last password confirmation, sensitive actions need under 10 minutes |
| `ip_trunc` | text | yes | IPv4 /24 or IPv6 /48 |
| `user_agent` | text | yes | Truncated to 200 chars |

Indexes: `UNIQUE (token_hash)`; `(account_id) WHERE revoked_at IS NULL`; `(absolute_expires_at)`.

RLS: none. Accessed only by the session module, which looks up by token hash before an account is known.

### 4.6 `email_tokens`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `account_id` | uuid | no | FK CASCADE |
| `purpose` | token_purpose | no | |
| `token_hash` | bytea | no | SHA-256 of a 256-bit random token |
| `new_email_enc` | bytea | yes | For `change_email` only |
| `new_email_hash` | bytea | yes | For `change_email` only |
| `expires_at` | timestamptz | no | Verify 24 h, reset 30 min, change 1 h |
| `used_at` | timestamptz | yes | Single use |
| `created_at` | timestamptz | no | |
| `ip_trunc` | text | yes | |

Indexes: `UNIQUE (token_hash)`; `(account_id, purpose) WHERE used_at IS NULL`. Issuing a new token for the same purpose marks older ones used.

### 4.7 `consents`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `account_id` | uuid | no | FK CASCADE |
| `kind` | text | no | `terms`, `privacy`, `guardian_declaration` |
| `version` | text | no | Matches `settings` legal versions |
| `granted_at` | timestamptz | no | |
| `revoked_at` | timestamptz | yes | |
| `ip_trunc` | text | yes | |

Constraint: `UNIQUE (account_id, kind, version)`. `guardian_declaration` records that the account holder is 18 or over and takes responsibility for any kids profiles.

### 4.8 `mfa_factors` and `mfa_recovery_codes`

`mfa_factors`: `id`, `account_id` (FK CASCADE), `type` (`totp`), `secret_enc` bytea (user DEK), `confirmed_at`, `last_used_step` bigint (replay guard), `created_at`. `UNIQUE (account_id, type)`.

`mfa_recovery_codes`: `id`, `account_id` (FK CASCADE), `code_hash` bytea (SHA-256 of a 80-bit code), `used_at`, `created_at`. Index `(account_id) WHERE used_at IS NULL`. Ten codes issued at enrollment. Required for `editor` and `admin`.

### 4.9 `rate_limit_buckets` (UNLOGGED)

| Column | Type | Notes |
|---|---|---|
| `key` | text | PK, for example `login:ip:203.0.113.0` or `login:acct:{hash}` |
| `tokens` | double precision | Remaining tokens |
| `updated_at` | timestamptz | Refill reference |

Index `(updated_at)` for cleanup. Consumed with one atomic `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` that refills by elapsed time, subtracts one, and reports allowed or denied. Data loss on crash is acceptable. No PII in keys beyond truncated IP and hashes.

## 5. Content tables

### 5.1 `videos`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | no | | PK |
| `slug` | text | no | | Lowercase, `^[a-z0-9]+(-[a-z0-9]+)*$`, 3 to 120 chars |
| `title` | text | no | | 1 to 200 chars |
| `description` | text | yes | | Up to 5000 chars, plain text |
| `kind` | video_kind | no | `standalone` | |
| `status` | video_status | no | `uploading` | Processing state |
| `publish_state` | publish_state | no | `draft` | |
| `publish_at` | timestamptz | yes | | Required when `scheduled` |
| `published_at` | timestamptz | yes | | Set on first publish |
| `kids_safe` | boolean | no | false | Kids profiles only see true |
| `language` | text | no | `en` | Spoken language |
| `duration_ms` | integer | yes | | Set after probe |
| `width`, `height` | smallint | yes | | Source dimensions |
| `original_key` | text | yes | | Key in originals bucket |
| `original_bytes` | bigint | yes | | |
| `original_sha256` | bytea | yes | | |
| `media_prefix` | text | no | | 128-bit random, unguessable path part. UNIQUE |
| `poster_asset_id` | uuid | yes | | FK `assets` ON DELETE SET NULL |
| `hero_asset_id` | uuid | yes | | FK `assets` ON DELETE SET NULL |
| `failure_code` | text | yes | | Machine code for `failed` |
| `failure_message` | text | yes | | Readable, sanitized |
| `tags` | text[] | no | `{}` | At most 10. Editor tags, admin only |
| `suitability` | text | yes | | `everyone`, `kids` or `older`. `kids_safe` is true for `kids` and `everyone` |
| `caption_override_reason` | text | yes | | Set when an admin published without approved captions |
| `poster_focus` | jsonb | yes | | `{x, y, zoom}` in percent (zoom 100 to 200) chosen in the poster picker |
| `created_by` | uuid | yes | | FK `accounts` ON DELETE SET NULL |
| `created_at`, `updated_at` | timestamptz | no | `now()` | |
| `deleted_at` | timestamptz | yes | | Soft delete, purged after 30 days |
| `search_tsv` | tsvector | no | generated | `to_tsvector('simple', title || ' ' || coalesce(description,''))` |

Constraints:
- `CHECK (publish_state <> 'scheduled' OR publish_at IS NOT NULL)`.
- `CHECK (publish_state NOT IN ('scheduled','published') OR status = 'ready')`.
- `CHECK (status <> 'ready' OR (duration_ms IS NOT NULL AND duration_ms > 0))`. The explicit `IS NOT NULL` matters: a NULL duration makes `duration_ms > 0` NULL and a CHECK treats NULL as passing.
- `UNIQUE (id, kind)` so `episodes` can pin the kind with a composite FK.
- `UNIQUE (slug) WHERE deleted_at IS NULL`.

Indexes: `(publish_state, published_at DESC, id)`; `GIN (search_tsv)`; `GIN (title gin_trgm_ops)`; `(status) WHERE status <> 'ready'`; `(created_at DESC, id)`.

Visibility predicate (single shared SQL fragment, `visibleVideos(profile)`): `deleted_at IS NULL AND status = 'ready' AND (publish_state = 'published' OR (publish_state = 'scheduled' AND publish_at <= now())) AND (NOT profile.is_kids OR kids_safe)`.

Ownership: catalog data is global. Writes require role `editor` or `admin` (service layer, audited). Viewers only read through the visibility predicate. No RLS needed.

### 5.2 `video_keys`

| Column | Type | Null | Notes |
|---|---|---|---|
| `video_id` | uuid | no | PK, FK `videos` ON DELETE CASCADE |
| `key_wrapped` | bytea | no | 16 byte AES key wrapped with `HLS_KEK` (AES-256-GCM, AAD = video id) |
| `kek_version` | smallint | no | |
| `created_at` | timestamptz | no | |
| `rotated_at` | timestamptz | yes | Set by `video.rekey` |

Read by the key endpoint (web) and written by the worker. Never selected by list queries or admin DTOs.

### 5.3 `renditions`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `video_id` | uuid | no | FK `videos` ON DELETE CASCADE |
| `height` | smallint | no | 144 to 2160, normally 360, 480, 720, 1080 |
| `width` | smallint | no | |
| `video_kbps` | integer | no | Target cap |
| `audio_kbps` | integer | no | |
| `bandwidth_bps` | integer | yes | Peak, for `BANDWIDTH` |
| `avg_bandwidth_bps` | integer | yes | For `AVERAGE-BANDWIDTH` |
| `codecs` | text | yes | For example `avc1.4d401e,mp4a.40.2` |
| `segment_count` | integer | yes | |
| `segment_seconds` | numeric(4,2) | no | Default 6.00 |
| `total_bytes` | bigint | yes | |
| `template_key` | text | yes | Variant playlist template in originals bucket |
| `status` | rendition_status | no | `pending` |
| `error_message` | text | yes | |
| `created_at`, `updated_at` | timestamptz | no | |

Constraints: `UNIQUE (video_id, height)`. Index: `(video_id)`.

### 5.4 `assets`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `purpose` | asset_purpose | no | |
| `status` | asset_status | no | `processing` |
| `raw_key` | text | yes | Uploaded file in originals bucket |
| `media_key_base` | text | yes | Base of generated variants in media bucket, for example `img/{id}/` |
| `variants` | jsonb | no | Array of `{width, height, key, bytes}`, validated by Zod. Default `[]` |
| `mime` | text | no | `image/webp`, `image/jpeg` or `image/png` only |
| `bytes` | integer | yes | |
| `width`, `height` | integer | yes | |
| `sha256` | bytea | yes | |
| `placeholder_color` | text | yes | Hex, for skeleton and layout stability |
| `alt_text` | text | yes | Up to 200 chars |
| `created_by` | uuid | yes | FK `accounts` ON DELETE SET NULL |
| `created_at` | timestamptz | no | |

Indexes: `(purpose, created_at DESC)`; `(sha256)`. SVG is not an allowed type.

### 5.5 `series`, `seasons`, `episodes`

`series`: `id`, `slug`, `title`, `description`, `kids_safe`, `poster_asset_id` and `hero_asset_id` (FK SET NULL), `publish_state`, `publish_at`, `published_at`, `created_by` (SET NULL), timestamps, `deleted_at`, `search_tsv`. Same checks and indexes pattern as `videos` (partial unique slug, GIN on `search_tsv`).

`seasons`: `id`, `series_id` (FK `series` CASCADE), `number` smallint (>= 1), `title` nullable. `UNIQUE (series_id, number)`.

`episodes`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `season_id` | uuid | FK `seasons` ON DELETE CASCADE |
| `video_id` | uuid | FK `videos`, `UNIQUE`, a video belongs to at most one episode |
| `video_kind` | video_kind | `CHECK (video_kind = 'episode')`, composite FK `(video_id, video_kind)` to `videos (id, kind)` |
| `number` | smallint | >= 1 |

Constraint: `UNIQUE (season_id, number)`. Index: `(season_id, number)`.

A series is visible to a profile if it is published and, for kids profiles, `kids_safe`. An episode is playable only if its video is visible and its series is visible.

### 5.6 `categories`, `video_categories`, `series_categories`

`categories`: `id`, `slug` (UNIQUE, same pattern as videos), `name` (1 to 60, UNIQUE case-insensitive via `citext`), `description`, `position` int, `is_visible` boolean default true, timestamps. Index `(position)`.

`video_categories`: `(video_id, category_id)` PK, both FKs ON DELETE CASCADE. Index `(category_id, video_id)`.

`series_categories`: same shape for `series`.

Kids browsing shows a category only if it contains at least one visible kids-safe title.

### 5.7 `rows` and `row_items` (home page curation)

`rows`:

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | no | | PK |
| `title` | text | no | | 1 to 80 |
| `kind` | row_kind | no | `curated` | `hero` holds 1 to 5 rotating banner items |
| `category_id` | uuid | yes | | FK `categories` ON DELETE SET NULL. Required when `kind = 'category'` (CHECK) |
| `position` | integer | no | | `UNIQUE (position) DEFERRABLE INITIALLY DEFERRED`, reorder in one transaction |
| `is_published` | boolean | no | false | |
| `kids_visible` | boolean | no | false | Row appears on kids profiles, items are still filtered by `kids_safe` |
| `max_items` | smallint | no | 20 | `CHECK (max_items BETWEEN 1 AND 50)` |
| `created_at`, `updated_at` | timestamptz | no | `now()` | |

`row_items`: `id`, `row_id` (FK CASCADE), `position` int, `video_id` (FK CASCADE, nullable), `series_id` (FK CASCADE, nullable). Constraints: `CHECK (num_nonnulls(video_id, series_id) = 1)`; `UNIQUE (row_id, position) DEFERRABLE INITIALLY DEFERRED`; `UNIQUE (row_id, video_id) WHERE video_id IS NOT NULL`; `UNIQUE (row_id, series_id) WHERE series_id IS NOT NULL`. Index `(row_id, position)`.

Kinds `continue_watching`, `my_list`, `recently_added` and `popular` have no `row_items`. They are computed per profile or globally. `popular` reads `video_daily_stats`.

## 6. Captions

### 6.1 `caption_tracks`

One track per video and language.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `video_id` | uuid | no | FK `videos` ON DELETE CASCADE |
| `language` | text | no | BCP-47, for example `en`, `yo`, `ig`, `ha`, `pcm` |
| `label` | text | no | Shown in the menu, 1 to 40 |
| `kind` | text | no | `captions` or `subtitles` |
| `is_default` | boolean | no | false |
| `approved_caption_id` | uuid | yes | FK `captions` ON DELETE SET NULL, deferrable (circular) |
| `created_at` | timestamptz | no | |

Constraints: `UNIQUE (video_id, language)`; `UNIQUE (video_id) WHERE is_default`. Viewers see a track only when `approved_caption_id IS NOT NULL`.

### 6.2 `captions` (revisions)

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `track_id` | uuid | no | FK `caption_tracks` ON DELETE CASCADE |
| `revision` | integer | no | Starts at 1 |
| `source` | caption_source | no | |
| `status` | caption_status | no | `draft` |
| `storage_key` | text | no | Draft file in originals bucket |
| `public_key` | text | yes | Copy in media bucket, set on approval |
| `sha256` | bytea | no | |
| `bytes` | integer | no | Max 1 MiB |
| `cue_count` | integer | no | |
| `model` | text | yes | Whisper model and version, or alignment tool |
| `created_by` | uuid | yes | FK `accounts` SET NULL, null for machine output |
| `reviewed_by` | uuid | yes | FK `accounts` SET NULL |
| `reviewed_at` | timestamptz | yes | |
| `review_note` | text | yes | |
| `created_at` | timestamptz | no | |

Constraints: `UNIQUE (track_id, revision)`; `CHECK (status <> 'approved' OR (reviewed_by IS NOT NULL AND public_key IS NOT NULL))`. Index `(track_id, status)`. Approving a revision marks the previous approved one `superseded` in the same transaction.

## 7. Viewer activity tables

### 7.1 `watch_progress`

| Column | Type | Null | Notes |
|---|---|---|---|
| `profile_id` | uuid | no | FK `profiles` ON DELETE CASCADE |
| `video_id` | uuid | no | FK `videos` ON DELETE CASCADE |
| `position_ms` | integer | no | `CHECK (position_ms >= 0)` |
| `duration_ms` | integer | no | Snapshot at write time |
| `completed` | boolean | no | True when position is 95 percent or more, or fewer than 10 seconds remain |
| `completed_at` | timestamptz | yes | |
| `updated_at` | timestamptz | no | Client supplied timestamp, clamped to server `now()` |

PK `(profile_id, video_id)`. Index `(profile_id, updated_at DESC) WHERE completed = false` for Continue Watching. Write is an upsert guarded by `WHERE watch_progress.updated_at < EXCLUDED.updated_at` so stale tabs cannot overwrite newer progress.

RLS: `watch_progress_owner` (`ALL`): `USING` and `WITH CHECK (owns_profile(profile_id))` where `owns_profile` is a `SECURITY DEFINER`, `STABLE` function checking `profiles.account_id = current_setting('app.account_id', true)::uuid`. The service additionally checks that the video is visible to the profile before writing.

### 7.2 `my_list`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `profile_id` | uuid | no | FK `profiles` ON DELETE CASCADE |
| `video_id` | uuid | yes | FK `videos` ON DELETE CASCADE |
| `series_id` | uuid | yes | FK `series` ON DELETE CASCADE |
| `added_at` | timestamptz | no | |

Constraints: `CHECK (num_nonnulls(video_id, series_id) = 1)`; `UNIQUE (profile_id, video_id) WHERE video_id IS NOT NULL`; `UNIQUE (profile_id, series_id) WHERE series_id IS NOT NULL`. Index `(profile_id, added_at DESC, id)`. RLS identical to `watch_progress`. Max 200 items per profile (service check).

### 7.3 `view_events` and `video_daily_stats`

`view_events`:

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | bigint identity | no | PK |
| `play_id` | uuid | no | Client generated, `UNIQUE`, dedupes retries |
| `video_id` | uuid | no | FK `videos` ON DELETE CASCADE |
| `profile_id` | uuid | yes | FK `profiles` ON DELETE SET NULL. Always null for kids profiles |
| `audience` | text | no | `general` or `kids` |
| `started_at` | timestamptz | no | |
| `watched_ms` | integer | no | |
| `completed` | boolean | no | |
| `max_height` | smallint | yes | Highest rung played |
| `country` | char(2) | yes | From `CF-IPCountry`. No IP stored |

Indexes: `(video_id, started_at)`; `(started_at)`. Raw rows pruned after 24 months.

`video_daily_stats`: PK `(video_id, day)`, columns `views` int, `watch_ms` bigint, `completions` int, `updated_at`. Written by the nightly rollup. Admin analytics read only this table plus today's raw rows.

## 8. Platform tables

### 8.1 `theme_settings`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `status` | theme_status | no | |
| `version` | integer | no | Monotonic |
| `tokens` | jsonb | no | Validated by the `ThemeTokens` Zod schema. `CHECK (pg_column_size(tokens) < 16384)` |
| `logo_asset_id`, `favicon_asset_id` | uuid | yes | FK `assets` SET NULL |
| `created_by` | uuid | yes | FK `accounts` SET NULL |
| `created_at` | timestamptz | no | |
| `published_at` | timestamptz | yes | |

Indexes: `UNIQUE (status) WHERE status = 'published'`; `UNIQUE (status) WHERE status = 'draft'`; `UNIQUE (version)`.

Tokens hold only: colours as hex (`#RRGGBB`), font family keys from a curated allowlist, size scale numbers within bounds, radius, spacing density. Never raw CSS. The server renders them into CSS variables with a nonce. Publishing archives the previous published row. Reset to default creates a new draft from code defaults. Server returns WCAG contrast ratios and warnings for text on background pairs.

### 8.2 `settings`

| Column | Type | Null | Notes |
|---|---|---|---|
| `key` | text | no | PK, `^[a-z][a-z0-9_.]{1,63}$` |
| `value` | jsonb | no | Validated per key by a Zod registry |
| `description` | text | yes | |
| `is_public` | boolean | no | Exposed to the client through the public settings DTO |
| `updated_by` | uuid | yes | FK `accounts` SET NULL |
| `updated_at` | timestamptz | no | |

Known keys: `platform.name`, `platform.tagline`, `platform.canonical_host`, `features.signups_open`, `features.require_approved_captions`, `limits.max_profiles`, `limits.upload_max_bytes`, `content.default_language`, `content.languages`, `legal.terms_version`, `legal.privacy_version`, `analytics.raw_retention_days`. Secrets are never stored here.

### 8.3 `audit_log`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | bigint identity | no | PK |
| `occurred_at` | timestamptz | no | Default `now()` |
| `actor_account_id` | uuid | yes | No FK, survives account deletion as an opaque id. Null for anonymous attempts |
| `actor_role` | text | yes | |
| `action` | text | no | Namespaced, for example `auth.login.failed`, `video.publish` |
| `target_type` | text | yes | |
| `target_id` | text | yes | |
| `outcome` | text | no | `success`, `denied`, `failure` |
| `ip_trunc` | text | yes | |
| `request_id` | text | yes | |
| `metadata` | jsonb | no | Per-action schema, no PII, no secrets. Default `{}` |

Indexes: `(occurred_at DESC)`; `(actor_account_id, occurred_at DESC)`; `(action, occurred_at DESC)`; `(target_type, target_id)`.

Immutability: `ad_app` has INSERT and SELECT only. A trigger raises on UPDATE, DELETE and TRUNCATE for every role except the maintenance role used for the 24 month retention prune. Admin UI reads only.

## 9. Pipeline tables

### 9.1 `upload_sessions`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `kind` | upload_kind | no | |
| `video_id` | uuid | yes | FK `videos` ON DELETE SET NULL |
| `asset_id` | uuid | yes | FK `assets` ON DELETE SET NULL |
| `created_by` | uuid | no | FK `accounts` ON DELETE CASCADE |
| `filename` | text | no | Sanitized display name, up to 255, never used as a key |
| `declared_mime` | text | no | Allowlisted |
| `size_bytes` | bigint | no | `CHECK (size_bytes > 0 AND size_bytes <= 17179869184)` |
| `part_size_bytes` | integer | no | At least 5 MiB |
| `total_parts` | integer | no | `CHECK (total_parts BETWEEN 1 AND 10000)` |
| `storage_key` | text | no | |
| `s3_upload_id` | text | no | |
| `fingerprint` | text | no | Hash of name, size, last modified |
| `status` | upload_status | no | `initiated` |
| `error_message` | text | yes | |
| `created_at` | timestamptz | no | |
| `expires_at` | timestamptz | no | Default created plus 48 h, extended on activity |
| `completed_at` | timestamptz | yes | |

Indexes: `UNIQUE (created_by, fingerprint) WHERE status IN ('initiated','uploading')`; `(status, expires_at)`. Part state is not stored. `ListParts` on the bucket is authoritative.

RLS: not used. Service enforces `created_by = actor` for editors and allows admins everything.

### 9.2 `jobs`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `queue` | text | no | pg-boss queue name |
| `boss_job_id` | uuid | yes | |
| `video_id` | uuid | yes | FK `videos` ON DELETE CASCADE |
| `asset_id` | uuid | yes | FK `assets` ON DELETE CASCADE |
| `status` | job_status | no | `queued` |
| `stage` | text | yes | For example `encode:720` |
| `progress` | smallint | no | 0 to 100 |
| `attempts` | smallint | no | 0 |
| `error_code` | text | yes | |
| `error_message` | text | yes | Sanitized, no file system paths |
| `created_by` | uuid | yes | FK `accounts` SET NULL |
| `created_at` | timestamptz | no | |
| `started_at`, `finished_at` | timestamptz | yes | |

Indexes: `(video_id, created_at DESC)`; `(status, created_at) WHERE status IN ('queued','running','failed')`; `UNIQUE (queue, video_id) WHERE status IN ('queued','running') AND video_id IS NOT NULL`.

## 10. Row level security summary

| Table | RLS | Rule |
|---|---|---|
| `accounts` | on, forced | Self by `app.account_id`, admin read by `app.actor_role` |
| `profiles` | on, forced | Owner by `account_id`, admin read-only DTO |
| `watch_progress` | on, forced | `owns_profile(profile_id)` |
| `my_list` | on, forced | `owns_profile(profile_id)` |
| `sessions`, `email_tokens`, `mfa_*`, `consents` | off | Reached only by dedicated modules with narrow queries, never by user-supplied ids |
| Catalog, pipeline, platform tables | off | Role checks in the service layer |

Fail closed: `current_setting('app.account_id', true)` returns NULL when never set, and an empty string on a pooled connection after an earlier transaction set it, so policies read the context through `app_account_id()` and `app_actor_role()`, which map the empty string to NULL. An unset context therefore matches no rows and never raises a cast error. `withAccount()` sets values with `set_config(name, value, true)` (transaction scoped), which is safe with connection pooling. Tests in TESTING.md assert that a connection without context sees zero rows and that account A cannot read or write account B rows.

## 11. Deletion and retention

| Data | Retention | On account deletion |
|---|---|---|
| `accounts`, `profiles`, `watch_progress`, `my_list`, `sessions`, `email_tokens`, `mfa_*`, `consents` | Life of account | Deleted. `accounts` row kept as a tombstone (hash, ciphertext and password nulled) |
| `user_keys` | Life of account | Deleted, the shredding step. Key DB backups kept 14 days |
| `view_events` | 24 months | `profile_id` set null |
| `audit_log` | 24 months | Kept, holds opaque account id and no PII |
| `rate_limit_buckets` | 1 day idle | n/a |
| Soft-deleted videos | 30 days then purged with storage | n/a |
| `upload_sessions` | 30 days after completion | Cascade by creator |
