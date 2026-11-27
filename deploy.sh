#!/usr/bin/env bash
# Build MidnightX and install it into the local Pterodactyl panel.
# Usage: ./deploy.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PANEL_DIR="${PANEL_DIR:-/var/www/pterodactyl}"
THEME_DIR="$PANEL_DIR/public/midnightx"

echo "==> Source commit: $(git -C "$REPO_DIR" rev-parse --short HEAD)"
echo "==> Installing dependencies"
cd "$REPO_DIR"
npm install --legacy-peer-deps

echo "==> Building theme"
npm run build

echo "==> Copying assets to $THEME_DIR"
mkdir -p "$THEME_DIR"
rm -rf "$THEME_DIR"/{*,.[!.]*}
cp -r "$REPO_DIR"/dist/* "$THEME_DIR"/
chown -R www-data:www-data "$THEME_DIR"

JS="$(find "$THEME_DIR/assets" -maxdepth 1 -name 'index-*.js' -printf '%f\n' 2>/dev/null | head -1 || true)"
CSS="$(find "$THEME_DIR/assets" -maxdepth 1 -name 'index-*.css' -printf '%f\n' 2>/dev/null | head -1 || true)"
if [[ -z "$JS" || -z "$CSS" ]]; then
  echo "ERROR: build assets missing in $THEME_DIR/assets" >&2
  exit 1
fi
date -u +'%Y-%m-%dT%H:%M:%SZ' > "$THEME_DIR/.deployed-at"
echo "==> Installed JS: $JS"
echo "==> Installed CSS: $CSS"

echo "==> Refreshing Laravel caches"
cd "$PANEL_DIR"
chown -R www-data:www-data "$PANEL_DIR/storage" "$PANEL_DIR/bootstrap/cache"
runuser -u www-data -- php artisan view:clear
runuser -u www-data -- php artisan route:clear
runuser -u www-data -- php artisan view:cache
runuser -u www-data -- php artisan route:cache

echo "==> Done. Open https://spg.helzerx.cyou/ (NOT /?classic=1) and hard-refresh once."
