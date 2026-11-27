#!/usr/bin/env bash
# Build MidnightX and install it into the local Pterodactyl panel.
# Usage: ./deploy.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PANEL_DIR="${PANEL_DIR:-/var/www/pterodactyl}"
THEME_DIR="$PANEL_DIR/public/midnightx"

echo "==> Installing dependencies"
cd "$REPO_DIR"
npm install --legacy-peer-deps

echo "==> Building theme"
npm run build

echo "==> Copying assets to $THEME_DIR"
mkdir -p "$THEME_DIR"
rm -rf "$THEME_DIR"/*
cp -r "$REPO_DIR"/dist/* "$THEME_DIR"/
chown -R www-data:www-data "$THEME_DIR"

echo "==> Refreshing Laravel caches"
cd "$PANEL_DIR"
chown -R www-data:www-data "$PANEL_DIR/storage" "$PANEL_DIR/bootstrap/cache"
runuser -u www-data -- php artisan view:clear
runuser -u www-data -- php artisan route:clear
runuser -u www-data -- php artisan view:cache
runuser -u www-data -- php artisan route:cache

echo "==> Done. MidnightX is the default theme (use ?classic=1 for the original UI)."
