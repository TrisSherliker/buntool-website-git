#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

printf "Scanning for tracked files that match .gitignore patterns...\n"

mapfile -t files < <(
  git ls-files -z -ci --exclude-standard |
  tr '\0' '\n'
)

if [ "${#files[@]}" -eq 0 ]; then
  printf "No tracked files match .gitignore patterns. Nothing to do.\n"
  exit 0
fi

printf "The following tracked files currently match .gitignore patterns:\n\n"
for f in "${files[@]}"; do
  printf "  %s\n" "$f"
done

cat <<'EOF'

If you want to stop tracking these files (they will remain on disk but be removed from the index),
re-run this script with --untrack, e.g.

  ./scripts/untrack-ignored.sh --untrack

EOF

if [ "${1-:-}" = "--untrack" ]; then
  printf "Untracking %d file(s)...\n" "${#files[@]}"
  git rm -r --cached -- "${files[@]}"
  printf "Staged removal. Now committing...\n"
  git commit -m "Stop tracking files that are ignored by .gitignore"
  printf "Committed. Files remain in your working tree. Push when ready.\n"
fi
