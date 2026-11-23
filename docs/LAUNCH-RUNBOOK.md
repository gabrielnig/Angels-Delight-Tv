# Launch runbook

Goal: from the moment the client has supplied their inputs (`docs/CLIENT-INPUTS.md`) to a live site in about two hours of configuration. Detail on each piece is in `docs/DEPLOYMENT.md`. Estimates assume the accounts already exist and the first image build is done. Times are for one person working in order.

Conventions: `OWNER` is the machine of the owner or developer with the repository. `VPS` is the server. `<tag>` is a git sha whose images CI has built and pushed.

## Before the day (not counted in the two hours)

- Accounts opened in the client's name, developer added as a member: domain registrar, Cloudflare, VPS provider, GitHub, email sending provider. Nameservers can take up to a day to move.
- The release workflow has built and pushed the four images for the sha to release (`-web`, `-worker`, `-whisper`, `-tools`). It does not run on merge to `main`, you start it (see Release below).
- The client file `client.json`, logo, favicon, legal texts, and the video folder with `videos.csv` are on OWNER, in the shapes described in `docs/CLIENT-INPUTS.md`.

## Release: build and push the images (OWNER, about 20 minutes the first time)

The `release` workflow (`.github/workflows/release.yml`) builds the four images for linux/amd64, scans each with Trivy (it fails on CRITICAL findings that have a fix, and nothing is pushed when it fails) and pushes them to `ghcr.io/gabrielnig/angels-delight-tv-{web,worker,whisper,tools}` tagged with the full git sha and the 7 character short sha. A `v*` tag push also adds the tag name. It never runs on a plain push to `main`.

Start it from the GitHub Actions tab (Actions, release, Run workflow, branch `main`), or by tag:

```bash
git tag v1.0.0 && git push origin v1.0.0
# or, from a machine with the gh CLI
gh api -X POST repos/gabrielnig/Angels-Delight-Tv/actions/workflows/release.yml/dispatches -f ref=main
```

When the run is green, the release `<tag>` for step 7 is the full sha of the commit it ran on (also shown in the run summary). Use the full sha with `ops/deploy.sh`.

First time with GHCR (one time per package, four packages):

1. Packages are created private on first push. The workflow can push them using the repository token because the package is linked to the repository.
2. The VPS must be able to pull. Pick one:
   - Make the four packages public: GitHub, the repository owner's Packages tab, open each package, Package settings, Danger Zone, Change visibility, Public. The images hold no secrets (all configuration is injected at run time), so this is the least effort. No login is needed on the VPS then.
   - Keep them private and use a read only token on the VPS: create a classic personal access token with only the `read:packages` scope (fine grained tokens cannot read GHCR yet), owned by an account that can see the packages, then `echo <token> | docker login ghcr.io -u <github user> --password-stdin` as the deploy user. Store the token in the client's password manager. It is a credential, rotate it when staff change.
3. If a package shows a different owner or is not linked to the repository, open the package settings and use Connect repository, and under Manage Actions access give the repository write access.

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
4. Email DNS records (SPF, DKIM, DMARC) from the sending provider. Check them with the DNS check below once the records have had a few minutes to spread.

DNS check (run from any machine with the repo, after steps 1 to 3):

```bash
APP_DOMAIN=<app domain> MEDIA_DOMAIN=<media domain> EMAIL_FROM='<sender address>' \
  pnpm dns:check --vps-ip <VPS IP> --dkim-selector <selector from the provider>
```

It checks that the app domain points at the VPS (or is proxied by Cloudflare), that the media domain is the R2 custom domain and not the VPS, and that SPF, DKIM and DMARC are published and sound. A failure prints what to fix. A warning, such as DMARC `p=none`, does not block launch but should be tightened after a week of clean reports. Run it again before step 12. Add `--spf-include <name>` to require your provider's include, and `--json` for a machine readable report.

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

Contabo specific notes first, then the commands.

- Contabo emails the root password (or lets you set a password or an SSH key when ordering). The first login is therefore `ssh root@<vps ip>`. Choose Ubuntu LTS at order time. The server has a public IPv4 and, usually, an IPv6.
- Contabo has its own firewall panel (Customer Control Panel, Network, Firewall). Leave it off or on with the default allow all, and let `ufw` on the server be the only firewall. If you do turn the panel firewall on, it must allow TCP 22 from your address and TCP 80 and 443 from the Cloudflare ranges, or the site silently stops answering and `ufw` will look fine. When something is unreachable, check the panel first.
- Cloudflare and `ufw`: ports 80 and 443 are open only to Cloudflare ranges (`ops/update-cloudflare-ufw.sh`, refreshed weekly by cron). So `curl http://<vps ip>` from your laptop is meant to time out. Test through the proxied domain, never the raw IP. SSH stays open to the world on port 22 unless you restrict it to a static address, which is better. Cloudflare does not proxy SSH, so keep `ssh` pointed at the server IP, not at the proxied domain name.
- If the DNS A record is still grey cloud (not proxied) while you test, `ufw` will block you. Turn the proxy on first, or test from the VPS itself with `curl -k https://localhost`.

```bash
# 1. First login as root from OWNER
ssh root@<vps ip>

# 2. Create the deploy user and give it your key (do this before you close the root session)
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
cat ~/.ssh/authorized_keys >> /home/deploy/.ssh/authorized_keys    # root's key, or paste your public key instead
chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys

# 3. In a second terminal, confirm ssh deploy@<vps ip> works and that sudo works there. Only then:
#    set PasswordAuthentication no and PermitRootLogin no in /etc/ssh/sshd_config, then
systemctl restart ssh

# 4. Install Docker, the firewall, data folders and cron (still as root, or sudo as deploy)
apt-get update && apt-get install -y git
git clone https://github.com/gabrielnig/Angels-Delight-Tv /opt/angels-delight/repo   # private repo: use a deploy key or a read only token
bash /opt/angels-delight/repo/ops/setup-vps.sh      # Docker, firewall (SSH and Cloudflare only), data folders, cron
usermod -aG docker deploy
chown -R deploy:deploy /opt/angels-delight /opt/angelsdelight
install -m 600 -o deploy origin.pem origin.key /opt/angelsdelight/caddy/

# 5. Log out, log in again as deploy (group change), then for private images only
docker login ghcr.io -u <github user>               # the read:packages token from the Release section. Skip if the packages are public.
```

From here on use the `deploy` user, not root. `setup-vps.sh` installs the nightly backup cron and the weekly Cloudflare range refresh. Enable the 2 GB swap and the Docker log rotation from `docs/DEPLOYMENT.md` section 2 as well.

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

Then fill the values tagged `[owner]` in `.env.production`: R2 endpoint and tokens, SMTP url (or the interim `disabled` mode below), optional Turnstile and error reporting keys, the backup token and the dead man's switch url. Every variable has a tag line above it, and the container refuses to start in production if a required one is missing or insecure. Copy the finished file to the VPS as `/opt/angels-delight/.env` with mode 600.

No email yet (interim mode). If the client has not chosen an email provider by deploy day, set `SMTP_URL=disabled` and keep a real sender address in `EMAIL_FROM`. The site boots and everything except email works. What changes:

- Sign up verification, password reset, invite and notification emails are not sent. Each attempt fails with the error "Email is not configured". Rows the worker takes from the email outbox are closed at once as `failed` with that text, and nothing is retried.
- The admin dashboard shows a warning banner: "Email is not configured". Staff sign in works, but a viewer who signs up cannot verify, and nobody can reset a password by email.
- Create the owner account with `run seed-admin` (step 8) as usual, since it needs no email. Do not invite other staff until email works.
- `pnpm dns:check` always FAILS in this mode (check `email-configured`), and the smoke checklist below lists it as a launch blocker. It cannot be forgotten: go live only after this is fixed.
- To finish: put a real `smtp://` or `smtps://` url in `SMTP_URL`, re-copy the env file to the VPS, run `ops/deploy.sh <tag>` again (a restart of web and worker is enough, same tag), set up SPF, DKIM and DMARC, and run `pnpm dns:check`.
- An empty `SMTP_URL` still refuses to start. Only the exact word `disabled` is accepted, in any letter case.

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

- [ ] `pnpm dns:check` shows no FAIL lines. Launch blocker: a FAIL on `email-configured`, or the admin dashboard banner "Email is not configured", means `SMTP_URL=disabled` is still set. Fix it before go live
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
