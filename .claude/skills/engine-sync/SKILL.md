---
name: engine-sync
description: >-
  Sync the Horizon engine-manifest files from a new upstream release into the
  Rocky theme. Use when a new Shopify Horizon version ships, when pulling or
  updating from upstream Horizon, bumping to a new Horizon version, or when the
  user says "merge upstream", "update from Horizon", "pull the new Horizon
  version", "sync the engine", "engine sync", or references the engine manifest.
  Replaces the retired upstream-merge whole-tree workflow (WS7): upstream sync
  is now a manifest-scoped cherry-pick of ~14 engine JS files — never a git merge.
---

# Engine Sync — Manifest-Scoped Upstream Cherry-Pick

This repo operates under the **WS7 ownership-tier model** (see
`.cursor/plans/WS7-frontend-rework-adr.md`): the theme is Rocky-owned by default;
only the files in **`.cursor/references/engine-manifest.md`** are TRACKED from
upstream Horizon. Syncing a new Horizon release means diffing and cherry-picking
**those files only**.

**Hard rules (never violate):**

- **Never `git merge upstream/main`.** Whole-tree merges were retired by WS7; the
  final one (v4.1.1, history-only) already merged upstream history. Content moves
  only via `git checkout upstream/<ref> -- <file>` or selective `git apply`.
- **Never re-add `merge=ours` entries to `.gitattributes`.**
- Work on a branch (`engine-sync-vX.Y.Z`); never push without explicit user approval.
- The sync must touch **only** manifest files (plus the manifest doc itself).
- ADOPTED files are out of scope. If an engine change requires an adopted-file
  change to stay compatible, that is a deliberate, separately-reviewed commit.

---

## Phase 0 — Preflight

```bash
git status                          # clean tree required
git fetch upstream --tags --prune
```

Read `.cursor/references/engine-manifest.md`:
- the **manifest file list** (source of truth — do not hardcode; it changes over time)
- the **last-synced upstream ref** (what to diff FROM)
- any `// r:` patch obligations recorded in the table (hand-reapply after sync)
- pending entries in the sync changelog (e.g. a previously-deferred sync)

Identify the new release: upstream `release-notes.md` at `upstream/main`, or
`git log --oneline <last-synced>..upstream/main | grep -i 'horizon v'`.

## Phase 1 — Scope the diff

```bash
LAST=<last-synced-ref-from-manifest>
NEW=upstream/main   # or a specific release commit
git diff --stat "$LAST" "$NEW" -- $(awk '/^\| `assets\//{gsub(/[`|]/,"",$2); print $2}' .cursor/references/engine-manifest.md | tr '\n' ' ')
```

(Or list the manifest files explicitly — but read them from the manifest, not memory.)

- **Empty diff** → record "no engine changes for vX.Y.Z" in the manifest changelog,
  advance the last-synced ref, done.
- Also check for engine files upstream **added or renamed** — candidates for the
  manifest (record the decision either way):
  ```bash
  git diff --name-status --diff-filter=ADR "$LAST" "$NEW" -- assets/
  ```

## Phase 2 — Per-file compat review (the crux)

For each changed manifest file, read the full diff before taking anything. What to
look for, per file:

| File | Review focus |
|---|---|
| `component.js` | `ref`/`on:<event>=` contract semantics, `Component` lifecycle, registration API — 59 dependents including all Rocky `r-*.js` |
| `events.js` | Event names + payload shapes. Adopted feature files and Rocky components listen to these — **grep the whole assets/ tree for any renamed/removed export or event name before applying** |
| `morph.js` | `MORPH_OPTIONS`, escape-hatch attributes (`data-skip-subtree-update`, `data-skip-node-update`) — load-bearing for Rocky wishlist/cart (AGENTS.md Runtime Internals) |
| `section-renderer.js` / `section-hydration.js` | Public API (`renderSection`, `morphSection`, selectors) called by adopted feature JS |
| `utilities.js` | ⚠️ **Header-coupled region** (`setMenuStyle`, header-group height fns): coupled to Horizon header DOM. Never blindly apply hunks there — Rocky's header diverges (see manifest caveat row) |
| `dialog.js` | `DialogComponent` API — base class of cart-drawer, quick-add, Rocky dialogs |
| `theme-editor.js` | New editor/design-mode requirements — usually take wholesale |
| `popover-polyfill.js` | Vendored — take wholesale |
| others (focus, scrolling, performance, money-formatting, view-transitions) | Small; read the diff, take unless it references DOM/markup Rocky doesn't emit |

**Cross-tier check (mandatory):** before applying any file whose exports/events/API
changed, grep the adopted feature JS and Rocky `r-*.js` for every changed symbol:

```bash
grep -rn '<changed-symbol>' assets/*.js snippets/*.liquid sections/*.liquid blocks/*.liquid
```

If an adopted file depends on a removed/renamed symbol, either skip that engine
change (document why in the changelog) or plan the compat edit as its own commit.

**Cross-version warning:** upstream engine changes may assume same-version feature
JS or Liquid markup that Rocky holds at an older baseline. When an engine diff pairs
with markup/feature changes (check upstream's release notes and neighbouring diffs),
verify the engine change degrades gracefully against Rocky's markup — or skip it.

## Phase 3 — Apply

Per approved file:

```bash
git checkout "$NEW" -- assets/<file>       # take wholesale
# or, for a partial take:
git diff "$LAST" "$NEW" -- assets/<file> > /tmp/f.patch
# edit /tmp/f.patch down to the approved hunks
git apply /tmp/f.patch
```

Re-apply any `// r:` patches recorded in the manifest table, then verify them with
grep.

## Phase 4 — Verify

1. `shopify theme check --fail-level error` — compare error-type counts against
   pre-sync baseline. Known noise: `ValidSchemaTranslations` (~3800) and
   `TranslationKeyExists` (~160) are false positives; real signal is
   `LiquidHTMLSyntaxError` / `MissingAsset` / `ValidSchema` (all currently confined
   to `apps/`, not theme files).
2. Push to a **preview/development theme** (`shopify theme push --development`) —
   never the live theme.
3. Smoke test, minimum: add-to-cart from PDP (product form + cart drawer), variant
   change (price/media update), cart line quantity change (section re-render +
   morph), search modal, theme editor section add/reorder, view transitions
   (navigate PLP → PDP), browser console clean of errors.
4. Rocky-specific: wishlist header flow (morph escape hatches), cart subscription
   toggle, variant pill pre-selection on PLP.

## Phase 5 — Record

1. Update `.cursor/references/engine-manifest.md`:
   - advance **last-synced upstream ref**
   - append a **sync changelog** row: date, upstream ref/version, files taken,
     files skipped + why
   - update the manifest table if files were added/removed
2. Tag: `git tag -a engine-synced-vX.Y.Z -m "Engine manifest synced to Horizon vX.Y.Z"`.
   The permanent `adoption-baseline-v3.5.1` tag **never moves** — it remains the
   reference point for consulting upstream diffs of ADOPTED files.
3. Commit sync + manifest update together; compat edits to adopted files (if any)
   as separate commits. **Do not push** — state how far ahead main is and stop.

---

## Known state / gotchas (update as encountered)

1. **First exercise is pending:** the v4.1.1 engine diff (9 files; `events.js` −191
   lines restructured into upstream's standard-events system, `morph.js` ±285,
   `section-renderer.js` +79, …) was deliberately NOT taken in the 2026-07
   history-only merge. See the manifest changelog PENDING row. It needs the full
   Phase 2 treatment — especially the events.js restructure vs Rocky's
   v3.5.1-content feature JS.
2. **Upstream v4.x is palette-based; Rocky is scheme-based.** Engine files are
   theming-agnostic, but any engine change referencing palette settings or the
   `color-palette` snippet must be reviewed against Rocky's kept scheme system.
3. **New v4 engine candidates** (`standard-actions-override.js`,
   `page-view-event.js`, `view-event-elements.js`, `theme-drawer.js`,
   `scroll-container.js` + `.d.ts` defs) sit inert in `assets/` — unreferenced by
   `snippets/scripts.liquid`. Adopting one = add to importmap/module loading +
   manifest, deliberately.
4. **Upstream refactors can break file-level diffing** (renames, TS migration,
   module splits). Fall back to symbol-level review: diff the export surface, then
   map old file → new files.
5. **Editor auto-format noise:** review `git show --stat` before finalizing;
   format-on-save has previously mutated files behind an edit.
6. **theme-check translation errors are noise** — compare per-type counts, never
   absolute totals (memory: `theme-check-schema-translation-false-positives`).
7. **Horizon cart events are `Event` subclasses, not `CustomEvent`** — never gate
   with `instanceof CustomEvent` (memory: `horizon-cart-events-not-customevent`).

## Checklist

- [ ] Clean tree; fetched upstream; read the manifest (file list + last-synced ref)
- [ ] Scoped diff to manifest files only; checked for added/renamed engine files
- [ ] Per-file compat review done; cross-tier symbol grep done
- [ ] Applied via checkout/apply — **no `git merge`**
- [ ] `// r:` patch obligations re-applied and verified
- [ ] theme-check baseline compared; preview theme smoke test passed
- [ ] Manifest changelog + last-synced ref updated; `engine-synced-vX.Y.Z` tagged
- [ ] Only manifest files (+ manifest doc) touched; **did not push**
