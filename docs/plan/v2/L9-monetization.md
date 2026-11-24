# L9 Monetization plan (module M48: Sponsors and Donations)

Status: PLANNING pass, docs only. Date: 24 November 2026. Branch `plan/L9-monetization`. Nothing here is built. Everything below ships OFF by default and is switched on from admin by Sister Vanessa (or ARKDEV on her behalf).

Evidence base: `docs/audits/2026-11-24-netflix-rea-audit.md` (sections 3, 4, 5), `CLAUDE.md`, `docs/PRD.md`, `docs/MODULES.md`, `docs/USER-STORIES.md`, `docs/SECURITY.md`, `docs/DESIGN-SYSTEM.md`, the `angels-delight-design-system` skill, `packages/analytics`, `packages/mailer`, `packages/queue`, `packages/db`.

## 0. Findings that shape the plan

1. No monetization module exists. MODULES.md ends at M36 and the other v2 lanes own their own numbers. M48 is new. Nothing in the current stories mentions sponsors or donations.
2. Four current documents say the opposite of this lane and must be amended in slice 0 (not in this planning pass):
   - `docs/PRD.md` section 4: "No subscriptions, payments, plans, coupons or ads." Amend to: no subscriptions to watch, no paywall, no third-party ads. Optional labelled sponsor slots and optional donations are allowed, off by default.
   - `docs/PRD.md` section 12: "No payment processing and therefore no PCI scope." Amend: card data never touches our servers (hosted Paystack checkout), so PCI scope stays at SAQ A level at most.
   - `docs/SECURITY.md` section 12: "No advertising, no third-party trackers." Amend: first-party sponsor cards only, no third-party scripts, never on kids profiles or kids mode. The CSP stays unchanged (no new script or frame origin).
   - `docs/DESIGN-SYSTEM.md` last rule: "Don't add payment, subscription, ad or upsell UI." Amend: "Don't add payment, subscription, ad or upsell UI except the labelled sponsor slots and the Donate page defined in M48. Never on kids profiles."
3. The CSP has `form-action 'self'`, `connect-src 'self' {MEDIA_ORIGIN}` and no third-party `script-src`. The Paystack Popup (inline JS from `js.paystack.co`) would break the "no third party scripts" rule. Decision: use Paystack hosted checkout by redirect. Our server initializes the transaction, the browser navigates to the returned `authorization_url`. No CSP change, no card data on our servers, no script from Paystack on our pages.
4. `Permissions-Policy: payment=()` only governs the Payment Request API inside our pages. A top-level redirect to Paystack is unaffected. Leave it as is.
5. Analytics today are first party and anonymous: `POST /api/analytics`, batches of up to 50 validated events (`packages/analytics/src/events.ts`), daily rotating `viewerHash`, `audience = kids` stores no profile, bots dropped, admin preview batches dropped. Sponsor impressions and clicks reuse this pipeline and these rules.
6. Guest access (lane L1) makes anonymous viewers the norm. Donations and sponsor frequency caps must therefore work with no account.
7. Payment provider facts below (fees, minimums, header names, event names, USD enablement) are from general knowledge of the Paystack API and must be re-checked against current Paystack documentation in slice 7 before any code is written. They are marked [VERIFY].

## 1. Scope

### In scope (Must and Should)

Sponsors:
- Four placements, each with its own enable switch plus a master switch: Home banner between rows, Title page card, message card after a video, message card before a video.
- Sponsors admin area: create sponsor, upload creative, set link, schedule, choose placements, status, preview.
- Scheduling with start and end dates (Africa/Lagos), frequency caps, rotation.
- First party impression and click tracking, no third-party scripts, no cookies that identify a person.
- Hard rule: never shown on kids profiles, kids mode, or when the site audience is kids. Always labelled "Sponsored".
- Sponsor report: impressions, clicks, click rate, daily reach, by creative and placement, date range, CSV, printable summary that can be saved as PDF from the browser.

Donations:
- `/donate` page and a Donate button (header, footer, end of video card, account menu), Paystack hosted checkout, NGN first.
- Amount presets and custom amount, one time and optional monthly.
- Email receipt, webhook with signature check, idempotency, reconciliation job, secrets as env, test mode, thank you page, cancelled page.
- Guests can donate with just an email.
- Transparency page option ("How donations are used") fully admin edited.
- Admin donations list, export, refund and failure handling.
- NDPA notes, retention, owner handover pack of legal and tax questions (section 9).

### In scope as Could

- Flutterwave adapter behind the same provider interface.
- Bank transfer instructions with manual donation entry.
- USD checkout for diaspora (conditions in section 8).
- Donor wall is explicitly NOT planned (privacy, kids, moderation).

### Out of scope (Won't)

- Paywalls, subscriptions to watch, premium tiers, pay per view.
- Third-party ad networks, programmatic ads, video ads, pre-roll that plays video, tracking pixels from sponsors, sponsor-supplied HTML or scripts.
- Storing card numbers, CVV, bank logins. Apple Pay and Google Pay beyond what Paystack hosted checkout offers.
- Tax receipts with legal effect (only an acknowledgement unless the owner's organisation is registered and counsel agrees, see section 9).
- Sponsor self-service portal (sponsors get a PDF or CSV from the admin). Could later.

## 2. Architecture

New packages, following the lane A layout (`packages/*`, scoped tests with `pnpm vitest run <path>`):

- `packages/sponsors` (`@ad/sponsors`): domain types, eligibility and selection, frequency cap logic, status derivation, report queries, CSV builder.
- `packages/payments` (`@ad/payments`): `PaymentProvider` interface, `paystack` adapter, signature verification, donation service, webhook event processor, receipt builder.

Edits to shared code, kept small and additive:
- `packages/analytics`: two new event kinds and counters (slice 3).
- `packages/config`: new settings keys and env validation (slice 0, 7).
- `packages/queue`: new queues (slice 8, 11).
- `packages/mailer`: new templates `donation_receipt`, `donation_manage_link`, `donation_failed` (slice 9, 10).
- `packages/db`: new migrations, schema files `sponsors.ts` and `donations.ts`.
- `apps/web`: routes, admin screens, viewer components (own folders only).
- `packages/ui`: `SponsorCard`, `SponsorBanner`, `SponsorMessageCard`, `DonateAmountPicker` (own files, exported through the existing index).

Request flows:

Sponsor display. The server component for Home, Title and Watch calls `selectSponsor({ slot, audience, now, capCookie, saveData })` from `@ad/sponsors`. It returns one creative or null. It always returns null when `audience` is `kids`, when the master switch or the placement switch is off, or when no sponsor is live. The result is rendered on the server with its box size reserved, so there is no layout shift. The client component only reports impressions and handles dismiss and skip.

Sponsor click. The card link is a plain anchor to `/s/{creativeId}` on our own origin (`rel="sponsored noopener noreferrer"`, `target="_blank"` optional per setting). The route records a click and replies 302 to the stored https destination. The destination is read from the database by id, never from the query string, so there is no open redirect. Kids audience gets 404 and nothing is recorded.

Sponsor impression. A viewable impression is 50 percent of the card in view for 1 second (IntersectionObserver, client side), sent as a `sponsor_impression` event in the existing analytics batch. Deduplicated per page view by `impressionId`.

Frequency capping. A first party, functional cookie `ad_spc` holds a compact map `{creativeId: [day, count]}` (no identifier, Lagos day, max 20 entries, 1 day max age, SameSite Lax, Secure). The server reads it when choosing a creative, so a capped slot is simply not rendered (no collapse, no shift). The cookie is written by the impression endpoint response, and never read or set for kids audience. Per session caps for the player cards use `sessionStorage` on the client plus the same server check.

Donations. `/donate` (server rendered form) posts via `fetch` to `POST /api/donate/checkout`. The route validates the body with a strict Zod schema, creates a `donations` row with status `pending` and a unique `reference`, calls Paystack Initialize Transaction, and returns `{ url }`. The client sets `window.location` to the url (a navigation, not a form post, so `form-action 'self'` is untouched). Paystack redirects the donor to `/donate/thank-you?reference=...`. That page never trusts the query: it asks the server to verify the reference with Paystack and shows the real status. The webhook `POST /api/webhooks/paystack` is the source of truth for marking a donation paid.

Webhook handling order (security critical): read raw body bytes, compute HMAC SHA512 with `PAYSTACK_SECRET_KEY`, constant-time compare to header `x-paystack-signature` [VERIFY], reject 401 on mismatch or missing header before any JSON parsing, insert the event into `payment_events` with `ON CONFLICT DO NOTHING` on `(provider, event_key)`, enqueue `donations.process_event`, return 200 within a few hundred ms. Processing re-verifies the transaction with Paystack (`GET /transaction/verify/:reference`) and checks amount and currency before marking paid.

Role and RLS notes:
- New roles are not needed. `ad_app` gets DML on the sponsor tables and `donations`, `payment_events` (INSERT, SELECT, UPDATE). `ad_worker` gets DML on `sponsor_daily_stats`, SELECT on `sponsors*`, DML on `donations`, `payment_events`, plus SELECT on `settings`. Add both grants in the migration with the same "skip when role missing" guard used by 0006 and 0033.
- Sponsor tables hold no personal data. RLS is enabled and forced anyway, with policies: staff roles (`editor`, `admin`, `super_admin`) full access; anonymous and viewer context read only rows where status is live, inside the schedule window, and the table is `sponsors`, `sponsor_creatives` or `sponsor_placements`. Public selection runs under a read-only policy so a bug cannot leak drafts.
- `donations` holds personal data. RLS forced: `admin` and `super_admin` read all; `editor` has no access; a signed-in viewer reads only rows where `account_id` equals their account (for a future "my donations" list, Could); guests have no direct read at all (the thank you page uses a server function with the reference plus a signed `receipt token`, see slice 9). Donor email and name are encrypted fields (`donor_email_enc`, `donor_name_enc`) using the existing `FIELD_KEK` pattern, with `donor_email_hash` (HMAC) for lookups and rate limits.
- `payment_events` holds raw webhook JSON that includes the donor email. Payload column is encrypted with the same field key and pruned after 90 days (configurable).

## 3. Configuration (all off by default)

Settings registry keys (table `settings`, Zod registry in `@ad/config`). Secrets never live here.

| Key | Type | Default | Public | Notes |
|---|---|---|---|---|
| `sponsors.enabled` | bool | false | yes | Master switch |
| `sponsors.placement.home_banner.enabled` | bool | false | yes | |
| `sponsors.placement.title_card.enabled` | bool | false | yes | |
| `sponsors.placement.player_after.enabled` | bool | false | yes | |
| `sponsors.placement.player_before.enabled` | bool | false | yes | |
| `sponsors.home_banner.after_row` | int 1 to 8 | 3 | yes | Show after the Nth row, never above the first two |
| `sponsors.player_before.seconds` | int 3 to 10 | 5 | yes | Auto continue time, Skip is visible from 0 s |
| `sponsors.freq.home_banner_per_day` | int 1 to 10 | 2 | no | Per browser per sponsor per Lagos day |
| `sponsors.freq.title_card_per_day` | int 1 to 20 | 4 | no | |
| `sponsors.freq.player_after_per_session` | int 1 to 5 | 1 | no | |
| `sponsors.freq.player_before_per_session` | int 1 to 3 | 1 | no | |
| `sponsors.label` | enum | `sponsored` | yes | `sponsored`, `sponsor_message`, `in_partnership_with`. Label can change wording but cannot be removed |
| `sponsors.link_new_tab` | bool | true | yes | |
| `sponsors.rotation` | enum | `even` | no | `even` or `weighted` (Should) |
| `donate.enabled` | bool | false | yes | Refused unless `PAYSTACK_SECRET_KEY` is set (S35) |
| `donate.monthly.enabled` | bool | false | yes | |
| `donate.currencies` | string[] | `["NGN"]` | yes | `USD` only when `donate.usd.enabled` |
| `donate.usd.enabled` | bool | false | yes | Could, needs Paystack USD enabled |
| `donate.presets_minor.ngn` | int[] | `[50000,100000,200000,500000]` | yes | Kobo: NGN 500, 1,000, 2,000, 5,000 |
| `donate.presets_minor.usd` | int[] | `[500,1000,2500]` | yes | Cents, Could |
| `donate.min_minor.ngn` | int | 20000 | yes | NGN 200. Small gifts lose a larger share to fees [VERIFY fee] |
| `donate.max_minor.ngn` | int | 500000000 | no | NGN 5,000,000 per gift, abuse guard |
| `donate.org_name` | string | empty | yes | Legal name shown on page and receipt, client input |
| `donate.org_registration` | string | empty | yes | CAC or SCUML or charity number, client input, optional |
| `donate.intro_title`, `donate.intro_body` | string | draft copy | yes | Client editable |
| `donate.thank_you_title`, `donate.thank_you_body` | string | draft copy | yes | |
| `donate.cover_fees_option` | bool | false | yes | Could, "add the fee so more reaches the programme" checkbox |
| `donate.bank_transfer.enabled` | bool | false | yes | Could |
| `donate.bank_transfer.instructions` | string | empty | yes | Plain text, rendered escaped |
| `donate.transparency.enabled` | bool | false | yes | |
| `donate.transparency.title`, `.intro` | string | draft | yes | |
| `donate.transparency.items` | json | `[]` | yes | List of `{label, percent or amount_minor, note}`, validated to total 100 percent when percent mode |
| `donate.transparency.updated_at` | date | none | yes | Shown on page |
| `donate.receipts.reply_to` | email | support email | no | |
| `donate.retention.event_days` | int | 90 | no | `payment_events` payload retention |

Environment (validated in `packages/config/src/env.ts`, added to `.env.example` and the env example test):

| Variable | Notes |
|---|---|
| `PAYSTACK_SECRET_KEY` | `sk_test_...` or `sk_live_...`. Optional until `donate.enabled`. Redacted in logs (add to pino redact paths) |
| `PAYSTACK_BASE_URL` | Default `https://api.paystack.co`, overridable for the test fake server |
| `DONATE_RECEIPT_TOKEN_SECRET` | Optional, otherwise derived from an existing secret with a domain separated HMAC (same trick as `deriveAnalyticsSecret`) |
| `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_HASH` | Could only |

Validation rules: a live key is refused when `NODE_ENV` is not production; a test key in production produces a loud warning on the admin Donations page and in `/readyz` details ("Donations are in TEST mode"); mode is derived from the key prefix, never from a setting. No public key is needed because there is no Popup.

## 4. Data model (additive migrations)

Migration numbers are the next free at build time (main is at 0035 today, other lanes also add migrations, renumber on rebase). Planned as two files (sponsors, donations with subscriptions) so each half is reversible on its own.

`sponsors` migration:
- `sponsors`: `id uuid pk`, `name text (1..80)`, `contact_name_enc bytea null`, `contact_email_enc bytea null` (sponsor contact, encrypted, optional), `status enum sponsor_status (draft, paused, archived)` (live and scheduled and ended are derived, see below), `starts_at timestamptz null`, `ends_at timestamptz null`, `notes text null`, `created_by uuid fk accounts set null`, `created_at`, `updated_at`. Check `ends_at > starts_at`.
- `sponsor_creatives`: `id uuid pk`, `sponsor_id fk cascade`, `headline text (1..60)`, `body text null (..140)`, `cta_label text (1..24) default 'Learn more'`, `destination_url text` (https only, max 500, check `destination_url ~ '^https://'`), `image_square_asset_id uuid null fk assets`, `image_wide_asset_id uuid null fk assets`, `alt_text text null (..120)`, `weight int default 1`, `active bool default true`, `created_at`, `updated_at`. A creative without an image renders as a text card.
- `sponsor_placements`: `creative_id fk cascade`, `slot enum sponsor_slot (home_banner, title_card, player_after, player_before)`, primary key `(creative_id, slot)`.
- `sponsor_daily_stats`: `day date`, `sponsor_id`, `creative_id`, `slot`, `impressions int`, `clicks int`, `reach int` (sum of per day distinct hashes, see slice 3), primary key `(day, creative_id, slot)`. Written by web and worker via upsert with `+ excluded`.
- Enum addition for `asset_purpose`: `sponsor`. (Additive `ALTER TYPE ... ADD VALUE`, which cannot run inside the same transaction as its use, so keep it in a separate statement block with a breakpoint, per the existing migration style.)
- Derived status (computed in SQL view `sponsor_effective_status` and in TypeScript, same logic, tested against each other): `draft` if status draft; `paused` if paused; `archived`; else `scheduled` if now before `starts_at`; `ended` if now after `ends_at`; else `live`. Lazy derivation means a late worker never shows an expired sponsor.
- Audit: every admin action writes `audit_log` (`sponsor.create`, `sponsor.update`, `sponsor.status`, `sponsor.creative.add`, `sponsor.creative.remove`, `sponsor.report.export`).

`donations` migration:
- `donations`: `id uuid pk`, `reference text unique` (our generated, `ad_don_` plus 20 url safe random chars), `provider text default 'paystack'`, `provider_txn_id text null`, `kind enum donation_kind (one_time, monthly)`, `status enum donation_status (pending, succeeded, failed, abandoned, refunded, needs_review)`, `currency text` (check in NGN, USD), `amount_minor bigint` (check > 0), `fee_minor bigint null`, `net_minor bigint null`, `channel text null`, `donor_email_enc bytea`, `donor_email_hash text`, `donor_name_enc bytea null`, `message_enc bytea null (..200 chars before encryption)`, `anonymous bool default false` (hides name from admin lists and transparency, never published anywhere), `account_id uuid null fk accounts set null`, `subscription_id uuid null fk donation_subscriptions`, `source text default 'paystack'` (`paystack`, `manual`), `site_mode text` (`test` or `live`, from key prefix at creation), `paid_at timestamptz null`, `receipt_sent_at timestamptz null`, `created_at`, `updated_at`. Indexes on `(status, created_at)`, `donor_email_hash`, `subscription_id`.
- `donation_subscriptions` (Should): `id`, `provider_subscription_code`, `provider_customer_code`, `plan_code`, `amount_minor`, `currency`, `status enum (active, non_renewing, cancelled, attention)`, `donor_email_enc`, `donor_email_hash`, `next_charge_on date null`, `created_at`, `cancelled_at`.
- `payment_events`: `id bigint identity`, `provider`, `event_key text` (provider event id when present, otherwise `sha256(event + reference + paid_at)`), `event_type text`, `reference text null`, `payload_enc bytea`, `received_at`, `processed_at null`, `outcome text null`, `error text null`. Unique `(provider, event_key)`.
- RLS as in section 2. Amounts are integers in minor units everywhere. No floats.

No migration touches `accounts`, `profiles` or kids tables. Reversible: drop the new tables and enum.

## 5. Build list (numbered slices)

Each slice: one branch, one PR, failing test first (`pnpm vitest run <file>`), `scripts/footprint-check.sh` before commit, design skill review for UI slices, no full suite. Integration tests (`*.int.test.ts`) need the DB per DEV-SETUP.md.

### Slice 0. Docs amendments, settings registry, flags (Must, no UI)
Files: `docs/PRD.md`, `docs/SECURITY.md`, `docs/DESIGN-SYSTEM.md`, `docs/MODULES.md` (add M48 row and detail block, readiness `[CLIENT]` because the owner supplies organisation details and Paystack account), `docs/USER-STORIES.md` (append M48 stories from section 7), `docs/DECISIONS.md` (decisions in section 11), `packages/config/src/settings-registry.ts` (new keys), `packages/config/src/env.ts`.
Failing tests first:
- `packages/config/src/settings-registry.test.ts`: `sponsors keys default to off`, `donate keys default to off`, `rejects preset below minimum`, `rejects transparency percent items that do not total 100`, `label cannot be empty`.
- `packages/config/src/env.test.ts` additions: `refuses sk_live key outside production`, `accepts missing paystack key when donate disabled`, `redacts paystack key in logs`.
- `packages/config/src/env-example.test.ts`: `.env.example lists every PAYSTACK variable`.

### Slice 1. Sponsor schema and migration (Must)
Files: `packages/db/src/schema/sponsors.ts`, `packages/db/src/schema/enums.ts`, `packages/db/migrations/main/00NN_sponsors.sql`, `packages/db/sql/roles.sql` (grants), `docs/DATA-MODEL.md` (new section).
Failing tests first, `packages/db/src/sponsors.int.test.ts`:
- `anonymous context cannot read a draft sponsor`
- `anonymous context reads only live creatives inside the window`
- `viewer role cannot insert a sponsor`
- `editor can insert a sponsor and creative`
- `rejects http destination url`
- `rejects ends_at before starts_at`
- `placement primary key blocks duplicates`
- `effective status view agrees with the TypeScript derivation for each state` (shares fixtures with slice 2)
- `deleting a sponsor removes creatives and placements but keeps daily stats` (stats keep `sponsor_id` without FK cascade so reports survive archive, with a restrict on hard delete when stats exist, archive instead)

### Slice 2. Selection, caps and kids guard (`@ad/sponsors`) (Must)
Files: `packages/sponsors/src/{index,status,select,caps,types}.ts` plus `*.test.ts`, `package.json`, `tsconfig.json`, `vitest.config.ts`.
Failing tests first:
- `status.test.ts`: `draft stays draft inside the window`, `scheduled before start`, `live inside window`, `ended after end`, `paused wins over live`, `window boundaries use Africa/Lagos midnight`.
- `select.test.ts`: `returns null when master switch is off`, `returns null when placement switch is off`, `returns null for kids audience for every slot`, `returns null for kids audience even when a sponsor is live and forced`, `returns null when site guest audience is kids`, `skips creatives not assigned to the slot`, `skips creatives at their daily cap`, `rotates evenly across eligible creatives by day`, `weighted rotation respects weights`, `text card when saveData is on and image exists`, `never returns a creative with a non https destination`, `player_before returns null when saveData is on`, `player_before returns null when resume position is above zero`.
- `caps.test.ts`: `parses a valid cap cookie`, `ignores a malformed or oversized cookie`, `drops entries from earlier Lagos days`, `increments and caps entry count at 20`, `cookie holds no identifier`.

### Slice 3. First party tracking (Must)
Files: `packages/analytics/src/events.ts` (two new strict events), `packages/analytics/src/ingest.ts` (counters), `packages/analytics/src/client/sponsor-tracker.ts`, `apps/web/src/app/s/[creativeId]/route.ts`, `apps/web/src/server/sponsors/click.ts`.
New events: `sponsor_impression { creativeId, slot, impressionId }` and `sponsor_click` is recorded server side by the redirect route only (never trusted from the client). Counters use the existing `bump` with kinds `sp_imp`, `sp_clk`, key `creativeId:slot`. Reach: per day set of `viewerHash(secret, day, anonId)` where `anonId` for guests is the L1 guest id and for accounts the account id (never the profile id for kids, and kids never reach this code). Stored as a per day count only, not the hashes (hashes are kept in a per day in-memory or `rate_limit_buckets`-style table cleared nightly, decision D-M48-07).
Failing tests first:
- `packages/analytics/src/events.test.ts`: `accepts a valid sponsor_impression`, `rejects unknown slot`, `rejects extra keys`, `rejects non uuid creative id`.
- `packages/analytics/src/ingest.test.ts`: `counts one impression per impressionId`, `drops sponsor events for kids audience`, `drops sponsor events from bots`, `drops sponsor events in admin preview batches`, `rate limits sponsor events per ip`.
- `apps/web/src/app/s/[creativeId]/route.test.ts`: `redirects 302 to the stored destination`, `ignores a url in the query string`, `404 for unknown creative`, `404 and no count for kids audience`, `no count for bots`, `no count for admin preview`, `no count when sponsor is not live`, `sets Referrer-Policy no-referrer and Cache-Control no-store`, `rate limited per ip`.
- `packages/analytics/src/client/sponsor-tracker.test.ts`: `fires after 50 percent for 1 second`, `does not fire when scrolled past quickly`, `fires once per impressionId`, `does not fire when the tab is hidden`, `does not load under kids mode`.

### Slice 4. Sponsors admin (Must)
Files: `apps/web/src/app/admin/(shell)/sponsors/{page,new/page,[id]/page}.tsx`, `apps/web/src/server/sponsors/admin.ts`, `apps/web/src/server/sponsors/schemas.ts`, `packages/ui/src/admin/SponsorForm.tsx`, `packages/ui/src/admin/CreativeUploader.tsx`, nav entry under Monetization in the admin sidebar (hidden entirely until `sponsors.enabled`, with a "Turn on sponsors" card on a Settings tab).
Reuse: upload flow and `image.process` job from M36 (`purpose = sponsor`, crops 1:1 and 3:1, WebP and AVIF variants, blur placeholder color), audit log, reauth for enabling the master switch.
Failing tests first:
- `apps/web/src/server/sponsors/admin.test.ts`: `editor can create a draft sponsor`, `only admin can set status live`, `master switch change needs reauth`, `rejects destination url that is http, javascript, data or has credentials`, `rejects url on a blocked host list (localhost, private ranges, our own admin paths)`, `strips whitespace and rejects html in headline`, `image over 2 MB is rejected`, `square image under 400 px is rejected`, `each action writes an audit row`, `hard delete blocked when stats exist`.
- `apps/web/src/app/admin/(shell)/sponsors/page.test.tsx`: `empty state explains and links to create`, `list shows derived status chip with text and icon`, `viewer role gets 403`.
- `packages/ui/src/admin/SponsorForm.test.tsx`: `shows live preview per placement`, `end date before start date shows an inline error`, `labels not placeholders`, `submit disabled state explains why`.

### Slice 5. Viewer placements (Must for home and title, Should for player)
Files: `packages/ui/src/sponsors/{SponsorBanner,SponsorCard,SponsorMessageCard,SponsoredLabel}.tsx` and tests, `apps/web/src/app/(viewer)/home` row interleaver, title page insertion, `apps/web/src/app/watch/.../SponsorGate.tsx`, `packages/ui/tokens.css` additions (section 8).
Failing tests first:
- `SponsorBanner.test.tsx`: `renders the Sponsored label as text`, `renders sponsor name`, `link points to /s/id and has rel sponsored noopener noreferrer`, `reserves the same height with and without an image`, `text only variant under data saver`, `renders nothing when creative is null`, `has an accessible name that includes the label`.
- `home-interleave.test.ts`: `inserts after the configured row`, `never inserts above row two`, `no insert when fewer rows than the position`, `inserts nothing for kids audience`, `inserts at most one banner per page`.
- `TitlePage.sponsor.test.tsx`: `card sits below the action buttons and above More like this`, `not rendered for kids`.
- `SponsorMessageCard.test.tsx`: `skip is visible at 0 seconds`, `skip works with Enter, Space and Escape`, `auto continues after configured seconds`, `focus moves to Skip and returns to Play on close`, `announces politely`, `reduced motion removes the countdown animation`, `no card when resume position above zero`, `no card under saveData for the before slot`.
- `SponsorGate.test.tsx`: `video requests start while the card is showing`, `watch time is not counted during the card`, `after card never delays or cancels the Up next countdown`, `after card absent for kids`.

### Slice 6. Sponsor report (Must for on screen, Should for CSV and print)
Files: `packages/sponsors/src/report.ts`, `packages/sponsors/src/csv.ts`, `apps/web/src/app/admin/(shell)/sponsors/[id]/report/page.tsx`, `apps/web/src/app/admin/(shell)/sponsors/[id]/report/print/page.tsx`, `apps/web/src/server/sponsors/report-export.ts`, uses `staff_exports` (new kind `sponsor` in `staff_exports_kind_known` check) and the existing `exports.generate` worker, so large exports are queued.
Failing tests first:
- `report.test.ts`: `sums impressions and clicks across the range`, `click rate is zero when no impressions`, `groups by creative and by placement`, `days with no data are zero filled in Lagos days`, `reach is labelled daily reach and never summed as unique people`, `range cannot exceed 400 days`.
- `csv.test.ts`: `escapes commas, quotes and newlines`, `neutralizes formula injection (leading = + - @ tab)`, `header row fixed`, `contains no personal data`.
- `report-export.test.ts`: `editor cannot export`, `admin export is audited`, `file expires after the export window`.
- `print/page.test.tsx`: `print page shows sponsor name, dates, totals and the methodology note`, `print stylesheet hides the admin shell`, `numbers match the on screen report`.

### Slice 7. Payments core and Paystack adapter (Must)
Files: `packages/payments/src/{provider,paystack,signature,money,reference,index}.ts` plus tests, fake server `packages/payments/src/testing/fake-paystack.ts`.
First step: re-read current Paystack docs and fix every [VERIFY] item in this plan in a short note appended to `docs/lanes/L9.md`.
Failing tests first:
- `signature.test.ts`: `accepts a correct sha512 signature over the raw body`, `rejects a signature for a body changed by one byte`, `rejects when header is missing`, `rejects when header has a different length (no throw)`, `rejects an uppercase hex signature only if the provider spec is lowercase [VERIFY]`, `uses constant time comparison`, `rejects when body was re-serialized JSON instead of raw bytes`, `rejects with the live key when the signature was made with the test key`.
- `paystack.test.ts` (against fake server): `initialize sends amount in kobo, currency, reference, email, callback_url and metadata`, `never sends card fields`, `verify returns paid only when status is success and amount and currency match`, `verify returns needs_review when amount is lower than expected`, `verify handles abandoned and failed`, `network error surfaces a typed retryable error`, `secret key never appears in thrown error messages or logs`.
- `money.test.ts`: `parses NGN major to minor without float error`, `rejects non integer minor`, `formats NGN and USD for display`, `enforces min and max`.
- `reference.test.ts`: `references are unique and url safe`, `reference has no personal data`.

### Slice 8. Donations schema, service and webhook (Must)
Files: `packages/db/src/schema/donations.ts`, migration `00NN_donations.sql`, `packages/payments/src/{donations,events,process-event}.ts`, `apps/web/src/app/api/webhooks/paystack/route.ts`, `packages/queue/src/definitions.ts` (queues `donations.process_event`, `donations.reconcile`), `apps/worker/src/jobs/donations-*.ts`.
Failing tests first:
- `apps/web/src/app/api/webhooks/paystack/route.test.ts`: `401 and no row when signature is missing`, `401 and no row when signature is wrong`, `401 when body is valid JSON but signature is for a different body`, `200 and one row for a valid charge.success`, `second delivery of the same event returns 200 and does not enqueue again`, `body over 64 KB is rejected 413 before hashing`, `non POST is 405`, `unknown event type is stored and ignored with 200`, `does not log the body or the email`, `works with the raw body, not parsed JSON`.
- `process-event.test.ts` and `donations.int.test.ts`: `charge.success marks the donation succeeded once`, `replayed charge.success does not send a second receipt`, `charge.success with a lower amount sets needs_review and no receipt`, `charge.success for an unknown reference is stored as orphan and flagged`, `charge.success arriving before our row commit is retried`, `charge.failed marks failed`, `refund event marks refunded and keeps the original amount`, `concurrent duplicate events produce one success (advisory lock on reference)`, `test mode events are rejected when running with a live key and vice versa`, `no write to accounts or profiles`.
- Worker: `donations-reconcile.int.test.ts`: `pending older than 15 minutes is verified with the provider`, `pending older than 24 hours becomes abandoned`, `verify failure is retried with backoff`, `reconcile never downgrades a succeeded donation`.

### Slice 9. Donate pages, checkout API, thank you and receipts (Must)
Files: `apps/web/src/app/(site)/donate/{page,thank-you/page,cancelled/page}.tsx`, `apps/web/src/app/api/donate/checkout/route.ts`, `apps/web/src/app/api/donate/status/route.ts`, `packages/ui/src/donate/{DonateForm,AmountPicker,DonateStatus}.tsx`, `packages/mailer/src/templates.ts` (`donation_receipt`), `packages/payments/src/receipt.ts`, header and footer Donate entries, end of video card link, sitemap and robots (indexable page, noindex on thank-you and cancelled).
Failing tests first:
- `checkout/route.test.ts`: `400 for amount below minimum`, `400 for amount above maximum`, `400 for unknown currency`, `400 for invalid email`, `400 for extra keys (mass assignment)`, `403 for kids audience`, `404 when donate is disabled`, `429 after the per ip limit`, `429 after the per email hash limit`, `creates one pending row and returns an https paystack url`, `does not store anything when Paystack initialize fails`, `works with no session (guest)`, `prefills nothing from other accounts`, `Turnstile required after repeated limit hits when keys are set`.
- `DonateForm.test.tsx`: `presets are buttons with pressed state`, `custom amount validates on blur then on change`, `monthly toggle hidden when disabled`, `submit shows pending state and cannot double submit`, `network failure keeps the form values and shows the retry message`, `tab order and focus ring`, `inputmode numeric on amount, email autocomplete`, `no third party script is loaded`.
- `thank-you/page.test.tsx`: `shows success only when the server says succeeded`, `shows processing with a polling hint for pending`, `shows failed with a retry link`, `ignores a status in the query string`, `reference of another donor without the receipt token shows nothing personal`.
- `receipt.test.ts`: `receipt contains reference, amount, currency, date, organisation name`, `does not claim tax deductibility unless configured`, `uses the email outbox with an idempotency key receipt:donationId`, `escapes the donor name`.

### Slice 10. Monthly giving (Should)
Files: `packages/payments/src/subscriptions.ts`, `packages/db/src/schema/donations.ts` additions, `apps/web/src/app/(site)/donate/manage/page.tsx`, `packages/mailer/src/templates.ts` (`donation_manage_link`, `donation_failed`), plan creation helper that creates (once, cached in `settings`-free table `donation_plans`) a Paystack plan per amount and currency.
Failing tests first: `subscription.create stores the subscription once`, `charge.success on a plan creates a new donation row per month linked to the subscription`, `invoice.payment_failed sets attention and sends one email`, `subscription.disable marks cancelled`, `manage link token is HMAC signed, expires in 30 days and is single purpose`, `manage page never reveals whether an email has a subscription (generic response)`, `cancel is idempotent`, `monthly is blocked for kids audience`, `amount change creates a new plan, not an edit`.

### Slice 11. Admin donations (Must list and export, Should refunds view)
Files: `apps/web/src/app/admin/(shell)/donations/{page,[id]/page}.tsx`, `apps/web/src/server/donations/admin.ts`, `staff_exports` kind `donations`.
Failing tests first: `only admin and super_admin can list`, `editor gets 403`, `list never shows full email by default (masked, reveal action is audited)`, `anonymous donor name hidden`, `filters by status, date, kind`, `test mode rows shown with a Test badge and excluded from totals`, `csv escapes and neutralizes formulas`, `export audited`, `needs_review queue shows expected versus paid amount`, `marking resolved needs a note and is audited`.

### Slice 12. Transparency page (Should)
Files: `apps/web/src/app/(site)/transparency/page.tsx`, `apps/web/src/app/admin/(shell)/donations/transparency/page.tsx`, `packages/ui/src/donate/TransparencyList.tsx`.
Failing tests first: `404 when disabled`, `renders items and updated date`, `percent items total 100 or the editor refuses save`, `no donor names or emails anywhere on the page`, `draft versus published state with an audit row`, `page is indexable and linked from /donate and the footer only when enabled`.

### Slice 13. Could items
- `packages/payments/src/flutterwave.ts` (verify header `verif-hash` equals the configured hash, then verify transaction by API) with `flutterwave.test.ts`: `rejects wrong hash`, `rejects missing hash`, `verify checks amount and currency`.
- Bank transfer: `donate.bank_transfer.*` rendered on `/donate`, manual entry form in admin with `source = manual`, tests `instructions are escaped`, `manual entry is audited`, `manual entry cannot create a receipt without admin action`.
- USD checkout: tests `usd option hidden unless usd.enabled`, `usd presets validated`, `currency stored with donation`, `report totals never mix currencies`.
- Cover the fees checkbox: `adds the fee estimate and stores it separately`.

### Slice 14. Hardening and handover
Files: `apps/web/src/server/authz/matrix.test.ts` additions (M48 routes), `docs/SECURITY.md` capability table rows, `docs/DEPLOYMENT.md` (Paystack webhook URL, Cloudflare rate rule for `/api/donate/checkout` and `/s/*`, WAF skip rule so Paystack webhook is not challenged, secret rotation), `docs/CLIENT-INPUTS.md` (organisation name, registration number, bank details, transparency content, sponsor terms), `docs/lanes/L9.md`, `CHANGELOG.md`.
Failing tests first: authorization matrix rows for every new route (guest, viewer, kids, editor, admin), `log redaction test covers paystack secret and donor email`, `kids matrix: every sponsor and donate surface returns empty or 403 for kids profile and kids mode`, `CSP unchanged snapshot test (no new origins)`, `no third party hostnames in built output for sponsor and donate pages` (grep test over the build manifest).

### Worker jobs summary

| Queue | Schedule | Purpose |
|---|---|---|
| `donations.process_event` | on enqueue | Process a stored webhook event, retry 5 times with backoff |
| `donations.reconcile` | every 30 minutes | Verify old pending donations, mark abandoned after 24 h |
| `donations.prune_events` | daily | Delete `payment_events` payloads past `donate.retention.event_days` |
| `sponsors.prune_assets` | weekly | Remove orphaned creative images (no creative references them) |
| `exports.generate` | existing | Gains kinds `sponsor` and `donations` |
| `email.outbox` | existing | Sends receipts and manage links |

No cron is needed to start or end sponsors because status is derived from dates at read time.

## 6. Placement behaviour in detail

| Slot | Where | Eligibility | Caps (default) | Data saver |
|---|---|---|---|---|
| `home_banner` | After row N (default 3) on Home, full content width | General audience, not Continue Watching empty state | 2 per day per sponsor per browser, 1 banner per page | Text card, no image |
| `title_card` | Title and series page, below the action buttons, above More like this | General audience | 4 per day per sponsor | Text card, no image |
| `player_after` | Ended screen of the player, beside Up next, never replacing it | General audience, video completed or ended | 1 per session | Text card |
| `player_before` | Over the paused ready player after Play is tapped | General audience, fresh start only (position 0), not on replay, not on resume | 1 per session | Never shown |

Rules common to all slots: the Sponsored label is always visible text, the whole card is one link, the creative is a still image plus text (no video, no audio, no animation, no autoplay), nothing is injected into the video timeline, there is a "Why am I seeing this?" link to `/sponsors` (Could) and no tracking script from the sponsor.

## 7. User stories (module M48)

Format follows `docs/USER-STORIES.md`. Priorities use Must, Should, Could. 44 stories (23 sponsors, 21 donations). Slice numbers in brackets are for the builder only.

### M48-S01 Master and placement switches (Must) [slice 0, 4]
As an admin, I want one master switch and a switch per placement, so that sponsors never appear until I decide.
- AC1: Given a fresh install, When I open Settings, Monetization, Then sponsors and every placement are off and the page says nothing is shown to viewers.
- AC2: Given the master switch is on and Home banner is off, When a viewer opens Home, Then no sponsor markup exists in the page.
- AC3: Given I turn the master switch on or off, When I save, Then I am asked for my password (reauth), and an audit row is written.
- Edge: turning the master switch off hides the Sponsors nav entry badge but keeps data.
- Error: if saving fails, the toggle returns to its previous state with a message.
- Empty: with the master switch on and no live sponsor, the admin sees "Nothing is showing yet" and a Create sponsor button.

### M48-S02 Create a sponsor (Must) [slice 4]
As an admin or editor, I want to create a sponsor with a name, optional contact and notes, so that I can organise campaigns.
- AC1: Given I open Sponsors, New, When I enter a name and save, Then a sponsor is created as draft.
- AC2: Given the name is empty or over 80 characters, When I blur the field, Then an inline error appears with `aria-invalid`.
- AC3: Given I enter a contact email, When it is saved, Then it is stored encrypted and shown masked.
- Edge: duplicate names are allowed but warned.
- Error: network failure keeps my entries.
- Empty: the list shows an explanation and a Create button.

### M48-S03 Upload a creative (Must) [slice 4]
As an editor, I want to add a creative (headline, short text, button label, square image, optional wide image, alt text), so that the sponsor card looks right.
- AC1: Given I upload a square image of at least 400 px and under 2 MB, When it processes, Then I see WebP and AVIF variants and a preview per placement.
- AC2: Given I upload a wrong type, too small or too large file, When I submit, Then a plain error says what to fix.
- AC3: Given the creative has an image, When I leave alt text empty, Then I must tick "decorative" or enter text.
- Edge: creative with no image renders as a text card.
- Error: processing failure shows Retry and keeps the draft.
- Empty: "No creatives yet" with an Add creative button.

### M48-S04 Destination link validation (Must) [slice 4]
As an admin, I want the link checked, so that viewers are never sent somewhere unsafe.
- AC1: Given I enter a destination, When I save, Then only https URLs without credentials are accepted.
- AC2: Given the host is localhost, a private IP or our own site, When I save, Then it is rejected with an explanation.
- AC3: Given a valid link, When I preview, Then the preview opens it in a new tab and does not count a click.
- Edge: tracking parameters (utm) are kept as typed.
- Error: invalid URL shows an inline error.
- Empty: not applicable.

### M48-S05 Schedule start and end (Must) [slice 1, 2, 4]
As an admin, I want start and end dates, so that a campaign runs only when agreed.
- AC1: Given I set start 1 December and end 31 December, When it is 30 November, Then status is Scheduled and nothing shows.
- AC2: Given the end date has passed, When a viewer loads Home, Then the sponsor does not show even if the worker is down.
- AC3: Given the end is before the start, When I save, Then an inline error appears.
- Edge: dates are in Lagos time, the end date is inclusive to 23:59:59.
- Error: invalid date text is rejected.
- Empty: no dates means it runs until paused.

### M48-S06 Choose placements per creative (Must) [slice 4]
As an admin, I want to tick which placements a creative may use, so that a sponsor can be limited to Home only.
- AC1: Given a creative, When I tick Home banner and Title card, Then only those slots can select it.
- AC2: Given a placement is globally off, When I view the creative, Then that checkbox shows "Off in settings" and a link.
- Edge: no placement ticked means the creative is never shown, the form warns.
- Error: save failure keeps ticks.
- Empty: not applicable.

### M48-S07 Sponsor status lifecycle (Must) [slice 1, 4]
As an admin, I want clear statuses (Draft, Scheduled, Live, Paused, Ended, Archived), so that I know what viewers see.
- AC1: Given any sponsor, When I view the list, Then the status shows as an icon and a word, never colour alone.
- AC2: Given a Live sponsor, When I press Pause, Then it stops showing on the next page load.
- AC3: Given a sponsor has report data, When I try to delete it, Then I can only archive.
- Edge: only admin can move to Live.
- Error: a failed status change shows the old status.
- Empty: filters with no result show "No sponsors in this view".

### M48-S08 Frequency caps (Must) [slice 2]
As an admin, I want caps, so that viewers are not shown the same sponsor too often.
- AC1: Given the home cap is 2 per day, When a browser has seen the sponsor twice today, Then the third Home load shows no banner and no gap.
- AC2: Given the browser cleared cookies, When it loads Home, Then the sponsor may show again (documented limit).
- AC3: Given a cap value outside range, When I save, Then it is rejected.
- Edge: the cap resets at Lagos midnight.
- Error: a corrupted cap cookie is ignored.
- Empty: not applicable.

### M48-S09 Home banner (Must) [slice 5]
As a viewer, I want a sponsor banner between rows that does not disturb browsing, so that I can scroll past it.
- AC1: Given a live sponsor and the Home banner on, When I load Home, Then one banner appears after the configured row.
- AC2: Given the page loads, When the banner renders, Then it occupies its reserved height with no layout shift (CLS 0 from the banner).
- AC3: Given I use the keyboard, When I Tab, Then the banner link is reachable once and has a visible focus ring.
- Edge: with fewer rows than the position, no banner.
- Error: image fails to load, the card shows text with the same height.
- Empty: no live sponsor means no markup.

### M48-S10 Title page card (Must) [slice 5]
As a viewer, I want a small sponsor card on a title page, so that it never covers the video or the Play button.
- AC1: Given a live sponsor with Title card on, When I open a title page, Then the card shows below the action buttons and above More like this.
- AC2: Given I am on a phone, When the page renders, Then the card is full width and Play stays above the fold.
- Edge: series pages use the same slot once.
- Error: image failure falls back to text.
- Empty: no sponsor, no gap.

### M48-S11 Message card after a video (Should) [slice 5]
As a viewer, I want a still sponsor message when a video ends, so that it never interrupts the lesson.
- AC1: Given the video ended and the slot is on, When the end screen shows, Then a card appears next to Up next.
- AC2: Given an Up next countdown is running, When the card shows, Then the countdown is neither paused nor extended.
- AC3: Given I press Next or Replay, When I do, Then the card gets out of the way immediately.
- Edge: not shown when the video was abandoned before the end.
- Error: none beyond image fallback.
- Empty: no sponsor, normal end screen.

### M48-S12 Message card before a video (Should) [slice 5]
As a viewer, I want to skip a sponsor message at once, so that I can start learning without a wait.
- AC1: Given the slot is on and I tap Play on a fresh start, When the card shows, Then a Skip button is visible and focused from the first moment.
- AC2: Given I do nothing, When the configured seconds pass (default 5), Then playback starts.
- AC3: Given the video is loading, When the card shows, Then media requests have already started so the card adds no delay.
- AC4: Given Data saver is on or I resume partway, When I press Play, Then no card shows.
- Edge: Enter, Space and Escape skip. Replay in the same session shows no card.
- Error: card render failure starts playback immediately.
- Empty: no sponsor, normal start.

### M48-S13 Never on kids (Must) [slice 2, 3, 5, 14]
As a parent, I want no sponsor content for children, so that kids are protected.
- AC1: Given a kids profile or Kids mode, When any page loads, Then no sponsor markup, cookie, request or tracking exists.
- AC2: Given someone calls the click or impression route with a kids context, When processed, Then nothing is recorded and 404 or 204 returns.
- AC3: Given site guest audience is Kids, When a guest browses, Then no sponsor shows.
- Edge: switching to Kids mode removes the banner without reload artifacts.
- Error: if audience cannot be determined, treat as kids (fail closed).
- Empty: not applicable.

### M48-S14 Sponsored label (Must) [slice 5]
As a viewer, I want a clear label, so that I can tell a sponsor from lessons.
- AC1: Given any sponsor card, When it renders, Then "Sponsored by NAME" (or the configured wording) shows as text at 13 px or larger with 4.5:1 contrast.
- AC2: Given I use a screen reader, When I reach the card, Then it is announced as sponsored before its content.
- AC3: Given an admin edits the creative, When saving, Then the label cannot be hidden or emptied.
- Edge: label wording options are limited to the allowed set.
- Error: not applicable.
- Empty: not applicable.

### M48-S15 Impression tracking (Must) [slice 3]
As an admin, I want accurate impression counts without third-party tools, so that reports are trustworthy.
- AC1: Given a card is 50 percent visible for 1 second, When tracked, Then one impression is counted for that page view.
- AC2: Given bots, admin previews or kids contexts, When tracked, Then nothing is counted.
- AC3: Given the viewer is offline, When the batch fails, Then it follows the existing analytics retry rules and never blocks the page.
- Edge: tab hidden means no count.
- Error: invalid events are dropped and counted as rejected.
- Empty: not applicable.

### M48-S16 Click tracking (Must) [slice 3]
As an admin, I want clicks counted on our own origin, so that no sponsor script runs.
- AC1: Given I tap a card, When the browser navigates to `/s/{id}`, Then a click is recorded and I land on the sponsor URL.
- AC2: Given someone tampers with the URL, When requested, Then the destination still comes only from the database.
- AC3: Given the sponsor is no longer live, When `/s/{id}` is requested, Then it returns 404.
- Edge: referrer is not sent to the sponsor.
- Error: a recording failure still redirects (the viewer is not punished), and logs a warning.
- Empty: not applicable.

### M48-S17 Data saver and offline (Must) [slice 5]
As a viewer on a slow connection, I want sponsors to cost almost nothing, so that lessons stay fast.
- AC1: Given Data saver is on, When a sponsor shows, Then it is text only, no image is fetched.
- AC2: Given I am offline, When a page loads from the service worker, Then no sponsor request is made and no gap is left.
- AC3: Given Data saver is on, When I press Play, Then no before card shows.
- Edge: the service worker never caches `/s/*`.
- Error: not applicable.
- Empty: not applicable.

### M48-S18 Sponsor report on screen (Must) [slice 6]
As an admin, I want a report per sponsor, so that I can show results.
- AC1: Given a date range, When I open the report, Then I see impressions, clicks, click rate, daily reach, by creative and placement, with a chart that has a text table alternative.
- AC2: Given no data, When I open the report, Then it shows an explanation instead of empty charts.
- AC3: Given the range is over 400 days, When I apply it, Then an inline error appears.
- Edge: reach is labelled "daily reach (not unique people)".
- Error: query failure shows Retry.
- Empty: "No impressions yet. Check the dates and placements."

### M48-S19 CSV export (Should) [slice 6]
As an admin, I want a CSV, so that I can share the numbers.
- AC1: Given a report, When I choose Export CSV, Then a queued export produces a file with fixed columns.
- AC2: Given a cell starts with `=`, `+`, `-` or `@`, When exported, Then it is neutralised.
- AC3: Given I am an editor, When I try, Then access is denied.
- Edge: expires after the export window.
- Error: failed export shows Retry.
- Empty: an empty report exports headers only.

### M48-S20 Printable sponsor summary (Should) [slice 6]
As an admin, I want a one page summary I can send to a sponsor, so that I can save it as PDF.
- AC1: Given a report, When I choose Print summary, Then a clean page shows sponsor, period, totals, per placement table and a methodology note.
- AC2: Given I print, When the browser dialog opens, Then the admin shell is hidden and the page fits A4.
- Edge: uses the site name and logo from settings.
- Error: not applicable.
- Empty: totals show zero with the same note.

### M48-S21 Preview without counting (Must) [slice 4]
As an editor, I want to preview each placement, so that I can check before going live.
- AC1: Given a creative, When I open Preview, Then I see mobile and desktop renderings per slot, including text only mode.
- AC2: Given I click inside the preview, When it navigates, Then nothing is counted.
- Edge: preview works for draft sponsors.
- Error: not applicable.
- Empty: not applicable.

### M48-S22 Rotation (Should) [slice 2]
As an admin, I want several sponsors to share a slot fairly, so that each gets exposure.
- AC1: Given two live creatives for Home, When pages load across days, Then they alternate evenly by day.
- AC2: Given weighted mode, When weights are 3 and 1, Then 3 of 4 days show the first.
- Edge: a capped creative is skipped for that browser.
- Error: not applicable.
- Empty: one creative always shows (within caps).

### M48-S23 Why am I seeing this (Could) [slice 5]
As a viewer, I want a short explanation, so that I understand sponsors fund the platform.
- AC1: Given a card, When I open "Why am I seeing this?", Then `/sponsors` explains sponsors, that they do not get my data, and that kids never see them.
- Edge: page 404s when sponsors are off.
- Error: not applicable.
- Empty: not applicable.

### M48-S24 Donate button and navigation (Must) [slice 9]
As a viewer, I want an easy but unpushy way to give, so that I can support the platform if I wish.
- AC1: Given donations are on, When I view the footer, header menu or end of a video, Then a Donate link shows.
- AC2: Given donations are off, When I request `/donate`, Then it returns 404 and no link exists anywhere.
- AC3: Given Kids mode, When I look, Then no Donate link shows and `/donate` explains "Ask a grown-up".
- Edge: no popups, no banners, no nagging.
- Error: not applicable.
- Empty: not applicable.

### M48-S25 Amount selection (Must) [slice 9]
As a donor, I want presets and a custom amount, so that I can give what I choose.
- AC1: Given NGN presets, When I tap one, Then it shows as pressed and the button shows the amount.
- AC2: Given I type a custom amount below the minimum or above the maximum, When I leave the field, Then an inline message states the limit.
- AC3: Given I use a phone, When I focus the field, Then the numeric keypad opens.
- Edge: the amount is validated again on the server.
- Error: failure keeps my input.
- Empty: not applicable.

### M48-S26 One time donation with Paystack (Must) [slice 7, 9]
As a donor, I want to pay by card, bank transfer or USSD on a secure page, so that my payment details stay safe.
- AC1: Given I enter an amount and email and press Donate, When the server creates the transaction, Then I am sent to Paystack's hosted page.
- AC2: Given I pay, When Paystack redirects me back, Then I land on the thank you page.
- AC3: Given I close the Paystack page, When I return, Then I see the cancelled page with a way to try again.
- Edge: double tapping creates one transaction.
- Error: if Paystack is unreachable, "We could not start the payment. Nothing was charged. Try again." and no stuck row.
- Empty: not applicable.

### M48-S27 Webhook signature verification (Must) [slice 7, 8]
As the owner, I want only genuine Paystack events accepted, so that nobody can fake a donation.
- AC1: Given a request with a missing or wrong `x-paystack-signature`, When it arrives, Then it gets 401 and nothing is stored or enqueued.
- AC2: Given a correct signature over the raw body, When it arrives, Then it is stored and acknowledged within one second.
- AC3: Given a body changed by one byte, When it arrives with the old signature, Then it is rejected.
- Edge: oversized bodies are rejected before hashing.
- Error: processing errors never change the response to Paystack after storage.
- Empty: not applicable.

### M48-S28 Idempotent processing (Must) [slice 8]
As the owner, I want repeated or out of order events to be harmless, so that no donor is charged twice in our books or emailed twice.
- AC1: Given the same event is delivered twice, When processed, Then one state change and one receipt result.
- AC2: Given a success event arrives before our row is visible, When processed, Then it is retried, not dropped.
- AC3: Given the paid amount is lower than expected, When processed, Then the donation is flagged needs review and no receipt is sent.
- Edge: concurrent deliveries are serialised by reference.
- Error: poison events end in a failed state with an alert in the admin.
- Empty: not applicable.

### M48-S29 Thank you page (Must) [slice 9]
As a donor, I want an honest confirmation, so that I know the gift arrived.
- AC1: Given I return from Paystack, When the server verifies the reference, Then I see success only if the donation is succeeded.
- AC2: Given the webhook has not arrived, When I load the page, Then it says "We are confirming your gift" and refreshes the status up to 30 seconds.
- AC3: Given I edit the URL, When I load it, Then nothing personal is shown without the signed receipt token.
- Edge: page has `noindex` and no third party scripts.
- Error: failure shows a calm message and the support email.
- Empty: not applicable.

### M48-S30 Email receipt (Must) [slice 9]
As a donor, I want an emailed receipt, so that I have a record.
- AC1: Given a donation succeeded, When processed, Then one email with reference, amount, date and organisation name is queued through the outbox.
- AC2: Given the donor name has markup, When rendered, Then it is escaped.
- AC3: Given tax text is not configured, When the receipt renders, Then it does not claim deductibility.
- Edge: guests receive it too, using only the email they typed.
- Error: delivery failure retries through the outbox and shows in the admin row.
- Empty: not applicable.

### M48-S31 Monthly donation (Should) [slice 10]
As a donor, I want to give every month, so that I can support steadily.
- AC1: Given monthly is enabled, When I tick "Give monthly", Then the button shows "Give NGN X every month" and the subscription starts on payment.
- AC2: Given a later month, When the charge succeeds, Then a new donation row and receipt exist for that month.
- AC3: Given a charge fails, When Paystack reports it, Then I get one email asking me to update my card.
- Edge: changing the amount means starting a new monthly gift and cancelling the old one.
- Error: plan creation failure shows the one time option as a fallback message.
- Empty: not applicable.

### M48-S32 Cancel monthly giving (Should) [slice 10]
As a donor, I want to stop at any time, so that I stay in control.
- AC1: Given a monthly email, When I open the manage link, Then I can cancel in one step.
- AC2: Given I enter my email on the manage page, When submitted, Then the answer is always "If a monthly gift exists we have emailed a link".
- AC3: Given the link is older than 30 days, When opened, Then it asks me to request a new one.
- Edge: cancelling twice is harmless.
- Error: provider failure shows Retry and keeps the state.
- Empty: not applicable.

### M48-S33 Guests can donate (Must) [slice 9, lane L1]
As a visitor without an account, I want to donate with only an email, so that nothing blocks me.
- AC1: Given I am a guest, When I donate, Then I am never asked to sign up.
- AC2: Given I am signed in, When I donate, Then my email is prefilled and the gift is linked to my account, and I can untick "link to my account".
- AC3: Given a guest session, When a gift is made, Then the guest cookie is not extended or used as a payment identifier.
- Edge: signing in later does not retroactively link past gifts.
- Error: not applicable.
- Empty: not applicable.

### M48-S34 Kids cannot donate (Must) [slice 9, 14]
As a parent, I want children unable to start a payment, so that no child is charged.
- AC1: Given a kids profile or Kids mode, When `POST /api/donate/checkout` is called, Then it returns 403.
- AC2: Given Kids mode, When the page loads, Then `/donate` shows "Ask a grown-up to help" with no form.
- Edge: audience is derived on the server, never from the body.
- Error: unknown audience fails closed.
- Empty: not applicable.

### M48-S35 Test mode and live guard (Must) [slice 0, 7, 11]
As the developer and owner, I want safe testing and no accident in live mode, so that real money is handled deliberately.
- AC1: Given no Paystack key, When I try to enable donations, Then the switch refuses and says which variable is missing.
- AC2: Given a test key, When donations run, Then the page and admin show a Test mode badge, and test rows are excluded from totals.
- AC3: Given a live key outside production, When the app starts, Then it refuses to boot the payments module.
- Edge: switching keys never mixes test and live rows (rows store `site_mode`).
- Error: webhook events for the other mode are stored and ignored.
- Empty: not applicable.

### M48-S36 Admin donations list and export (Must) [slice 11]
As an admin, I want to see and export donations, so that I can do accounts.
- AC1: Given donations exist, When I open Donations, Then I see date, reference, amount, status, kind, masked email, and filters.
- AC2: Given I press Reveal email, When I confirm, Then the email shows and an audit row records who revealed it.
- AC3: Given I export, When the file is built, Then it is a queued CSV with formula neutralisation.
- Edge: anonymous gifts hide the name in lists.
- Error: export failure shows Retry.
- Empty: "No donations yet."

### M48-S37 Reconcile pending gifts (Should) [slice 8]
As the owner, I want missed webhooks recovered, so that every paid gift is recorded.
- AC1: Given a pending donation older than 15 minutes, When the job runs, Then it is verified with Paystack and updated.
- AC2: Given a pending gift older than 24 hours with no payment, When the job runs, Then it becomes abandoned.
- Edge: a succeeded gift is never downgraded.
- Error: provider errors retry with backoff.
- Empty: not applicable.

### M48-S38 Transparency page (Should) [slice 12]
As a donor, I want to see how donations are used, so that I can trust the project.
- AC1: Given the page is enabled, When I open `/transparency`, Then I see the owner's items, their share or amount, and the last updated date.
- AC2: Given percent mode, When the owner saves, Then items must total 100 percent.
- AC3: Given the page is disabled, When requested, Then it returns 404 and no link shows.
- Edge: no donor names ever appear.
- Error: not applicable.
- Empty: not applicable (disabled by default).

### M48-S39 Diaspora USD gifts (Could) [slice 13]
As a donor abroad, I want to give in US dollars, so that my bank does not convert at a poor rate.
- AC1: Given USD is enabled and Paystack has USD on the account, When I open `/donate`, Then I can switch currency to USD with its own presets.
- AC2: Given USD is not enabled, When I open `/donate`, Then no currency switch shows.
- Edge: totals never add NGN and USD together.
- Error: USD initialisation failure falls back to NGN with a message.
- Empty: not applicable.

### M48-S40 Bank transfer instructions (Could) [slice 13]
As a donor who prefers a transfer, I want account details, so that I can pay from my bank app.
- AC1: Given it is enabled, When I open `/donate`, Then the instructions show as escaped text with a copy button for the account number.
- AC2: Given an admin receives a transfer, When they add a manual donation, Then it is stored with source manual and audited.
- Edge: no receipt is emailed unless the admin chooses to.
- Error: not applicable.
- Empty: not applicable.

### M48-S41 Flutterwave option (Could) [slice 13]
As the owner, I want a second provider if Paystack is a problem, so that I am not locked in.
- AC1: Given the Flutterwave variables are set and the provider is selected, When a donor pays, Then the same flow works through the provider interface.
- AC2: Given a webhook with a wrong `verif-hash`, When it arrives, Then it is rejected.
- Edge: only one provider is active at a time.
- Error: not applicable.
- Empty: not applicable.

### M48-S42 Failed and refunded gifts (Should) [slice 8, 11]
As an admin, I want failures and refunds shown clearly, so that my books match Paystack.
- AC1: Given a failed payment, When processed, Then the row shows Failed with the reason code and no receipt.
- AC2: Given a refund event, When processed, Then the row shows Refunded and totals exclude it.
- Edge: partial refunds are shown as needs review.
- Error: not applicable.
- Empty: not applicable.

### M48-S43 Abuse and card testing protection (Must) [slice 9, 14]
As the owner, I want fraudsters unable to use the form to test stolen cards, so that the account stays in good standing.
- AC1: Given more than the allowed initiations per IP or per email hash per hour, When another arrives, Then it gets 429.
- AC2: Given repeated limit hits and Turnstile configured, When the form loads, Then a challenge is required.
- AC3: Given many pending rows from one source, When the reconcile job runs, Then they are marked abandoned and the admin sees an alert.
- Edge: limits are tunable in config constants.
- Error: limiter failure fails closed for checkout.
- Empty: not applicable.

### M48-S44 Privacy notice and retention (Must) [slice 9, 14]
As a donor, I want to know what is stored and for how long, so that I can trust the platform.
- AC1: Given I open `/donate`, When I look under the form, Then a short notice states what we store (email, optional name, amount), who processes it (Paystack), the legal basis and retention, and links to the Privacy page.
- AC2: Given a marketing tick box, When shown, Then it is unticked by default and not required.
- AC3: Given a deletion request, When handled, Then name, message and email are erased or hashed while amounts and references remain for accounts, as explained in the notice.
- Edge: guests are covered by the same notice.
- Error: not applicable.
- Empty: not applicable.

## 8. UI review (design skill and audit)

Reviewed against `docs/DESIGN-SYSTEM.md`, the `angels-delight-design-system` checklist and the audit sections 2 and 3. Result of this planning review: the design is feasible with the points below. Each point becomes a check in the slice 5 and 9 reviews.

Tokens and theming
- Add tokens before any component: `--sponsor-slot-height-compact` (mobile Home and Title card), `--sponsor-slot-height-wide` (desktop), `--sponsor-label-bg`, `--sponsor-label-ink`. Add them to `tokens.css`, DESIGN-SYSTEM section 3 and the theme editor group (Fixed, so a client theme cannot make the label unreadable), per the skill rule on new tokens.
- No hardcoded colours, fonts or sizes. Cards use `--color-surface`, `--color-border-strong`, `--radius-12`, spacing scale in 4 px steps. Accent yellow is never text, the CTA text uses `--color-on-accent`.

Slot sizes (starting values, to tune on real low end Android phones in Lagos, as the audit advises)
- Home banner mobile (360 px): full width inside the gutter, fixed height 112 px (16 px padding, 80 px square image on the left, text right, CTA as a text button inside the card, 44 px target). Desktop (960 px and up): fixed height 136 px, optional wide 3:1 image fills the right 40 percent.
- Title card: same component, same heights, full content width, below the action row.
- After card: 16:9 box 320 px wide on desktop beside Up next, full width on phones below the player controls, never overlapping controls or captions.
- Before card: covers the player area only, uses the poster as backdrop with scrim 0.85, centred content max 480 px, Skip button 48 px height at the bottom right, countdown ring uses transform and opacity only.
- Image rules: square min 400 px, wide min 1200 by 400, WebP and AVIF, explicit `width` and `height` attributes, blur placeholder from `blur_color`.

Labels, contrast, states
- Label "Sponsored by NAME" as text in a chip at the card's top left, minimum 13 px, 4.5:1 against the chip colour, chip sits on the card surface not on the image, never hover only, not colour alone.
- Whole card is one link with an accessible name "Sponsored by NAME: HEADLINE". CTA is part of that link (no nested interactive element).
- Component states required: default, hover (only inside `@media (hover: hover)`, 250 ms ease-out, transform and opacity only), focus (3 px ring with 2 px offset, never `outline: none`), pressed (0 ms), disabled (not applicable), loading (skeleton at the reserved box size), image error (text card, same height), no creative (nothing rendered).
- Headline max 60, body max 140 characters, clamp to 2 and 3 lines with ellipsis, no truncation of the label or CTA. No em dashes, en dashes or emojis in copy, enforced by the footprint check and by validation of sponsor text on save.
- Dark first surface and a very different theme (dark ink on lemon, size factor 1.15) must both pass contrast, the slice 5 review runs both.

No layout shift
- The server decides the creative and renders the box at its fixed token height, so there is nothing to collapse after hydration. Frequency caps are read from the cookie on the server for the same reason. Images have fixed boxes. The banner is never inserted above content the viewer already sees. Target: banner contributes 0 to CLS in the `vitals` data.

Data saver and low end behaviour
- Data saver or `saveData`: text card, no image request, no wide creative, no before card, no impression pixel (impression is a batched event, not a request per card).
- Slow connection (effective type 2g or 3g): treated as Data saver for sponsors.
- No sponsor JS beyond a tiny tracker (target under 1.5 KB gzipped) loaded only when a card exists, and never on kids pages. Service worker never caches `/s/*` or `/api/donate/*`.
- Reduced motion: no countdown ring animation, a static "Continues in N s" text.

Keyboard and screen reader
- Before card: focus moves to Skip on open and returns to Play on close, Escape skips, polite live region "Message from a sponsor. Press Skip to continue." The card is not a focus trap, it is not modal.
- After card sits after Up next in tab order so the primary action stays first.

Donate UI
- Amount presets are a radio group styled as buttons (arrow keys move, pressed state visible, 44 px minimum). Custom amount input has a visible label, `inputmode="numeric"`, validation on blur then change. Monthly is a switch with a clear label. Button text states the exact amount and cadence. No countdowns, no guilt copy, no pre-ticked extras, no upsell, no popups.
- Thank you copy is client editable, with sane draft defaults. Receipt email uses the existing brand context (name, colours, logo) from `@ad/mailer`.

Audit alignment
- Audit section 3 "Skip: autoplay billboard video" and the DESIGN-SYSTEM rule "Don't autoplay video or audio" are respected: sponsor content is still only. Hover-only actions are avoided. "Real detail pages with their own URL" is respected, sponsors never open as modals over a title. The Netflix style row rhythm is kept: one banner per page, never above row two, never between a row title and its tiles.
- Guest analysis (audit section 5): sponsors and donations need no account and add no sign-in prompt. The `ad_spc` cookie is separate from `ad_guest` and carries no identifier.

## 9. Legal and tax notes to hand to the owner (not legal advice)

These are questions and points to take to a Nigerian lawyer and accountant before turning anything on. The platform will not decide any of them.

Organisation and money
1. Who receives the money? Donations and sponsor payments need a legal recipient: a registered company, a business name, or an incorporated trustees (NGO) entity registered with the Corporate Affairs Commission (CAC). Paystack requires business or personal verification and a settlement bank account in the same name. A personal account for an organisation's funds can cause tax and trust problems.
2. Donations versus income. Tax treatment can differ for a registered charity or NGO versus a company, and for sponsorship income versus gifts. Ask an accountant how each is recorded, whether VAT applies to sponsorship (a sponsor receiving promotion is often treated as a supply of a service), and about withholding tax on sponsor payments. Nigeria's tax laws were reformed recently, so ask for current rules rather than relying on older guides.
3. Tax receipts. Our receipt is an acknowledgement of a gift. It does not claim the gift is tax deductible. Add that wording only if the owner's organisation qualifies and counsel agrees. `donate.org_registration` is a place for the registration number.
4. Anti money laundering. Sponsors and larger donors can raise know your customer questions. Nigerian rules apply to non-profit organisations and some designated businesses (check with counsel about SCUML registration and record keeping). Paystack also screens, and may hold funds on unusual patterns.
5. Record keeping. Keep invoices to sponsors and donation records for the period the accountant specifies (commonly six years). The plan keeps amounts and references indefinitely and erases personal fields on request, which counsel should confirm.
6. Sponsor agreement. Use a short written agreement per sponsor: dates, placement, price, content approval right (the owner may refuse a sponsor), refund and termination terms, no guarantee of results, and the platform's rules (no tobacco, alcohol, betting, adult content, political advertising, or anything inappropriate for an educational site; never shown to children). Provide sponsors with the printable report as proof of delivery.
7. Advertising rules. In Nigeria, advertising is regulated by ARCON and sector rules, and consumer protection by the FCCPC. Ask counsel whether sponsor messages need ARCON vetting and confirm the label wording. The platform always labels "Sponsored".

Data protection (NDPA 2023, regulator NDPC)
8. Donor personal data (email, optional name, optional message) is personal data. Lawful basis is contract (processing the gift) and legal obligation (accounting records), not consent. Marketing emails need separate opt-in consent, off by default.
9. Paystack acts as a processor and also as an independent controller for payment and fraud purposes. The privacy notice must name Paystack and link to its notice. Card data stays on Paystack's pages, so our PCI scope is minimal, confirm with the provider.
10. International transfers. USD gifts from abroad and Paystack's systems may involve cross-border transfer. The privacy notice should say so and counsel should confirm the transfer basis. For EU, UK or US donors, ask whether any foreign rules apply at the owner's scale.
11. Add the sponsor and donation processing to the NDPA review brief next to the guest cookie and anonymous analytics id: the `ad_spc` frequency cookie (functional, no identifier), the first party click redirect, donor data fields, retention table (payment events 90 days, donation records per accountant, sponsor contacts until the campaign ends plus the record keeping period).
12. Children. No sponsor and no payment surface is reachable in kids contexts. Counsel should confirm that serving sponsor cards to general audience guests is acceptable when the platform is also designed for children, and whether the guardian declaration is enough.
13. Breach. Donor data is covered by the existing 72 hour breach runbook (`docs/SECURITY.md` section 17). Add Paystack as a notifier contact.

Provider facts to re-check before launch [VERIFY]: Paystack local card fee (about 1.5 percent plus a flat amount that is waived for small transactions, capped), minimum transaction, settlement time, whether USD is available for this business and what documents are required, whether recurring card charges and plans are enabled for the account, webhook signature header and event names.

## 10. Diaspora currency notes

- Default and launch currency is NGN, because the first audience is Nigeria and Paystack settles NGN to a Nigerian bank account.
- Paystack can accept international cards on NGN checkout, but the donor's bank converts to naira at its own rate and may add foreign transaction fees. International cards may also have a higher fee [VERIFY].
- USD checkout is possible only when Paystack has enabled USD for the business (an application with the provider, usually requiring a verified business and a domiciliary account for settlement) [VERIFY]. Until then `donate.usd.enabled` must stay off, and the admin switch refuses to turn on without a successful test initialize call in USD.
- If USD is enabled: separate presets, a separate minimum, the currency stored on each donation, reports and transparency totals per currency (never added together), receipts show the currency, and settlement to the USD account is outside the platform.
- Monthly giving in USD is a separate Paystack plan and is out of the first release of USD (S39 covers one time gifts only).
- Alternatives for a diaspora donor if USD is not available: bank transfer instructions (S40) with an international account if the owner has one, or Flutterwave (S41) which supports more currencies [VERIFY].

## 11. Decisions to log (recommended option taken)

Logged in `docs/DECISIONS.md` during slice 0 with the next free D numbers (highest on main at planning time is D-168, other lanes will use numbers before this lane merges, renumber on conflict). Placeholders `D-M48-nn` below.

| Id | Decision | Options | Recommended and why | Reversible |
|---|---|---|---|---|
| D-M48-01 | Allow labelled sponsor slots and donations despite earlier non-goals | Keep platform ad free; allow optional off by default | Allow, off by default: the client may want funding, and it costs nothing when off | Yes, flags and docs |
| D-M48-02 | Payment provider | Paystack; Flutterwave; Stripe | Paystack first: Nigeria first, NGN settlement, hosted checkout, bank transfer and USSD for donors without cards. Flutterwave as a Could behind the same interface | Yes, provider interface |
| D-M48-03 | Checkout style | Popup script; inline fields; hosted redirect | Hosted redirect: no third-party script, no card data on our servers, no CSP change | Yes |
| D-M48-04 | Sponsor format | Video ads; image cards; text only | Still image or text cards only, one link, labelled | Yes |
| D-M48-05 | Click tracking | Third-party tracker; client only fetch; first party redirect | First party redirect at `/s/{id}`, destination from the database | Yes |
| D-M48-06 | Frequency cap storage | Account based; server per IP; first party cookie | First party functional cookie `ad_spc` read on the server: works for guests, no identifier, no shift | Yes |
| D-M48-07 | Reach metric | None; hashed unique per day; exact uniques | Daily distinct count only, labelled "daily reach", counts stored not hashes | Yes |
| D-M48-08 | Kids protection | Filter in UI only; server fail closed | Server fail closed in selection, click, impression, checkout and cookie code, plus a kids matrix test | No (safety) |
| D-M48-09 | Before-video card | Forced wait; skippable at once; not offered | Skippable at once, ready media loads in parallel, never on Data saver or resume, off by default, after-video card preferred | Yes |
| D-M48-10 | Sponsor status | Stored status with cron; derived from dates | Derived from dates at read time, stored only draft, paused, archived | Yes |
| D-M48-11 | Money type | float; decimal; integer minor units | Integer minor units, per currency | No |
| D-M48-12 | Webhook trust | Trust payload; signature only; signature plus API verify | Signature plus API verify plus amount and currency check, idempotent by event key | Yes |
| D-M48-13 | Donor identity | Account required; email only | Email only, guests allowed, account link optional | Yes |
| D-M48-14 | Donor data at rest | Plain; encrypted fields | Encrypted email, name, message and raw event payloads with the existing field key, HMAC hash for lookups | No |
| D-M48-15 | Small gifts | No minimum; minimum NGN 200 | Minimum NGN 200 configurable, because flat fees dominate tiny gifts [VERIFY] | Yes |
| D-M48-16 | Donor wall | Public names; none | None, privacy and kids concerns. Transparency page shows use of funds only | Yes |
| D-M48-17 | Sponsor and donation roles | Editor can see all; split | Editor manages sponsor drafts, admin activates sponsors and alone sees donations and settings | Yes |
| D-M48-18 | Receipt wording | Tax receipt; acknowledgement | Acknowledgement only until counsel confirms | Yes |
| D-M48-19 | Reporting artefact | Sponsor portal; CSV and print page | CSV and browser printable summary, no portal | Yes |
| D-M48-20 | Test mode safety | Setting; key prefix | Mode derived from key prefix, live key refused outside production, rows tagged with mode | Yes |

## 12. Risks and dependencies

Risks

| Id | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| M48-R1 | Sponsor content appears to kids | Low | Severe | Fail closed in five places, kids matrix test, no cookie, no route |
| M48-R2 | Fake donation by forged webhook | Medium | High | Signature on raw body, API verify, amount check, idempotency, tests listed |
| M48-R3 | Card testing abuse through the donate form | Medium | High | Rate limits per IP and email hash, minimum amount, Turnstile escalation, reconcile abandons, Cloudflare rule |
| M48-R4 | Sponsors erode trust or look like ads | Medium | Medium | Still cards, strict label, caps, one banner per page, off by default, owner approves content |
| M48-R5 | Layout shift or slower pages from sponsor images | Medium | Medium | Reserved boxes, text only under Data saver, tiny tracker, CLS check |
| M48-R6 | Open redirect or phishing through sponsor links | Low | High | https only, host blocklist, database destination only, admin approval to go live, sponsor terms |
| M48-R7 | Paystack account not approved, or recurring and USD not enabled | Medium | Medium | Everything off by default, admin refuses to enable, test mode, bank transfer fallback |
| M48-R8 | Legal and tax unknowns delay turning it on | High | Medium | Owner handover list (section 9), receipts as acknowledgement, no claims |
| M48-R9 | Webhook blocked by Cloudflare or hits wrong URL | Medium | Medium | Documented WAF skip rule, reconcile job as a safety net, test event step in the launch runbook |
| M48-R10 | Frequency cap bypass by clearing cookies | High | Low | Accepted, documented, caps are courtesy not contract |
| M48-R11 | Secret key leakage | Low | Severe | Env only, redaction, never in settings, rotation entry in DEPLOYMENT.md, test key outside production |
| M48-R12 | Free plan limits reached sooner (audit note on Workers) | Medium | Low | `/s/*` and impression traffic are small, route limits |
| M48-R13 | Migration or doc conflicts with parallel lanes | High | Low | Additive migrations renumbered on rebase, append only to shared docs |

Dependencies
- Lane L1 (guest access): `Viewer` union, `ad_guest` id for reach hash, guest audience setting, Kids mode toggle. Slices 2, 3, 9 take a `viewer` and `audience` argument so they work with today's account-only code and switch to guests with no rework. If L1 is not merged, guests simply cannot reach pages, so only signed in viewers see sponsors, donations still work for anyone who can open `/donate`.
- Lane that owns the settings registry and admin Settings navigation (M29): Monetization tab placement.
- M36 image pipeline and `assets` (purpose `sponsor`).
- M19 analytics ingest and `staff_exports` (new kinds).
- M21 mailer and email outbox (templates, idempotent send).
- M23 security (rate limits, Turnstile, field encryption, redaction).
- M35 kids audience derivation (single function reused by all M48 code).
- M30 queue (new queues).
- Owner and client inputs: Paystack account and keys, organisation legal name and registration number, settlement bank account, donation copy, transparency content, sponsor rate card and agreement, legal and tax advice, whether to launch sponsors, donations or both.
- Docs amendments in slice 0 touch PRD, SECURITY and DESIGN-SYSTEM, which other lanes may also edit. Append only, keep both on conflict.

## 13. Mockup list (S160 to S169)

Mobile at 360 px and desktop at 1280 px for each, with the states named. Mockups follow the existing `/home/claude/ad/project/S*.dc.html` format, use tokens only and a very different theme variant for the sponsor label contrast check.

| Id | Screen | Mobile and desktop | States to draw |
|---|---|---|---|
| S160 | Home with sponsor banner between rows | Both | Image banner, text only (Data saver), loading skeleton at reserved size, image error fallback, no sponsor (no gap), kids mode (none) |
| S161 | Title page with sponsor card | Both | Image card, text card, long headline clamp, focus ring on the card, series page variant |
| S162 | Player message cards | Both | Before card with Skip focused and countdown, reduced motion variant, after card beside Up next, after card on phone below controls, Data saver text card |
| S163 | Admin Sponsors list and empty state | Both | Empty, list with statuses (Draft, Scheduled, Live, Paused, Ended, Archived) with icons and words, filters with no result, master switch off banner |
| S164 | Admin sponsor editor and creative upload | Both | New, uploading, processing, error, per placement preview (mobile and desktop and text only), schedule with inline date error, placement checkboxes with "Off in settings" |
| S165 | Admin sponsor report and printable summary | Both (print as A4) | Populated with chart and text table, empty, loading, error with Retry, CSV export queued and ready, print layout |
| S166 | Public Donate page | Both | Default with presets, custom amount error, monthly on, submitting, Paystack unreachable error, test mode badge, USD currency switch, bank transfer instructions, kids mode "Ask a grown-up", donate disabled (404 page) |
| S167 | Thank you, processing, failed and cancelled pages | Both | Success, "We are confirming your gift", failed with retry, cancelled, receipt email preview (HTML and plain text) |
| S168 | Admin Donations list, detail and needs review | Both | Populated, masked email with Reveal, test rows with badge, needs review with expected versus paid, refunded, export queued, empty, error |
| S169 | Transparency page, monetization settings and manage monthly gift | Both | Transparency populated and editor with percent total check, Settings Monetization tab with every switch off by default and Paystack key status (Not set, Test, Live), manage monthly page with request link and cancel confirmation |

## 14. Genuine owner questions

1. Will funds be received by a registered organisation (CAC business name, company or incorporated trustees)? Paystack onboarding and the receipt wording depend on it.
2. Are sponsors and donations both wanted at launch, or should the code ship and stay off until later? Default plan: ship both, off.
3. Which sponsor categories are refused (for example betting, alcohol, political)? Needed for the sponsor terms.
4. Is monthly giving wanted, and is USD for the diaspora wanted at launch (needs Paystack approval)?
5. Does the owner want a transparency page, and who will keep its figures up to date?

## 15. Counts

- Slices: 15 (0 to 14), plus 6 worker queue entries.
- Stories: 44 (M48-S01 to M48-S44): Must 30, Should 10, Could 4 (see section 7 headers).
- Mockups: 10 (S160 to S169).
- Decisions: 20 (D-M48-01 to D-M48-20).
- Risks: 13.
- Config keys: 38 settings keys, 5 environment variables.
- Migrations: 2 planned files (sponsors, donations), subscriptions inside the donations file.

## 16. Amendments (UI review, 24 November 2026)

Added by the UI review of this lane (`docs/reviews/v2/L9-review.md`). Where this section disagrees with sections 1 to 15, this section wins. Rulings R25, R30, R31, R38 apply. Mockups in `docs/mockups/v2/L9/` carry the same tokens in their `:root` block.

### 16.1 Sponsor tokens (replaces the token list in section 8)

Add these in slice 5 before any component: `packages/ui/src/tokens.css`, `docs/DESIGN-SYSTEM.md` section 3.1 (new "Sponsor slot" rows) and 11.24 theme editor group, and the skill copy `reference/tokens.css`. All are **Fixed** (a client theme cannot shrink the box or weaken the label). Px values are shown for the mockups, the build writes rem.

| Token | Value | Build value | Use |
|---|---|---|---|
| `--sponsor-slot-height-compact` | `calc(112px * var(--type-scale))` | `calc(7rem * var(--type-scale))` | Home and Title card and the phone after card, below 960 px |
| `--sponsor-slot-height-wide` | `calc(136px * var(--type-scale))` | `calc(8.5rem * var(--type-scale))` | Home and Title card at 960 px and up |
| `--sponsor-label-bg` | `#ECEAE3` | same | "Sponsored by" chip fill |
| `--sponsor-label-ink` | `#1A1C22` | same | Chip text. 14.15:1 on the chip, independent of the card surface |
| `--sponsor-label-size` | `calc(13px * var(--type-scale))` | `var(--text-caption)` | Chip text size, never below 13 px at the default factor |
| `--sponsor-label-height` | `calc(24px * var(--type-scale))` | `calc(1.5rem * var(--type-scale))` | Chip height |

Everything else on the card uses existing tokens: `--color-surface`, `--color-border-strong`, `--color-ink`, `--color-muted`, `--color-primary`, `--color-focus-ring`, `--color-surface-sunken` (pressed). The plan's "wide 3:1 image" stays, the image slot is 104 px (wide) or 72 px (compact) square.

Why the heights scale: the theme editor allows a size factor up to 1.15. At 1.15 the wide card needs 112 px of content in a 104 px inner box (measured). The factor is a server known setting, so the scaled box is still decided on the server and the layout shift stays 0. Measured boxes: compact 112.0 at 1.0 and 128.8 at 1.15, wide 136.0 and 156.4. The skeleton uses the same tokens, so it is the same height at both factors.

### 16.2 Phone card decision: arrow, not a text button (recorded decision D-M48-21)

| Option | For | Against |
|---|---|---|
| Text button "Learn more" inside the compact card | Plain words | The label would take about 90 px of the 190 px text column at 360. The headline would drop to 3 lines and the label chip would truncate. Needs a taller box (about 140 px) that pushes the first row down. |
| Chevron arrow, whole card is the link | Keeps 112 px, one line chip, 2 line headline, no nested control | The button wording is not visible. |

Decision (recommended option, reversible): compact variant (below 960 px) shows a 20 px chevron, `aria-hidden`. The card is one `<a>` and its accessible name is `Sponsored by NAME: HEADLINE. CTA_LABEL`, so the sponsor's button wording is still announced and the target is the whole card (328 by 112 at 360, 358 by 112 at 390), far above 44 px. The wide variant (960 and up) shows the text button from `cta_label`. No nested interactive element in either. Review again after a trial on real low end Android phones in Lagos (audit advice): if tap through is below the wide card, test a 2 line chip plus text.

Compact card geometry (measured, no clipping at 360, 390, and 1.15): padding 12, image 72, gaps 10, chevron 20, text column 190 px at 360 and 220 at 390. Content height 66 px of 86 at 1.0 and 75 of 103 at 1.15.

Label rule: the chip reads `Sponsored by NAME`. Only the name may shorten with an ellipsis. The words "Sponsored by" never truncate (`.lb1` is `flex: none`). The full name stays in the accessible name. At 360 and factor 1.0 the example name fits (185 px label in 190 px). At factor 1.15 on a 360 phone the name shortens ("Slate Bo..."). The editor hint under Sponsor name says "Under 20 characters fits small phones" (S164).

### 16.3 Contrast and theme (measured with a script, WCAG formula)

| Pair | Ratio | Result |
|---|---|---|
| Label ink `#1A1C22` on chip `#ECEAE3` | 14.15 | Pass, fixed tokens, same on every theme |
| Headline ink on card `#FFFFFF` / lemon card `#FFFEEA` | 17.03 / 16.72 | Pass |
| Body muted `#5B606B` on `#FFFFFF` / `#FFFEEA` | 6.31 / 6.19 | Pass |
| CTA blue `#1F6FB5` on `#FFFFFF` / `#FFFEEA` | 5.25 / 5.16 | Pass |
| Card edge `#8A8D94` on page `#F5F5F2` / on card white | 3.04 / 3.32 | Pass |
| Card edge `#8A8D94` on lemon page `#F7F3A6` | 2.90 | **Fail** (the theme gate in 4.3 derives a darker border) |
| Derived edge `#80838A` on lemon page / on lemon card | 3.31 / 3.73 | Pass |
| Focus ring `#1F6FB5` on page / on lemon page | 4.81 / 4.58 | Pass |
| Before card text `#B4B8C2` on the 0.85 scrim over the lightest poster (about `#2B3036`) | 6.9 | Pass |
| White on the same scrim | 13.6 | Pass |

Build rule: the sponsor card edge must be `--color-border-strong` after the theme gate has derived it, never a literal `#8A8D94`. The lemon state in S160 now uses the derived value, text size 1.15, and the scaled box.

### 16.4 Targets, hover, motion (R30, R31)

- Viewer header links and logo: 44 px tall, 44 px wide minimum, active underline drawn inside the box. Admin sidebar links 44, bell 44, account link 44.
- Switch: the element is 48 by 44 (donate switch 52 by 48), track and knob are drawn inside it. Each has a name (`aria-label` in the mockup, a `<label>` in the build) and `tabindex`.
- "See how gifts are used" moved to its own line with a 44 px target.
- Sponsor card hover is inside `@media (hover: hover) and (pointer: fine)` and only changes the edge to `--color-ink` and underlines the button text. Pressed uses `--color-surface-sunken`. Reduced motion uses `@media (prefers-reduced-motion: reduce)` and the before card shows "Continues in N s" as text with no ring.
- Axis labels on the report chart are 12 px (were 11).
- Warning marker in the date error is an SVG icon with the words, not a text symbol.

### 16.5 Kids and client inputs (R25)

- Kids never see a sponsor card, Donate button, banner or footer link. S162 now draws the kids player state. S166 keeps the "Ask a grown-up" page (M48-S34). Recommended decision (reversible): the public transparency page (S169) also answers a kids context with the same "Ask a grown-up" page, because it is a donation surface. Add that row to the kids matrix test in slice 14.
- Every mockup now opens with a "Client input" notice. Sponsor names are marked `data-client-input="sponsor name"`. Bank details read `[Bank name]`, `[Registered account name]`, `[10 digit account number]`, `[Transfer note]`. The organisation name reads `[Organisation name]` and the support email `[support email]`. These map to `donate.org_name`, `donate.bank_transfer.instructions`, `donate.receipts.reply_to`, the sponsor records, preset amounts and the transparency items. None is hardcoded.

### 16.6 Other amendments

- Failed gift state (S167) shows one action, "Try again" (R39). Home is in the header.
- S164 preview: the desktop and text only previews are drawn at their real 960 px width and shown at 45 percent so the card is not squeezed. The phone editor shows only phone previews.
- `--font-mono` (R38) is used for references, account numbers and masked emails. Tokens as in L10 section 12.1.
- Disabled "Publish changes" uses `--color-surface-sunken` with `--color-muted` text and gives a reason beside it (DESIGN-SYSTEM 4.2 rule 5).
