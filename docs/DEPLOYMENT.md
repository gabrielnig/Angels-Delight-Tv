# Deployment

Status: built and verified as far as a machine with no Docker daemon allows. The files are `compose.prod.yaml`, `ops/Caddyfile`, `ops/deploy.sh`, `ops/backup.sh`, `ops/setup-vps.sh`, `ops/update-cloudflare-ufw.sh`, `ops/Dockerfile.tools` and `.env.production.example`. The step by step procedure is `docs/LAUNCH-RUNBOOK.md`, and what the client supplies is `docs/CLIENT-INPUTS.md`. Placeholders in angle brackets (`<APP_DOMAIN>`, `<MEDIA_DOMAIN>`) are filled when the client confirms the domain. Nothing here hardcodes the final name or domain.

Related: `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/DEV-SETUP.md`.

## 1. Topology

- VPS (Contabo EU, Hetzner as fallback): Caddy, web, worker, whisper, Postgres (two databases), all in Docker Compose.
- Cloudflare: DNS and proxy for `<APP_DOMAIN>`, Edge Worker on `<MEDIA_DOMAIN>`, R2 buckets `ad-originals`, `ad-media`, `ad-backups`.
- Video never flows from the VPS. Only HTML, API, playlists and 16 byte keys do.
- Account ownership (Cloudflare, domain registrar, VPS, GitHub) belongs to the client. Use the client's accounts with the developer added as a member, and record owners in the handover notes.

## 2. VPS provisioning (Ubuntu LTS)

Suggested size: 4 vCPU, 8 GB RAM, 150 GB or more disk (encode scratch, Postgres, Docker images). Confirm against the current Contabo plans.

Contabo notes: the first login is `ssh root@<ip>` with the password or key from the order email, so do the user and ssh steps below first, test a second session as `deploy`, and only then turn root login off. Contabo has its own firewall panel (Network, Firewall). Keep it off, or allow 22 from your address and 80 and 443 from the Cloudflare ranges, because it applies before `ufw` and a mismatch makes the site unreachable while `ufw` looks fine. Cloudflare proxies only the web ports, so ssh to the server IP and test the site through the proxied domain, never the raw IP (the origin firewall refuses it by design). `docs/LAUNCH-RUNBOOK.md` step 4 has the full command sequence.

```bash
# as root, once
adduser deploy && usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy       # authorized_keys only
# /etc/ssh/sshd_config: PasswordAuthentication no, PermitRootLogin no
systemctl restart ssh

apt update && apt -y upgrade
apt -y install ufw fail2ban unattended-upgrades chrony
ufw default deny incoming && ufw default allow outgoing
ufw allow 22/tcp                       # restrict to your IP if it is static
# 80 and 443 only from Cloudflare ranges (script in section 5)
ufw enable

# Docker Engine and compose plugin: install from Docker's official apt repository
usermod -aG docker deploy

timedatectl set-timezone UTC
mkdir -p /opt/angelsdelight/{backups,caddy} && chown -R deploy:deploy /opt/angelsdelight
```

Enable swap (2 GB) as a safety net for encode peaks. Set Docker log rotation in `/etc/docker/daemon.json`: `{"log-driver":"json-file","log-opts":{"max-size":"20m","max-file":"5"}}`.

## 3. Cloudflare setup

DNS and zone:
1. Add the domain to Cloudflare, switch nameservers at the registrar.
2. DNS records: `<APP_DOMAIN>` and `www` as A records to the VPS IP, proxied (orange cloud). `<MEDIA_DOMAIN>` is created by the Worker custom domain step below.
3. SSL/TLS mode Full (strict). Always Use HTTPS on. TLS 1.3 on, minimum TLS 1.2 (deliberate, see SECURITY.md section 14). HSTS enabled in the app headers.
4. Create an Origin CA certificate for `<APP_DOMAIN>`, install the cert and key on the VPS under `/opt/angelsdelight/caddy/` (mode 600).
5. Email DNS for the sending provider: SPF, DKIM, DMARC records. Verify with `pnpm dns:check` (see LAUNCH-RUNBOOK step 1).
6. Rate limiting rule (free plan allows a small number): throttle `POST /api/auth/*` per IP.
6a. Guest playback (M40): add a second rate limiting rule, or spend the one rule on a combined expression, for `POST /api/play/*/session` per IP, for example 60 requests per minute, action Managed Challenge. The app already limits guest sessions per guest id (20 a minute) and per network (120 a minute) and, when Turnstile is configured, asks for a check after 3 refusals from one network in 10 minutes. The Cloudflare rule is the outer wall that stops a flood before it reaches the VPS. Visitors behind one mobile network share an address, so keep the number generous.
7. Do not proxy any video traffic from the VPS. The media domain serves from R2 only.

R2 setup:
1. Create buckets `ad-originals`, `ad-media`, `ad-backups`. Keep `ad-originals` and `ad-backups` private with no public access and no custom domain.
2. API tokens, separate and bucket scoped:
   - `ad-web`: Object Read and Write on `ad-originals` only.
   - `ad-worker`: Object Read and Write on `ad-originals` and `ad-media`.
   - `ad-backup`: Object Read and Write on `ad-backups` only.
3. Lifecycle rule on `ad-originals`: abort incomplete multipart uploads after 7 days.
4. CORS on `ad-originals` (admin uploads):

```json
[
  {
    "AllowedOrigins": ["https://<APP_DOMAIN>"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type", "content-length"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

   Owner steps (Cloudflare dashboard, R2, `ad-originals`, Settings, CORS Policy, Add CORS policy, JSON tab, paste, Save). For the live site the origin is exactly `https://angelsdelight.tv` (no trailing slash, no path, scheme and host must match `APP_ORIGIN`; add a second entry for `https://www.<APP_DOMAIN>` only if that host serves the admin):

```json
[
  {
    "AllowedOrigins": ["https://angelsdelight.tv"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type", "content-length"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

   Check it from any shell (the preflight must answer 200 with `access-control-allow-origin` and `access-control-allow-methods` including PUT; use any key, the answer does not need a real upload):

```
curl -si -X OPTIONS "https://ad-originals.<ACCOUNT_ID>.r2.cloudflarestorage.com/originals/test" \
  -H "Origin: https://angelsdelight.tv" -H "Access-Control-Request-Method: PUT" | head -12
```

   The browser PUT goes to `https://<bucket>.<account>.r2.cloudflarestorage.com` when `S3_FORCE_PATH_STYLE=false` (the default), or to the account host when it is `true`. The app allows both origins in the admin `connect-src` (D-401), so no env change is needed. The wrangler form of the same rule uses a different shape (`{"rules":[{"allowed":{"origins":[...],"methods":[...]}}]}`) and is not needed.
5. CORS on `ad-media`: allowed origin `https://<APP_DOMAIN>`, methods `GET` and `HEAD`, headers `range`, max age 86400. The Edge Worker also sets these headers.

Media domain with signed URLs (default, `EDGE_TOKEN_MODE=worker`):
1. Deploy `apps/edge` with Wrangler. It binds the `ad-media` bucket, holds `MEDIA_URL_SECRET` as a Worker secret, and the app origin as a variable.
2. Attach the Worker to the custom domain `<MEDIA_DOMAIN>` (Worker Custom Domain). Do not also attach a public R2 custom domain to the bucket.
3. The Worker verifies `exp` and `sig`, strips them for the cache key, honours `Range`, and caches with `public, max-age=31536000, immutable`.
4. Cache rule for the host: eligible for cache, query string ignored in the cache key.
5. Budget: the free Workers plan allows 100,000 requests per day, about 1,200 plays per day. Move to the paid plan (about 5 USD per month) before that. Guest playback opens the player to anyone with the link, so expect traffic to reach this ceiling sooner than with sign in only. Guest segment URLs live 20 minutes (`limits.guest_segment_minutes`, 5 to 120), shorter than the 2 hours of a signed in viewer, so a copied link stops working quickly.

Fallback or dev-like mode (`EDGE_TOKEN_MODE=off`): attach a public R2 custom domain to `ad-media`, same cache rule. Use only temporarily, since segment URLs are then unsigned (still encrypted, key endpoint still gated).

Turnstile (optional): create a widget for `<APP_DOMAIN>` and set the two env vars. With keys set, a visitor without an account who triggers 3 refusals from one network in 10 minutes is asked for a check before the next playback session (M40). Without keys that escalation is off and only the limits apply.

## 4. Production compose

`compose.prod.yaml` in the repository root, run from the clone at `/opt/angels-delight/repo`. Images are pulled by git sha (`TAG`) from `${IMAGE_PREFIX}-web`, `-worker`, `-whisper` and `-tools`, and the VPS never builds. The `backend` network is `internal: true`, only Caddy is on `edge`. The `migrate`, `tools` and `backup` services are in the `ops` profile, so a plain `up -d` never starts them. Validate without a daemon: `ENV_FILE=.env.production.example TAG=test docker compose -f compose.prod.yaml --profile ops config -q`. Summary of properties:

| Service | Properties |
|---|---|
| `caddy` | Official image, ports 80 and 443, Caddyfile and Origin CA cert mounted read-only, restarts unless stopped |
| `web` | Image `ghcr.io/<owner>/angels-delight-web:<git-sha>`, non-root, read-only root filesystem with tmpfs `/tmp`, `env_file: .env`, healthcheck on `/api/health`, not published to the host (Caddy reaches it on the internal network) |
| `worker` | Image `...-worker:<git-sha>`, non-root, read-only root filesystem, tmpfs and a named volume for scratch, CPU limit (for example 3 of 4 cores), `nice`, no published ports, egress only to Postgres, R2 and whisper |
| `whisper` | Image `...-whisper:<git-sha>`, model volume, memory limit, CPU limit, internal network only |
| `postgres` | `postgres:17-alpine`, named volume, internal network only, tuned `shared_buffers` (about 25 percent of RAM), `max_connections` 50 |
| `migrate` | One-shot, runs with `DATABASE_URL_MIGRATE`, profile `ops`, exits after migrations |

Images are built in CI, scanned with Trivy, pushed to GHCR, and referenced by git sha and digest. The VPS never builds images.

Caddyfile essentials:

```
<APP_DOMAIN> {
    tls /etc/caddy/origin.pem /etc/caddy/origin.key
    encode zstd gzip
    request_body { max_size 2MB }
    log { output file /var/log/caddy/access.log { roll_size 50mb roll_keep 5 } }
    @noquery_log { path /api/play/* /api/hls/* }
    reverse_proxy web:3000 {
        header_up X-Real-IP {http.request.header.CF-Connecting-IP}
    }
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options nosniff
        -Server
    }
}
```

Access logs must not record query strings on `/api/play/*` and `/api/hls/*`: configure the log filter to strip `uri` queries there (Caddy `filter` with `query` replace or delete for those paths).

## 5. Origin firewall: Cloudflare ranges only

`ops/update-cloudflare-ufw.sh` downloads `https://www.cloudflare.com/ips-v4` and `ips-v6`, replaces the `ufw` rules for ports 80 and 443 with those ranges, and runs weekly from cron, which `ops/setup-vps.sh` installs. The app trusts `CF-Connecting-IP` only because the firewall guarantees traffic came through Cloudflare (`TRUSTED_PROXY_MODE=cloudflare`).

## 6. Environment and secrets on the server

- `SMTP_URL=disabled` is the supported way to deploy before email credentials exist. The apps boot, every email send fails with "Email is not configured", outbox rows close as failed, the admin dashboard shows a warning, and `pnpm dns:check` fails on `email-configured` so it blocks launch. An empty `SMTP_URL` still refuses to start. See the runbook, step 6.

- File `/opt/angels-delight/.env`, owner deploy user, mode 600. Run `pnpm secrets:generate` once on the owner's machine: it copies `.env.production.example`, fills every empty secret with fresh random values (including one password per database role, D-117) and makes the two backup keypairs in an offline folder. Secret values are never printed. Every variable in the example carries a tag: client, owner, generated, default or applied.
- The migrator password is in the same file but only the `migrate` and `tools` services read it, and compose builds each container's connection strings from its own role only.
- `FIELD_KEK` and `HLS_KEK` are also stored offline by the owner (password manager plus a printed or encrypted copy). Losing them is unrecoverable.
- Never commit, paste into chat tools, or echo these values in CI logs.
- Viewer notification email (M44-S15). The digest goes out at 07:20 Lagos time (weekly on Monday) from the same sender as other mail, so set `EMAIL_FROM` to an address on a domain with SPF and DKIM (the `pnpm dns:check` mail checks). Every digest carries a `List-Unsubscribe` header and a link to `/unsubscribe/notices?token=...` on `APP_ORIGIN`, so that path must be reachable without a session (it is, and it is excluded from search). The link token is signed with a key derived from `FIELD_KEK` and lasts one year, so rotating `FIELD_KEK` makes old links say the link is not valid. Give the worker `EMAIL_HASH_PEPPER` too, so it can skip addresses on the bounce and complaint list.

## 7. Deploy procedure

CI (`.github/workflows/ci.yml`) on pull requests and merge to `main`: affected tests, lint, typecheck, audit, secret scan, Semgrep, build, a11y and Lighthouse. It does not build images.

Images come from the separate `release` workflow (`.github/workflows/release.yml`). It runs only on manual dispatch (Actions tab, release, Run workflow) or when a `v*` tag is pushed. For each of web, worker, whisper and tools it builds linux/amd64 with buildx and the GitHub Actions cache, scans with Trivy (fails on CRITICAL findings that have a fixed version, before anything is pushed), and pushes `ghcr.io/gabrielnig/angels-delight-tv-<name>` tagged with the full git sha, the 7 character short sha and, for tag pushes, the tag name. It authenticates with the job's `GITHUB_TOKEN` (`packages: write`), no stored secret. The web, worker and tools images build from the repository root (`docker build -f apps/web/Dockerfile .`), whisper from `apps/whisper`. Deploy is a manual, reviewed step at launch, automated later if wanted.

First time with GHCR: new packages are private. Either make the four packages public (Package settings, Danger Zone, Change visibility), or log in on the VPS with a classic personal access token that has only `read:packages` (`docker login ghcr.io`). The images contain no secrets. Details are in `docs/LAUNCH-RUNBOOK.md`, Release.

```bash
# on the VPS as deploy, with <sha> being the tag to release
cd /opt/angelsdelight
export TAG=<sha>
docker compose -f compose.prod.yaml pull
docker compose -f compose.prod.yaml run --rm migrate          # aborts the deploy on failure
docker compose -f compose.prod.yaml up -d --remove-orphans
curl -fsS https://<APP_DOMAIN>/api/ready
docker compose -f compose.prod.yaml ps
```

`ops/deploy.sh <sha>` wraps these steps: it checks out the ref, pulls, starts Postgres, runs `migrate` (the deploy stops there if it fails, and the running release is untouched), restarts, waits up to 120 seconds for `/healthz` inside the web container, and records the release in `/opt/angels-delight/.deploy/current` (the one before it in `previous`). If the new release is not healthy it redeploys the previous one and exits non zero. `ops/deploy.sh --rollback` redeploys `previous` without migrating. The health endpoints are `/healthz` and `/readyz`, aliases of `/api/health` and `/api/ready`.

Migration policy (expand and contract): every migration must work with both the previous and the new app version. Add columns and tables first, backfill, switch the code, remove old structures in a later release. This allows image rollback without a database restore. Destructive migrations require a fresh backup taken immediately before.

Maintenance mode: Caddy serves a 503 page from `MAINTENANCE_DIR` (default `/opt/angelsdelight/maintenance`) when the flag file `ON` exists there next to `maintenance.html` (`touch` it to turn on, remove it to turn off). Used for restores and risky migrations.

## 8. Rollback

1. Application: `ops/deploy.sh --rollback`. Works because migrations are backward compatible.
2. Database: restore only when data was damaged (section 10). Put the site in maintenance mode first.
3. Edge Worker: `wrangler rollback` to the previous version.
4. Cloudflare settings: changes are recorded in the audit log of the account, revert manually.
5. After any rollback, write a `LESSONS.md` entry.

## 9. Monitoring

- Uptime checks (a free external monitor, every minute, alert after 3 failures by email and push) on `https://<APP_DOMAIN>/healthz`, `https://<APP_DOMAIN>/readyz` and `https://<APP_DOMAIN>/api/health/worker` (503 when the worker has not reported for 5 minutes, M24-S02 AC2), plus a certificate expiry check that alerts 14 days out. Also a synthetic check that fetches a known public image from `https://<MEDIA_DOMAIN>/...` with a valid signature. Alert by email and phone push.
- Host: disk usage above 85 percent, memory pressure, container restarts, failed backups (the backup script pings a dead man's switch URL on success).
- App: admin dashboard shows queue depth, failed jobs, last encode durations. Postgres `pg_stat_statements` enabled for slow query review.
- Cloudflare analytics: cache hit ratio for the media host, Worker request count against the plan limit.
- Sentry (optional): `SENTRY_DSN` for web and worker, `sendDefaultPii: false`, scrubber on. Sentry hosted outside Nigeria is a cross-border transfer, so list it in the privacy notice, or run self-hosted GlitchTip instead (Sentry SDK compatible). Alert thresholds per SECURITY.md section 17. Auto-fix proposals are advisory and applied by a human as ARKDEV.

## 10. Backups and restore

| What | How | Where | Retention |
|---|---|---|---|
| Main database | Nightly `pg_dump --format=custom` as the postgres superuser, encrypted with AES-256-GCM whose key is wrapped with the owner's RSA public key (D-116) | `ad-backups/db/` and 7 days on the VPS | 14 daily plus 8 weekly (D-132) |
| Keys database | Nightly dump, encrypted with a different RSA keypair | `ad-backups/keys/` | 14 daily, 14 days maximum and no weekly copies, so shredded DEKs leave backups quickly |
| R2 media and originals | No copy of media (re-derivable from originals). Originals: ask the client to keep a second copy of source files | Client drive | n/a |
| Configuration | `compose.prod.yaml`, Caddyfile, Worker config are in git. `.env` is stored by the owner | Password manager | n/a |

Targets: RPO 24 hours, RTO 4 hours. A restore is rehearsed before launch and then quarterly: restore both dumps to a scratch Postgres, start the app against it, log in, play a video. Upgrade path if RPO matters more: WAL archiving with pgBackRest.

Every backup has a manifest next to it (`<name>.manifest.json`) with its key, time, size and SHA-256. The restore tool checks the stored bytes against it before decrypting and refuses a mismatch. Retention keeps the newest backup of each of the last 14 days that have one, then one per week for the 8 weeks before that (main database only), and deletes a backup together with its manifest. Counts come from `BACKUP_KEEP_DAILY` and `BACKUP_KEEP_WEEKLY`.

Backup credentials use the `ad-backup` token only. The private keys never sit on the VPS. Backups run nightly from cron (`ops/backup.sh`), pick files by the UTC timestamp in the name, and ping `BACKUP_PING_URL` on success so a missed night raises an alert. Restore with `pnpm backup:restore --target db --private-key <file> --target-url <scratch database url>`. It refuses the live database names (D-118). The restore test is `packages/launch/src/backup/restore.int.test.ts`, which needs `TEST_DATABASE_ADMIN_URL` and `pg_dump`/`pg_restore` on the path.

## 11. Cost notes

Brief figures: about 12 to 17 USD per month running, about 40 to 45 USD to launch. Breakdown for planning (estimates, verify current prices):

| Item | Estimate |
|---|---|
| VPS (Contabo EU 4 vCPU, 8 GB class) | the largest line item, confirm current plan |
| Domain | a `.tv` name costs noticeably more per year than `.com`. Confirm before buying |
| Cloudflare plan and Turnstile | free |
| R2 storage | about 40 GB for 13 hours across four renditions, plus originals, at roughly 0.015 USD per GB per month is under a few USD. Egress is free. Operations are negligible because the CDN absorbs reads |
| Edge Worker | free up to 100,000 requests per day, then about 5 USD per month |
| Email | free tier of a transactional provider (a few hundred per day) |
| Sentry or GlitchTip | free tier or self-hosted |
| Backups | a few GB in R2, negligible |

Cost watch items: Worker request volume, R2 operations if cache hit ratio drops, VPS disk growth from Docker images and logs. Whisper and FFmpeg run on the VPS, so there is no per-minute processing cost.

## 12. Secret rotation

| Secret | Procedure |
|---|---|
| `PLAYBACK_TOKEN_SECRET` | Add the new secret with a new `kid`, deploy (both accepted), wait 1 hour, remove the old |
| `MEDIA_URL_SECRET` | Deploy the Worker accepting both, update the app, wait 3 hours, remove the old |
| `HLS_KEK` | Set `HLS_KEK_PREVIOUS`, run the re-wrap tool over `video_keys`, remove the previous |
| `FIELD_KEK` | Set `FIELD_KEK_PREVIOUS`, run the re-wrap tool over `user_keys`, remove the previous |
| `EMAIL_HASH_PEPPER` | Rotation needs re-hashing every email, which needs decryption: run the migration tool inside a maintenance window |
| Database passwords | `ALTER ROLE ... PASSWORD`, update `.env`, restart containers |
| R2 tokens | Create new token, update `.env` and Worker, restart, delete old |
| Cloudflare and VPS access | Remove departed users, rotate API tokens, review SSH keys |

## 13. Launch checklist

```
[ ] Release workflow green for the sha to deploy, four images in GHCR, VPS can pull them (public packages or read only token)
[ ] SMTP_URL is a real smtp url, not `disabled` (no "Email is not configured" banner on the admin dashboard, dns:check has no FAIL)
[ ] Client confirmed: name, domain, logo, colours, content, languages, rights to all content
[ ] Domain bought in the client's account, nameservers on Cloudflare
[ ] VPS in the client's account, hardened (section 2), updates on
[ ] R2 buckets, tokens, CORS, lifecycle rule created (section 3)
[ ] Edge Worker deployed, unsigned and bad-signature requests return 403
[ ] Origin CA cert installed, Full (strict) on, origin firewall allows only Cloudflare
[ ] .env created on the server, offline copies of KEKs stored
[ ] Migrations applied, first Super admin created (`pnpm db:seed:admin`) with MFA enrolled
[ ] SECURITY.md pre-deployment checklist fully ticked
[ ] Email SPF, DKIM, DMARC verified, signup and reset emails land in inbox
[ ] All 100 videos uploaded, encoded, captions reviewed and approved, categories and home rows curated
[ ] Theme published with the client's final colours, contrast warnings resolved
[ ] Privacy notice and terms published, legal versions set in settings
[ ] Backup run, restore rehearsed, dead man's switch live
[ ] Uptime monitors and alerts live, on-call contact agreed
[ ] Real device pass: low-end Android on mobile data, iPhone Safari, desktop
[ ] Load check done, cache hit ratio healthy
[ ] Rollback rehearsed once
[ ] Handover: owners of each account recorded, credentials transferred through the client's password manager
[ ] ai-context.md, CHANGELOG.md and these docs updated to match reality
```

## 14. Donations and sponsors (lane L9, M48)

Everything here is off until the owner sets the Paystack keys and switches `donate.enabled` on in Settings.

- **Secrets.** `PAYSTACK_SECRET_KEY` (a `sk_test_` key anywhere, a `sk_live_` key only in production) and `DONATE_RECEIPT_TOKEN_SECRET` (32 random bytes, generated with `pnpm secrets:generate`) must both be set, or `/donate`, `/api/donate/*` and the webhook answer 404. Set `PAYSTACK_BASE_URL` only for a test double.
- **Webhook URL.** In the Paystack dashboard, Settings, API Keys and Webhooks, set the live and test webhook URL to `https://<domain>/api/webhooks/paystack`. The signature header is `x-paystack-signature`. Paystack retries for up to 72 hours, so a short outage loses nothing.
- **Cloudflare rate rule.** Add a rate limiting rule for `/api/donate/checkout` (for example 10 requests per minute per address, block for 10 minutes) and for `/s/*`. The application also limits by address and by hashed donor email, so this is a second layer.
- **Cloudflare WAF skip rule.** Add a skip rule for `POST /api/webhooks/paystack` so Bot Fight Mode, managed challenges and the rate rule never challenge Paystack. The route is protected by the HMAC signature, not by an address list (Paystack publishes no stable source addresses).
- **Order of go live.** Test key, make a test gift with a Paystack test card, check the donation in `/admin/donations` shows a Test badge and a receipt in the outbox, then swap in the live key, restart web and worker, and make one real small gift.
- **Rotation.** To rotate `PAYSTACK_SECRET_KEY`, roll the key in the Paystack dashboard, update the secret on the server, restart web and worker together. Events signed by the old key during the gap are retried by Paystack. Rotating `DONATE_RECEIPT_TOKEN_SECRET` only makes old thank you links show the state without the amount.
- **Content security policy.** Unchanged. Donors leave the site for Paystack's hosted page by navigation, so no new origin is added to any directive.

