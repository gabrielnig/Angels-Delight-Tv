# Launch runbook

Goal: from the moment the client has supplied their inputs (`docs/CLIENT-INPUTS.md`) to a live site in about two hours of configuration. Detail on each piece is in `docs/DEPLOYMENT.md`. Estimates assume the accounts already exist and the first image build is done. Times are for one person working in order.

Conventions: `OWNER` is the machine of the owner or developer with the repository. `VPS` is the server. `<tag>` is a git sha whose images CI has built and pushed.

## Before the day (not counted in the two hours)

- Accounts opened in the client's name, developer added as a member: domain registrar, Cloudflare, VPS provider, GitHub, email sending provider. Nameservers can take up to a day to move.
- CI has built and pushed the four images for the sha to release (`-web`, `-worker`, `-whisper`, `-tools`). The `main` workflow does this on merge.
- The client file `client.json`, logo, favicon, legal texts, and the video folder with `videos.csv` are on OWNER, in the shapes described in `docs/CLIENT-INPUTS.md`.

## Steps

| # | Step | Where | Time |
|---|---|---|---|
| 1 | Domain and Cloudflare zone | browser | 10 min |
| 2 | R2 buckets, tokens, media domain | browser | 15 min |
| 3 | Edge Worker | OWNER | 10 min |
| 4 | VPS setup | VPS | 15 min |
| 5 | Secrets | OWNER | 5 min |
| 6 | Config file and env values | OWNER | 10 min |
| 7 | First deploy | VPS | 10 min |
| 8 | Owner account and client config | VPS | 10 min |
| 9 | Content import | VPS | 15 min plus encode time |
| 10 | Caption review | browser | client paced |
| 11 | Smoke checklist | browser | 15 min |
| 12 | Go live | browser | 5 min |

### 1. Domain and Cloudflare zone (10 min)

1. Add the domain to Cloudflare and switch the nameservers at the registrar.
2. DNS: A records for the app domain and `www` to the VPS IP, proxied. SSL/TLS Full (strict), Always Use HTTPS on.
3. Create an Origin CA certificate for the app domain. Save the certificate and private key as `origin.pem` and `origin.key` for step 4 (the names Caddy reads, see `ops/Caddyfile`).
4. Email DNS records (SPF, DKIM, DMARC) from the sending provider.

### 2. R2 buckets, tokens and media domain (15 min)

1. Create buckets `ad-originals`, `ad-media`, `ad-backups`. Only `ad-media` gets a public custom domain, set in step 3.
2. Create three bucket scoped tokens: `ad-web` (originals), `ad-worker` (originals and media), `ad-backup` (backups only). Copy the keys into a password manager, not a chat.
3. Apply the CORS rule on `ad-originals` and the multipart lifecycle rule exactly as in `docs/DEPLOYMENT.md` section 3.

### 3. Edge Worker (10 min)

```bash
cd apps/edge
pnpm wrangler secret put MEDIA_URL_SECRET   # paste the value from step 5 after you have generated it, or come back to this step
pnpm deploy                                 # wrangler deploy
```

Attach the media domain to the Worker as a custom domain in the Cloudflare dashboard. Rollback: `pnpm wrangler rollback`.

### 4. VPS setup (15 min)

```bash
ssh root@<vps>
git clone https://github.com/gabrielnig/Angels-Delight-Tv /opt/angels-delight/repo
bash /opt/angels-delight/repo/ops/setup-vps.sh      # Docker, firewall (SSH and Cloudflare only), data folders, cron
install -m 600 origin.pem origin.key /opt/angelsdelight/caddy/
docker login ghcr.io                                 # a read only token for the images
```

`setup-vps.sh` installs the nightly backup cron and the weekly Cloudflare range refresh.

### 5. Secrets (5 min)

On OWNER:

```bash
pnpm secrets:generate
```

This creates `.env.production` from `.env.production.example`, fills every empty secret (database role passwords, session and signing keys, `FIELD_KEK`, `HLS_KEK`, `MEDIA_URL_SECRET`) and writes the two backup keypairs into `offline-keys/`. Nothing secret is printed.

1. Move `offline-keys/` into the owner's password manager and a second offline copy. Do not copy it to the VPS. Losing the private keys makes the backups unreadable, and losing `FIELD_KEK` or `HLS_KEK` is unrecoverable.
2. Put the Worker secret now if step 3 was skipped: `MEDIA_URL_SECRET` from `.env.production`.

### 6. Config file and env values (10 min)

```bash
cp client.example.json client.json         # fill it from the client's inputs
pnpm launch:apply --config client.json --env-only --dry-run   # shows which env values it will set
pnpm launch:apply --config client.json --env-only             # writes domain, origins and sender name into .env.production
```

Then fill the values tagged `[owner]` in `.env.production`: R2 endpoint and tokens, SMTP url, optional Turnstile and error reporting keys, the backup token and the dead man's switch url. Every variable has a tag line above it, and the container refuses to start in production if a required one is missing or insecure. Copy the finished file to the VPS as `/opt/angels-delight/.env` with mode 600.

### 7. First deploy (10 min)

```bash
cd /opt/angels-delight/repo
ops/deploy.sh <tag>
```

The script pulls the images, starts Postgres (the first start creates the roles and both databases), runs the migrations, starts everything and waits for the web container to answer `/healthz`. If anything fails it stops or rolls back and tells you which step. Confirm from outside: `curl -fsS https://<domain>/readyz` returns `{"ok":true,...}` with database, storage and queue all ok.

### 8. Owner account and client config (10 min)

The tools run in the `tools` image through compose. Put `client.json`, `brand/` and `legal/` in `/opt/angelsdelight/client` first (mounted read only at `/client`).

```bash
cd /opt/angels-delight/repo
run() { TAG=$(cat /opt/angels-delight/.deploy/current) ENV_FILE=/opt/angels-delight/.env docker compose --env-file /opt/angels-delight/.env --profile ops run --rm tools "$@"; }
run seed-admin                                   # interactive: creates the first Super admin: asks for the email and a password, never reads them from the environment
run apply --config /client/client.json --dry-run
run apply --config /client/client.json
```

`apply` is idempotent: run it again after any change to `client.json` and only the changed steps report `changed`. It validates everything first and writes nothing if the file has problems. PWA icons are written to `/opt/angelsdelight/brand` and served from `/brand-icons/`.

### 9. Content import (15 min plus encode time)

Copy the video folder and `videos.csv` to `/opt/angelsdelight/content` (mounted read only at `/content`).

```bash
run import --dir /content --manifest /content/videos.csv --admin-email <owner email> --dry-run   # validates every row first
run import --dir /content --manifest /content/videos.csv --admin-email <owner email>
```

Safe to repeat: files already imported (matched by checksum) are skipped, and an interrupted part upload resumes. The worker encodes in the background. Watch progress in the admin encoding status table or `docker compose logs -f worker`. A script file named in the manifest makes captions run in align mode, which is much faster and more accurate than transcribing.

### 10. Caption review (client paced)

In the admin, open each video's captions, fix names and Nigerian English terms, and publish. Captions auto generated from audio need review. Aligned scripts usually need only a spot check.

### 11. Smoke checklist (15 min)

- [ ] `https://<domain>` loads over https with the client's name, logo and colours
- [ ] `https://<domain>/readyz` is ok, `https://<media domain>` serves an image with a valid signature and refuses an unsigned one
- [ ] Sign up, verify email arrives with the right sender name, log in, log out
- [ ] Owner login asks for MFA and the owner can reach the admin
- [ ] A video plays from start to finish on a phone over mobile data, quality switches, captions show
- [ ] Install the PWA to the home screen: name and icon are the client's
- [ ] Legal pages (terms, privacy, about, help) show the client's text
- [ ] Admin: upload one new video end to end and see it reach `ready`
- [ ] `ops/backup.sh` runs once by hand and an encrypted file appears under `db/` and `keys/` in `ad-backups`
- [ ] Restore rehearsal on OWNER with the offline private key into a scratch database (below)
- [ ] `ops/lighthouse/run.sh https://<domain>/` passes its budget
- [ ] `docker compose ps` shows everything healthy, and an uptime monitor is on `/readyz`

Restore rehearsal:

```bash
pnpm backup:restore --target db --private-key offline-keys/backup-db-private.pem --target-url postgres://postgres:<pw>@localhost:5433/ad_scratch
```

### 12. Go live (5 min)

1. Remove the maintenance flag file `/opt/angelsdelight/maintenance/ON` if it exists.
2. Announce. Keep an eye on `docker compose logs -f web worker` and the uptime monitor for the first hour.
3. Record in the handover notes who owns each account.

## Rollback

| Problem | Action |
|---|---|
| New release unhealthy | `ops/deploy.sh` rolls back by itself and exits non zero |
| Bad release found later | `ops/deploy.sh --rollback` (migrations are backward compatible, so no database restore is needed) |
| Failed migration | Nothing was changed. Fix forward and deploy a new tag |
| Bad Worker | `pnpm wrangler rollback` in `apps/edge` |
| Damaged data | `touch /opt/angelsdelight/maintenance/ON` (with `maintenance.html` beside it), restore into a scratch database with `backup:restore`, check it, then swap by hand. Never restore over the live database, the tool refuses |
| Bad client config | Fix `client.json` and run `apply` again. It reports what changed |

After any rollback, add a lessons entry.
