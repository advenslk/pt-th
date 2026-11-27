#!/usr/bin/env bash
# Commit local changes and push them to this repo's origin.
# Usage: ./push.sh "commit message"
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MESSAGE="${1:-Update MidnightX theme}"

git add -A
if git diff --cached --quiet; then
  echo "==> Nothing to commit"
else
  git commit -m "$MESSAGE"
fi

BRANCH="$(git branch --show-current)"
echo "==> Pushing $BRANCH to origin"
git push origin "$BRANCH"
