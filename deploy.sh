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
DEPLOY_TS="$(date +%s)"
echo "==> Installed JS: $JS"
echo "==> Installed CSS: $CSS"

ADMIN_BLADE="$PANEL_DIR/resources/views/layouts/admin.blade.php"
if [[ -f "$ADMIN_BLADE" ]]; then
  BACKUP_DIR="$(ls -dt /root/midnightx-install-backup-* 2>/dev/null | head -1 || true)"
  if [[ -z "$BACKUP_DIR" ]]; then
    BACKUP_DIR="/root/midnightx-install-backup-admin"
    mkdir -p "$BACKUP_DIR"
  fi
  if [[ ! -f "$BACKUP_DIR/admin.blade.php" ]] && ! grep -q '<!-- MidnightX Admin Theme -->' "$ADMIN_BLADE"; then
    cp "$ADMIN_BLADE" "$BACKUP_DIR/admin.blade.php"
  fi

  echo "==> Applying MidnightX Admin Panel theme to $ADMIN_BLADE"
  ADMIN_BLADE_PATH="$ADMIN_BLADE" DEPLOY_TS="$DEPLOY_TS" node -e '
    const fs = require("fs");
    const file = process.env.ADMIN_BLADE_PATH;
    const ts = process.env.DEPLOY_TS;
    let html = fs.readFileSync(file, "utf8");
    html = html.replace(/\n?\s*<!-- MidnightX Admin Theme -->[\s\S]*?<!-- \/MidnightX Admin Theme -->\s*/g, "\n");
    const block = [
      "        <!-- MidnightX Admin Theme -->",
      "        <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\" />",
      "        <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin />",
      "        <link href=\"https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@600;700&display=swap\" rel=\"stylesheet\" />",
      "        <script src=\"/midnightx/admin-theme.js?v=" + ts + "\"></script>",
      "        <link rel=\"stylesheet\" href=\"/midnightx/admin-theme.css?v=" + ts + "\" />",
      "        <!-- /MidnightX Admin Theme -->",
      "    </head>"
    ].join("\n");
    if (html.includes("</head>")) {
      html = html.replace("</head>", block);
      fs.writeFileSync(file, html, "utf8");
    }
  '
fi

if [[ -d "$REPO_DIR/laravel-addon" && -d "$PANEL_DIR/app" ]]; then
  echo "==> Installing HelzerX Laravel API & database migrations into $PANEL_DIR"
  mkdir -p "$PANEL_DIR/app/Http/Controllers/Api/Client" "$PANEL_DIR/database/migrations" "$PANEL_DIR/routes"
  cp -r "$REPO_DIR/laravel-addon/app/"* "$PANEL_DIR/app/"
  cp -r "$REPO_DIR/laravel-addon/database/"* "$PANEL_DIR/database/"
  cp -r "$REPO_DIR/laravel-addon/routes/"* "$PANEL_DIR/routes/"
  chown -R www-data:www-data "$PANEL_DIR/app/Http/Controllers/Api/Client/HelzerxController.php" "$PANEL_DIR/routes/helzerx.php" "$PANEL_DIR/database/migrations"

  API_CLIENT_ROUTES="$PANEL_DIR/routes/api-client.php"
  if [[ -f "$API_CLIENT_ROUTES" ]]; then
    BACKUP_DIR="$(ls -dt /root/midnightx-install-backup-* 2>/dev/null | head -1 || true)"
    if [[ -z "$BACKUP_DIR" ]]; then
      BACKUP_DIR="/root/midnightx-install-backup-admin"
      mkdir -p "$BACKUP_DIR"
    fi
    if [[ ! -f "$BACKUP_DIR/api-client.php" ]] && ! grep -q "helzerx.php" "$API_CLIENT_ROUTES"; then
      cp "$API_CLIENT_ROUTES" "$BACKUP_DIR/api-client.php"
    fi
    if ! grep -q "helzerx.php" "$API_CLIENT_ROUTES"; then
      printf "\n// HelzerX Platform Features\nrequire __DIR__ . '/helzerx.php';\n" >> "$API_CLIENT_ROUTES"
    fi
  fi

  cd "$PANEL_DIR"
  php artisan migrate --force || echo "Warning: php artisan migrate returned non-zero (check database permissions)"
fi

if [[ -f "$REPO_DIR/deploy/midnightx-api.service" ]]; then
  echo "==> Installing HelzerX AI API service"
  chown -R www-data:www-data "$REPO_DIR/data"
  install -m 0644 "$REPO_DIR/deploy/midnightx-api.service" /etc/systemd/system/midnightx-api.service
  systemctl daemon-reload
  systemctl enable midnightx-api.service

  NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-enabled/pterodactyl.conf}"
  if [[ -f "$NGINX_SITE" ]]; then
    SNIPPET_PATH=/etc/nginx/snippets/midnightx-ai.conf
    mkdir -p /etc/nginx/snippets
    install -m 0644 "$REPO_DIR/deploy/midnightx-ai-nginx.conf" "$SNIPPET_PATH"
    cp -f "$NGINX_SITE" "$NGINX_SITE.midnightx-bak"

    NGINX_SITE="$NGINX_SITE" SNIPPET_PATH="$SNIPPET_PATH" node -e '
      const fs = require("fs");
      const file = process.env.NGINX_SITE;
      const startMarker = "# MidnightX AI Studio proxy";
      const endMarker = "# /MidnightX AI Studio proxy";
      let config = fs.readFileSync(file, "utf8");
      const start = config.indexOf(startMarker);
      if (start !== -1) {
        const end = config.indexOf(endMarker, start);
        if (end !== -1) {
          let tail = config.slice(end + endMarker.length);
          tail = tail.replace(/^\s*\n/, "\n");
          config = config.slice(0, start) + tail;
        }
      }
      if (!config.includes(startMarker) && config.includes("location ~ \\.php$")) {
        const block = [
          "    " + startMarker,
          "    include " + process.env.SNIPPET_PATH + ";",
          "    " + endMarker
        ].join("\n");
        config = config.replace("    location ~ \\.php$", block + "\n    location ~ \\.php$");
        fs.writeFileSync(file, config, "utf8");
      }
    '

    if nginx -t >/dev/null 2>&1; then
      systemctl reload nginx
    else
      cp -f "$NGINX_SITE.midnightx-bak" "$NGINX_SITE"
      echo "Warning: nginx config test failed; AI proxy was not installed" >&2
    fi
  fi

  systemctl restart midnightx-api.service || echo "Warning: HelzerX AI service failed to start (check journalctl -u midnightx-api)"
fi

echo "==> Refreshing Laravel caches"
cd "$PANEL_DIR"
chown -R www-data:www-data "$PANEL_DIR/storage" "$PANEL_DIR/bootstrap/cache"
runuser -u www-data -- php artisan view:clear
runuser -u www-data -- php artisan route:clear
runuser -u www-data -- php artisan view:cache
runuser -u www-data -- php artisan route:cache

echo "==> Done. Open https://spg.helzerx.cyou/ (and /admin) and hard-refresh once."
