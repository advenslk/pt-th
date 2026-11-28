# MidnightX — Pterodactyl Panel v1.15.2 Theme & Frontend

MidnightX is a 3D tactile, hardware-inspired React + TypeScript + Tailwind CSS v4 frontend built specifically for **Pterodactyl Panel v1.15.2**. It contains zero mock data, zero simulated telemetry, and communicates exclusively with authentic Pterodactyl Client/Application APIs and Wings WebSockets.

---

## Features & Real Protocol Support

- **Authentic Pterodactyl v1.15.2 JSON:API**: Normalizes `{ object, attributes, relationships }` payloads across Client (`/api/client/*`) and Application (`/api/application/*`) endpoints.
- **Laravel Sanctum / Cookie Auth**: Automatically reads `XSRF-TOKEN` from `document.cookie`, sends `X-XSRF-TOKEN`, and includes credentials (`credentials: 'include'`) when served directly from Pterodactyl.
- **Real Wings WebSocket Console**: Authenticates against `/api/client/servers/:id/websocket`, connects directly to Wings via `WebSocket`, handles `token expiring` renewal, streams live console output, dispatches commands (`send command`), power states (`set state`), and real-time `stats`.
- **Direct Wings File Operations**: Uses signed upload/download URLs, raw `text/plain` `/files/write` and `/files/contents`, directory navigation, compression, decompression, and bulk operations.
- **Account Security & Billing Bridge**: Supports real Pterodactyl API keys, SSH keys, TOTP 2FA QR enrollment, and optional external Billing/Support API proxying via `BILLING_API_URL`.

---

## Deployment Options

### Option A: Install Directly Into Pterodactyl Panel v1.15.2 (`/var/www/pterodactyl`)

1. Build the production static bundle:
   ```bash
   npm install
   npm run build
   ```
2. Copy the compiled `dist/` assets into your Pterodactyl Panel public directory (for example `/var/www/pterodactyl/public/midnightx`):
   ```bash
   mkdir -p /var/www/pterodactyl/public/midnightx
   cp -r dist/* /var/www/pterodactyl/public/midnightx/
   ```
3. Point your Pterodactyl Blade wrapper template (`resources/views/templates/wrapper.blade.php`) to load the built JS/CSS assets from `/midnightx/assets/...` (or proxy `/midnightx` / root SPA routes via Nginx while keeping `/api/*`, `/sanctum/*`, `/auth/*`, and `/admin/*` routed to PHP-FPM).
4. Ensure your Wings nodes allow your panel domain in `cors` / `allowed_origins` (`config.yml`) so browser WebSocket connections and signed file uploads/downloads succeed cleanly.

---

### Option B: Standalone Reverse-Proxy Frontend (`server.ts`)

Run MidnightX as a standalone Node/Express host that proxies `/api/client/*` and `/api/application/*` securely to your Pterodactyl Panel without exposing API keys in the browser.

1. Copy `.env.example` to `.env` and configure your panel connection:
   ```env
   PTERODACTYL_URL="https://panel.example.com"
   PTERODACTYL_CLIENT_API_KEY="ptlc_your_client_key"
   PTERODACTYL_APP_API_KEY="ptla_your_application_key"

   # Optional external billing/support API bridge
   BILLING_API_URL="https://billing.example.com"
   BILLING_API_KEY="your_billing_api_token"
   ```
2. Install dependencies, build, and start on port `3000`:
   ```bash
   npm install
   npm run build
   npm start
   ```
3. In Wings `config.yml`, include your MidnightX host origin under `allowed_origins` if using cross-origin file uploads/downloads or console WebSockets.

---

## Installed Pterodactyl Integration (this server)

This clone is installed at `/var/www/pterodactyl/midnightx` and is the **default signed-in theme** on the panel. The Blade wrapper loads `/midnightx/assets/...`, while guests still get the stock Pterodactyl login screens.

### All commands

Run everything from the repo directory:

```bash
cd /var/www/pterodactyl/midnightx
```

| Command | What it does |
|---|---|
| `./pull.sh` | **Pull** latest GitHub changes → build → install → restart PHP-FPM/Nginx |
| `./pull.sh main` | Same, but force a specific branch |
| `./push.sh "message"` | **Commit and push** your local changes to GitHub |
| `./deploy.sh` | Build and install the current files into the panel (no git pull) |
| `./restart.sh` | Clear caches, restart queue workers, restart PHP-FPM, reload Nginx |
| `./reset.sh` | **Roll back** to the original Pterodactyl theme |
| `./reset.sh /path/to/backup` | Roll back using a specific backup directory |
| `./status.sh` | Show local/remote commits, built asset name, service status, URLs |

### AI Studio

The AI Studio backend runs as a local Node service (`midnightx-api.service`) that the panel proxies
at `/api/client/helzerx/ai/*`. `./deploy.sh` installs the service and the Nginx proxy automatically.
Set `PTERODACTYL_URL` and `GEMINI_API_KEY` in `.env` before deploying. If a Gemini model is busy,
the assistant automatically falls back to the next model in `GEMINI_MODEL`.

```bash
systemctl status midnightx-api
journalctl -u midnightx-api -f
```

Typical workflow after you edit the theme from another machine:

```bash
# on this server: get the new code and make it live
./pull.sh

# if you edited files directly on this server: publish them
./push.sh "describe what you changed"

# if something is wrong: restore the original panel theme
./reset.sh
```

### If the panel still looks old

1. Check `./status.sh` — compare **local commit** and **github commit**. If `pull.sh` printed
   `No new commits on GitHub`, your changes were never pushed (often an expired GitHub token).
   Run `./push.sh "message"` from the machine where you edited, then `./pull.sh` here.
2. Make sure the browser URL is `https://spg.helzerx.cyou/` and **not**
   `https://spg.helzerx.cyou/?classic=1` — the latter deliberately loads the old UI.
3. Hard-refresh once (Ctrl+F5). Asset URLs include a `?v=` file timestamp, so a stale
   browser cache should not normally be possible.
4. `./status.sh` prints `built asset` and `deployed at` — compare those with your last build.

Manual equivalents (no scripts):

```bash
# pull + deploy
git pull origin main
npm install --legacy-peer-deps
npm run build
rm -rf /var/www/pterodactyl/public/midnightx/*
cp -r dist/* /var/www/pterodactyl/public/midnightx/
chown -R www-data:www-data /var/www/pterodactyl/public/midnightx
cd /var/www/pterodactyl
php artisan optimize:clear
php artisan view:cache
php artisan route:cache
php artisan queue:restart
systemctl restart php8.3-fpm
systemctl reload nginx

# push
cd /var/www/pterodactyl/midnightx
git add -A && git commit -m "message" && git push origin main

# reset
cp /root/midnightx-install-backup-*/wrapper.blade.php /var/www/pterodactyl/resources/views/templates/wrapper.blade.php
cp /root/midnightx-install-backup-*/base-routes.php /var/www/pterodactyl/routes/base.php
cd /var/www/pterodactyl && php artisan view:clear && php artisan route:clear && php artisan view:cache && php artisan route:cache
```

### Full server management

MidnightX natively implements the complete Pterodactyl Panel v1.15.2 client experience: Console, File Manager, Databases, Schedules & Tasks, Sub-Users & Permissions, Backups, Network Allocations, Startup & Docker Images, Server Settings & SFTP, Server Activity Logs, and Account Security (2FA, API Keys, SSH Keys). The **Admin Panel** sidebar link opens `/admin` in a new tab, and `./deploy.sh` / `./pull.sh` automatically applies the MidnightX 3D RGB theme (`admin-theme.css` / `admin-theme.js`) onto Pterodactyl's native `/admin` interface without altering any admin functionality.


