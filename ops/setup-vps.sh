#!/usr/bin/env bash
# One-time VPS preparation on a fresh Ubuntu or Debian server. Run as root: bash ops/setup-vps.sh
# Installs Docker, creates the data directories, enables the firewall (SSH plus Cloudflare ranges only) and the cron.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run as root" >&2; exit 1; }
APP_DIR="${APP_DIR:-/opt/angels-delight}"
DATA_DIR="${DATA_DIR:-/opt/angelsdelight}"

command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
apt-get install -y --no-install-recommends ufw curl git
mkdir -p "$APP_DIR" "$DATA_DIR"/{brand,backups,client,content,caddy,maintenance}
chown -R 1000:1000 "$DATA_DIR/brand" "$DATA_DIR/backups"

ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
bash "$(dirname "$0")/update-cloudflare-ufw.sh"
ufw --force enable

cat >/etc/cron.d/angels-delight <<CRON
0 2 * * * root APP_DIR=$APP_DIR $APP_DIR/repo/ops/backup.sh >> /var/log/ad-backup.log 2>&1
17 4 * * 1 root $APP_DIR/repo/ops/update-cloudflare-ufw.sh >> /var/log/ad-ufw.log 2>&1
CRON
echo "VPS ready. Next: clone the repo to $APP_DIR/repo, put the env file at $APP_DIR/.env, then ops/deploy.sh <tag>."
