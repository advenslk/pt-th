#!/usr/bin/env bash
# Show theme version and panel service status.
# Usage: ./status.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

echo "==> MidnightX"
echo "local commit : $(git rev-parse HEAD)"
echo "branch       : $(git branch --show-current)"
echo "remote commit: $(git ls-remote origin "$(git branch --show-current)" | cut -f1 || true)"
echo "assets       : $(find /var/www/pterodactyl/public/midnightx/assets -maxdepth 1 -name 'index-*.js' -printf '%f\n' 2>/dev/null | head -1)"

echo "==> Panel services"
systemctl is-active php8.3-fpm nginx 2>/dev/null || true

echo "==> URLs"
echo "MidnightX  : https://spg.helzerx.cyou/"
echo "Classic    : https://spg.helzerx.cyou/?classic=1"
echo "Admin      : https://spg.helzerx.cyou/admin"
