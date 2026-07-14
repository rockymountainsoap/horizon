#!/bin/bash
# PreToolUse hook: blocks direct Edit/Write on TRACKED engine-manifest files.
#
# The WS7 ownership model (see .cursor/plans/WS7-frontend-rework-adr.md) allows
# free editing of every file EXCEPT the engine manifest — those files sync from
# upstream Horizon and must not carry local patches. This hook enforces that
# mechanically for agent Edit/Write tools. The sanctioned update path (the
# engine-sync skill's `git checkout upstream/<ref> -- <file>` via Bash) is
# unaffected.
#
# The protected file list is read live from the manifest table in
# .cursor/references/engine-manifest.md — single source of truth, no hardcoding.
#
# Escape hatch for a deliberate, manifest-documented patch: set
# ENGINE_MANIFEST_ALLOW_EDIT=1 in the hook environment (env block in
# .claude/settings.local.json), or disable the hook via /hooks.
set -uo pipefail

input=$(cat)
file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -z "$file_path" ] && exit 0
[ "${ENGINE_MANIFEST_ALLOW_EDIT:-}" = "1" ] && exit 0

root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
manifest="$root/.cursor/references/engine-manifest.md"
[ -f "$manifest" ] || exit 0

# Manifest table rows look like: | `assets/component.js` | role | notes |
while IFS= read -r tracked; do
  case "$file_path" in
    *"/$tracked" | "$tracked")
      {
        echo "BLOCKED: '$tracked' is a TRACKED engine-manifest file (WS7 ownership model)."
        echo "Tracked files sync from upstream Horizon and must not be patched directly."
        echo "- Extend by composition instead: create an r-*.js module importing @theme/*."
        echo "- To sync from upstream: use the engine-sync skill (git checkout upstream/<ref> -- <file>)."
        echo "- If a patch is truly unavoidable (see manifest rules): record it in"
        echo "  .cursor/references/engine-manifest.md and ask the user to approve an override"
        echo "  (ENGINE_MANIFEST_ALLOW_EDIT=1 in the hook env, or disable via /hooks)."
      } >&2
      exit 2
      ;;
  esac
done < <(grep -oE '^\| `assets/[a-z0-9.-]+\.js`' "$manifest" | tr -d '|` ')

exit 0
