#!/usr/bin/env bash
# Show theme version, deployed asset, last deploy time, and panel service status.
# Usage: ./status.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRANCH="$(git -C "$REPO_DIR" branch --show-current)"
cd "$REPO_DIR"

echo "==> MidnightX"
echo "local commit : $(git rev-parse HEAD)"
echo "github commit: $(git ls-remote origin "$BRANCH" | cut -f1 || true)"
echo "branch       : $BRANCH"
echo "built asset  : $(find /var/www/pterodactyl/public/midnightx/assets -maxdepth 1 -name 'index-*.js' -printf '%f\n' 2>/dev/null | head -1)"
echo "deployed at  : $(cat /var/www/pterodactyl/public/midnightx/.deployed-at 2>/dev/null || echo 'unknown')"

echo "==> Panel services"
systemctl is-active php8.3-fpm nginx 2>/dev/null || true

echo "==> URLs (MidnightX is default; ?classic=1 shows the OLD UI)"
echo "MidnightX  : https://spg.helzerx.cyou/"
echo "Classic    : https://spg.helzerx.cyou/?classic=1"
echo "Admin      : https://spg.helzerx.cyou/admin"
