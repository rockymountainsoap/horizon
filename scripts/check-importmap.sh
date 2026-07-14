#!/bin/bash
# Verifies every `@theme/*` specifier imported by assets/*.js resolves in an
# importmap somewhere in the theme (snippets/scripts.liquid for the main
# storefront; templates/gift_card.liquid and other standalone layouts carry
# their own maps).
#
# This is a union check: it catches the main failure class (an engine/feature
# module importing a specifier no importmap defines -> runtime module-load
# error), not per-page resolvability.
#
# Used by CI (.github/workflows/ci.yml) and runnable locally:
#   bash scripts/check-importmap.sh
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

imports=$(grep -rhoE "from '@theme/[a-z0-9-]+'" assets/*.js | sed "s/from '//;s/'//" | sort -u)
mapped=$(grep -rhoE '"@theme/[a-z0-9-]+"' --include='*.liquid' snippets sections blocks templates layout | tr -d '"' | sort -u)

missing=$(comm -23 <(printf '%s\n' "$imports") <(printf '%s\n' "$mapped"))

if [ -n "$missing" ]; then
  echo "FAIL: @theme specifiers imported by assets/*.js but defined in no importmap:" >&2
  while IFS= read -r m; do
    importers=$(grep -lF "from '$m'" assets/*.js | tr '\n' ' ')
    echo "  $m  <- imported by: $importers" >&2
  done <<<"$missing"
  echo "Add the entry to the importmap in snippets/scripts.liquid (or the relevant standalone layout)." >&2
  exit 1
fi

echo "OK: all $(printf '%s\n' "$imports" | wc -l | tr -d ' ') @theme import specifiers resolve."
