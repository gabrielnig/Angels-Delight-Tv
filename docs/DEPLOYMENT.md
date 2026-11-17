# Deployment

Status: design stage, no environment exists yet. Placeholders in angle brackets (`<APP_DOMAIN>`, `<MEDIA_DOMAIN>`) are filled when the client confirms the domain. Nothing here hardcodes the final name or domain.

Related: `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/DEV-SETUP.md`.

## 1. Topology

- VPS (Contabo EU, Hetzner as fallback): Caddy, web, worker, whisper, Postgres (two databases), all in Docker Compose.
- Cloudflare: DNS and proxy for `<APP_DOMAIN>`, Edge Worker on `<MEDIA_DOMAIN>`, R2 buckets `ad-originals`, `ad-media`, `ad-backups`.
- Video never flows from the VPS. Only HTML, API, playlists and 16 byte keys do.
- Account ownership (Cloudflare, domain registrar, VPS, GitHub) belongs to the client. Use the client's accounts with the developer added as a member, and record owners in the handover notes.

## 2. VPS provisioning (Ubuntu LTS)

Suggested size: 4 vCPU, 8 GB RAM, 150 GB or more disk (encode scratch, Postgres, Docker images). Confirm against the current Contabo plans.

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
5. Email DNS for the sending provider: SPF, DKIM, DMARC records.
6. Rate limiting rule (free plan allows a small number): throttle `POST /api/auth/*` per IP.
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

5. CORS on `ad-media`: allowed origin `https://<APP_DOMAIN>`, methods `GET` and `HEAD`, headers `range`, max age 86400. The Edge Worker also sets these headers.

Media domain with signed URLs (default, `EDGE_TOKEN_MODE=worker`):
1. Deploy `apps/edge` with Wrangler. It binds the `ad-media` bucket, holds `MEDIA_URL_SECRET` as a Worker secret, and the app origin as a variable.
2. Attach the Worker to the custom domain `<MEDIA_DOMAIN>` (Worker Custom Domain). Do not also attach a public R2 custom domain to the bucket.
3. The Worker verifies `exp` and `sig`, strips them for the cache key, honours `Range`, and caches with `public, max-age=31536000, immutable`.
4. Cache rule for the host: eligible for cache, query string ignored in the cache key.
5. Budget: the free Workers plan allows 100,000 requests per day, about 1,200 plays per day. Move to the paid plan (about 5 USD per month) before that.

Fallback or dev-like mode (`EDGE_TOKEN_MODE=off`): attach a public R2 custom domain to `ad-media`, same cache rule. Use only temporarily, since segment URLs are then unsigned (still encrypted, key endpoint still gated).

Turnstile (optional): create a widget for `<APP_DOMAIN>` and set the two env vars.

## 4. Production compose

`/opt/angelsdelight/compose.prod.yaml` (summary of required properties):

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

`scripts/update-cloudflare-ufw.sh` (to be added in the repo) downloads `https://www.cloudflare.com/ips-v4` and `ips-v6`, replaces the `ufw` rules for ports 80 and 443 with those ranges, and runs weekly from cron. The app trusts `CF-Connecting-IP` only because the firewall guarantees traffic came through Cloudflare (`TRUSTED_PROXY_MODE=cloudflare`).

## 6. Environment and secrets on the server

- File `/opt/angelsdelight/.env`, owner root, mode 600, created from `.env.example` names. Values generated on the server with `openssl rand -base64 32` where a random secret is needed.
- Owner-level `DATABASE_URL_MIGRATE` is stored in a separate file `/opt/angelsdelight/.env.migrate` (mode 600), passed only to the `migrate` service.
- `FIELD_KEK` and `HLS_KEK` are also stored offline by the owner (password manager plus a printed or encrypted copy). Losing them is unrecoverable.
- Never commit, paste into chat tools, or echo these values in CI logs.

## 7. Deploy procedure

CI (GitHub Actions) on merge to `main`: affected tests, lint, typecheck, audit, gitleaks, Semgrep, build and scan images, push tagged images. Deploy is a manual, reviewed step at launch, automated later if wanted.

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

`scripts/deploy.sh <sha>` wraps these steps, records the previous tag in `/opt/angelsdelight/.last-good` and the new one after the health check passes.

Migration policy (expand and contract): every migration must work with both the previous and the new app version. Add columns and tables first, backfill, switch the code, remove old structures in a later release. This allows image rollback without a database restore. Destructive migrations require a fresh backup taken immediately before.

Maintenance mode: Caddy serves a static page (`/opt/angelsdelight/caddy/maintenance.html`) when a flag file exists. Used for restores and risky migrations.

## 8. Rollback

1. Application: `TAG=$(cat .last-good) docker compose -f compose.prod.yaml up -d`. Works because migrations are backward compatible.
2. Database: restore only when data was damaged (section 10). Put the site in maintenance mode first.
3. Edge Worker: `wrangler rollback` to the previous version.
4. Cloudflare settings: changes are recorded in the audit log of the account, revert manually.
5. After any rollback, write a `LESSONS.md` entry.

## 9. Monitoring

- Uptime checks (a free external monitor) on `https://<APP_DOMAIN>/api/ready` and on a synthetic check that fetches a known public image from `https://<MEDIA_DOMAIN>/...` with a valid signature. Alert by email and phone push.
- Host: disk usage above 80 percent, memory pressure, container restarts, failed backups (the backup script pings a dead man's switch URL on success).
- App: admin dashboard shows queue depth, failed jobs, last encode durations. Postgres `pg_stat_statements` enabled for slow query review.
- Cloudflare analytics: cache hit ratio for the media host, Worker request count against the plan limit.
- Sentry (optional): `SENTRY_DSN` for web and worker, `sendDefaultPii: false`, scrubber on. Sentry hosted outside Nigeria is a cross-border transfer, so list it in the privacy notice, or run self-hosted GlitchTip instead (Sentry SDK compatible). Alert thresholds per SECURITY.md section 17. Auto-fix proposals are advisory and applied by a human as ARKDEV.

## 10. Backups and restore

| What | How | Where | Retention |
|---|---|---|---|
| Main database | Nightly `pg_dump --format=custom`, encrypted with `age` to the owner's public key | `ad-backups/db/` and 7 days on the VPS | 35 days |
| Keys database | Nightly dump, encrypted separately with a different `age` key | `ad-backups/keys/` | 14 days maximum, so shredded DEKs leave backups quickly |
| R2 media and originals | No copy of media (re-derivable from originals). Originals: ask the client to keep a second copy of source files | Client drive | n/a |
| Configuration | `compose.prod.yaml`, Caddyfile, Worker config are in git. `.env` is stored by the owner | Password manager | n/a |

Targets: RPO 24 hours, RTO 4 hours. A restore is rehearsed before launch and then quarterly: restore both dumps to a scratch Postgres, start the app against it, log in, play a video. Upgrade path if RPO matters more: WAL archiving with pgBackRest.

Backup credentials use the `ad-backup` token only. The `age` private keys never sit on the VPS.

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
[ ] Client confirmed: name, domain, logo, colours, content, languages, rights to all content
[ ] Domain bought in the client's account, nameservers on Cloudflare
[ ] VPS in the client's account, hardened (section 2), updates on
[ ] R2 buckets, tokens, CORS, lifecycle rule created (section 3)
[ ] Edge Worker deployed, unsigned and bad-signature requests return 403
[ ] Origin CA cert installed, Full (strict) on, origin firewall allows only Cloudflare
[ ] .env created on the server, offline copies of KEKs stored
[ ] Migrations applied, first admin created with MFA enrolled
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
