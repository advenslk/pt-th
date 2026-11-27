#!/usr/bin/env bash
# Pull the latest changes from GitHub, rebuild, install into the panel, and restart services.
# Usage: ./pull.sh [branch]
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

BRANCH="${1:-$(git branch --show-current)}"
echo "==> Pulling origin/$BRANCH"
git pull origin "$BRANCH"

echo "==> Deploying pulled changes"
bash "$REPO_DIR/deploy.sh"

echo "==> Restarting panel services"
bash "$REPO_DIR/restart.sh"

echo "==> Up to date: $(git rev-parse --short HEAD)"
