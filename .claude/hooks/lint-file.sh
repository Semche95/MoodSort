#!/usr/bin/env bash
set -uo pipefail

file=$(jq -r '.tool_input.file_path // empty')
[ -n "$file" ] || exit 0
root=${CLAUDE_PROJECT_DIR:-$(pwd)}
rel=${file#"$root"/}
cd "$root" || exit 0

case "$rel" in
  node_modules/* | dist/*) exit 0 ;;
  *.ts | *.tsx)
    out=$(pnpm exec eslint --no-warn-ignored "$rel" 2>&1) || { printf '%s\n' "$out" | tail -40 >&2; exit 2; }
    ;;
  src/i18n/locales/*.json)
    out=$(pnpm exec vitest run --reporter=dot locale-formatting 2>&1) || { printf '%s\n' "$out" | tail -40 >&2; exit 2; }
    ;;
esac
exit 0
