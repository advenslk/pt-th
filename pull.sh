#!/usr/bin/env bash
# Pull the latest GitHub changes, rebuild, install into the panel, restart services.
# Usage: ./pull.sh [branch]
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

BRANCH="${1:-$(git branch --show-current)}"
BEFORE="$(git rev-parse HEAD)"

echo "==> Fetching origin/$BRANCH"
git fetch origin "$BRANCH"
REMOTE="$(git rev-parse FETCH_HEAD)"
echo "github commit : ${REMOTE:0:7}"
echo "local commit  : ${BEFORE:0:7}"

if [[ "$BEFORE" == "$REMOTE" ]]; then
  echo "==> No new commits on GitHub. If you edited elsewhere, check that 'git push' succeeded."
  echo "    Current GitHub HEAD: $(git log -1 --format='%h %s' FETCH_HEAD)"
else
  echo "==> Merging GitHub changes"
  git merge --no-edit FETCH_HEAD
  echo "==> New commits applied:"
  git log --oneline "$BEFORE..HEAD"
fi

AFTER="$(git rev-parse HEAD)"
echo "==> Deploying $AFTER"
bash "$REPO_DIR/deploy.sh"

echo "==> Restarting panel services"
bash "$REPO_DIR/restart.sh"

echo "==> Done at $(git rev-parse --short HEAD)"
