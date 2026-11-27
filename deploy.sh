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
php artisan view:clear
php artisan route:clear
php artisan view:cache
php artisan route:cache

echo "==> Done. MidnightX is the default theme (use ?classic=1 for the original UI)."
