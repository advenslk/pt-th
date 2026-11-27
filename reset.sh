#!/usr/bin/env bash
# Roll the panel back to the original theme (undo the MidnightX Blade/route changes).
# Usage: ./reset.sh [backup-directory]
set -euo pipefail

PANEL_DIR="${PANEL_DIR:-/var/www/pterodactyl}"

if [[ $# -ge 1 ]]; then
  BACKUP_DIR="$1"
else
  BACKUP_DIR="$(ls -dt /root/midnightx-install-backup-* 2>/dev/null | head -1 || true)"
fi

if [[ -z "$BACKUP_DIR" || ! -d "$BACKUP_DIR" ]]; then
  echo "No backup directory found. Pass one explicitly: ./reset.sh /path/to/backup" >&2
  exit 1
fi

echo "==> Restoring from $BACKUP_DIR"
if [[ -f "$BACKUP_DIR/wrapper.blade.php" ]]; then
  cp "$BACKUP_DIR/wrapper.blade.php" "$PANEL_DIR/resources/views/templates/wrapper.blade.php"
fi

if [[ -f "$BACKUP_DIR/base-routes.php" ]]; then
  cp "$BACKUP_DIR/base-routes.php" "$PANEL_DIR/routes/base.php"
fi

if [[ -f "$BACKUP_DIR/api-client.php" ]]; then
  cp "$BACKUP_DIR/api-client.php" "$PANEL_DIR/routes/api-client.php"
fi

ADMIN_BLADE="$PANEL_DIR/resources/views/layouts/admin.blade.php"
if [[ -f "$BACKUP_DIR/admin.blade.php" ]]; then
  cp "$BACKUP_DIR/admin.blade.php" "$ADMIN_BLADE"
elif [[ -f "$ADMIN_BLADE" ]] && command -v node >/dev/null 2>&1; then
  ADMIN_BLADE_PATH="$ADMIN_BLADE" node -e '
    const fs = require("fs");
    const file = process.env.ADMIN_BLADE_PATH;
    const html = fs.readFileSync(file, "utf8").replace(/\n?\s*<!-- MidnightX Admin Theme -->[\s\S]*?<!-- \/MidnightX Admin Theme -->\s*/g, "\n");
    fs.writeFileSync(file, html, "utf8");
  '
fi

echo "==> Refreshing Laravel caches"
cd "$PANEL_DIR"
php artisan view:clear
php artisan route:clear
php artisan view:cache
php artisan route:cache

echo "==> Done. Original Pterodactyl theme is active again."
