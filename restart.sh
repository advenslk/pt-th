#!/usr/bin/env bash
# Clear Laravel caches, restart queue workers, PHP-FPM and reload Nginx.
# Usage: ./restart.sh
set -euo pipefail

PANEL_DIR="${PANEL_DIR:-/var/www/pterodactyl}"

echo "==> Refreshing Laravel caches"
cd "$PANEL_DIR"
chown -R www-data:www-data "$PANEL_DIR/storage" "$PANEL_DIR/bootstrap/cache"
runuser -u www-data -- php artisan optimize:clear >/dev/null 2>&1 || true
runuser -u www-data -- php artisan view:cache
runuser -u www-data -- php artisan route:cache
runuser -u www-data -- php artisan queue:restart || true

echo "==> Reloading web services"
nginx -t
systemctl restart php8.3-fpm
systemctl reload nginx

echo "==> Services restarted (PHP-FPM + Nginx). Wings is intentionally untouched."
