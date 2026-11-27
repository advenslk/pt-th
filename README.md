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

### Everyday commands

```bash
cd /var/www/pterodactyl/midnightx

# 1. After you change any file here: build + install into the panel
./deploy.sh

# 2. Commit your changes and push them to this GitHub repo
./push.sh "describe what you changed"

# 3. Undo the theme install and restore the original panel theme
./reset.sh                       # uses the newest /root/midnightx-install-backup-*
./reset.sh /path/to/backup        # or pass a backup directory explicitly
```

You can also do it manually:

```bash
npm install --legacy-peer-deps
npm run build
rm -rf /var/www/pterodactyl/public/midnightx/*
cp -r dist/* /var/www/pterodactyl/public/midnightx/
chown -R www-data:www-data /var/www/pterodactyl/public/midnightx
cd /var/www/pterodactyl && php artisan view:clear && php artisan route:clear && php artisan view:cache && php artisan route:cache

git add -A && git commit -m "message" && git push origin main
```

### Full server management

MidnightX does not implement schedules, startup variables, sub-users, or server settings yet. Use the **Classic Tools** button in the server sub-navigation (or `?classic=1` on any URL) to open the original Pterodactyl frontend — all features stay available. The **Admin Panel** sidebar link opens `/admin` in a new tab.
