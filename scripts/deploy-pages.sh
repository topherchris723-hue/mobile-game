#!/usr/bin/env bash
# Publishes a built site to the gh-pages branch, which GitHub Pages serves.
#   main             → site root
#   any other branch → preview/<slug>/   (other previews are left untouched)
#
# Usage: deploy-pages.sh <site-dir> <branch> <commit-sha>
#        deploy-pages.sh --slug <branch>     (prints the preview folder name)
set -euo pipefail

slugify() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9._-]+/-/g; s/^-+|-+$//g'
}

if [ "${1:-}" = "--slug" ]; then
  slugify "$2"
  exit 0
fi

site_dir=$(realpath "$1")
branch="$2"
sha="$3"
slug=$(slugify "$branch")
work=$(mktemp -d)

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

if git ls-remote --exit-code --heads origin gh-pages >/dev/null 2>&1; then
  git fetch --depth=1 origin gh-pages
  git worktree add --detach "$work" FETCH_HEAD
else
  git worktree add --detach "$work"
  git -C "$work" checkout --orphan gh-pages
  git -C "$work" rm -rfq --ignore-unmatch .
fi

if [ "$branch" = "main" ]; then
  # Replace the root site but keep every branch preview.
  find "$work" -mindepth 1 -maxdepth 1 ! -name .git ! -name preview -exec rm -rf {} +
  cp -R "$site_dir"/. "$work"/
else
  rm -rf "$work/preview/$slug"
  mkdir -p "$work/preview/$slug"
  cp -R "$site_dir"/. "$work/preview/$slug"/
fi
touch "$work/.nojekyll"

git -C "$work" add -A
if git -C "$work" diff --cached --quiet; then
  echo "Nothing changed; skipping deploy."
  exit 0
fi
git -C "$work" commit -qm "Deploy ${branch} @ ${sha:0:7}"
git -C "$work" push origin HEAD:gh-pages
echo "Deployed ${branch} to $([ "$branch" = main ] && echo '/' || echo "/preview/$slug/")"
