# Engine Manifest — Upstream-Tracked Files

> **The only files in this repo with an upstream-sync obligation.** Everything else is
> Rocky-owned (see `.cursor/plans/WS7-frontend-rework-adr.md`). Check this file before
> editing any `assets/*.js` — if the file is listed below, do **not** patch it directly.

---

## Baseline

| Field | Value |
|---|---|
| **Adoption baseline (content)** | Horizon **v3.5.1-era** — upstream commit `70c27a8`, tag **`adoption-baseline-v3.5.1`** (pushed to origin) |
| **Upstream history merged through** | `68760d9` (v4.1.1, 2026-07-14 merge) — *history only; v4.x content deliberately not taken (palette rewrite; see ADR)* |
| **Last-synced upstream ref (engine content)** | `68760d9` (v4.1.1, tag `engine-synced-v4.1.1`) — **advanced by each engine sync; the sync skill diffs from here.** ⚠️ Two files were held back at v3.5.1 content (see changelog): future syncs of `events.js` / `theme-editor.js` must diff from `adoption-baseline-v3.5.1`, not from here. |
| Adopted | 2026-07 (WS7) |

Consulting upstream for an ADOPTED (non-manifest) file:
```bash
git diff adoption-baseline-v3.5.1..upstream/main -- <file>   # reference, never merge
```

## Manifest (15 files)

| File | Role | Sync notes |
|---|---|---|
| `assets/component.js` | `Component` base class; `ref` collection; declarative `on:<event>=` delegated listener system | **Contract-critical** — 59 dependents import `@theme/component`. Review any change to ref/on: semantics against all Rocky + adopted components. |
| `assets/utilities.js` | scheduler, view-transition helpers, debounce/throttle, breakpoints, fetchConfig | ⚠️ **Caveat region (~L700–730):** `setMenuStyle()` + header-group height fns are coupled to Horizon header DOM (`#header-component`, `#header-group`, `overflow-list`). Never blindly apply upstream changes there; split into an `r-` module when the custom header lands, then note the divergence here. |
| `assets/events.js` | `ThemeEvents` names + typed event classes (`CartAddEvent`, `VariantUpdateEvent`, …) | ⚠️ **Held at v3.5.1 content.** Upstream v4 deleted the variant/cart/filter/discount event classes (moved into the standard-events system); 21 Rocky-held files import them. Unblock: when the cart/product feature JS is reworked or rebuilt on standard-events. Note: `CartUpdateEvent`/`CartAddEvent` extend `Event`, not `CustomEvent`. |
| `assets/morph.js` | DOM morphing + `MORPH_OPTIONS` | Escape-hatch attributes (`data-skip-subtree-update`, `data-skip-node-update`) are load-bearing for Rocky components that populate their subtree at runtime — check dynamically-rendered Rocky components for reliance on these before taking upstream changes. |
| `assets/section-renderer.js` | Section Rendering API wrapper (`renderSection`, `morphSection`) | API surface called by adopted feature files. |
| `assets/section-hydration.js` | idle re-hydration via `data-hydration-key` | Tiny; low churn. |
| `assets/dialog.js` | `DialogComponent` modal primitive + open/close events | Base class of cart-drawer, quick-add, zoom, Rocky dialogs. |
| `assets/focus.js` | focus trap / a11y helpers | Low churn. |
| `assets/scrolling.js` | scroll observers, scroll-end, scroll-hint | Engine-adjacent. |
| `assets/performance.js` | `cartPerformance` metrics | Low churn. |
| `assets/money-formatting.js` | currency formatting | |
| `assets/view-transitions.js` | render-blocker release (standalone IIFE, `<script async>`) | Pairs with `#view-transition-render-blocker` in `theme.liquid`. |
| `assets/popover-polyfill.js` | platform polyfill | Vendored; replace wholesale on sync. |
| `assets/theme-editor.js` | theme-editor / design-mode integration | ⚠️ **Held at v3.5.1 content.** The v4 version removes the `cart-drawer-component` editor auto-open entry (v4 restructured the cart drawer); Rocky still runs the v3.5.1 cart drawer. Unblock: when the cart drawer is reworked. |
| `assets/scroll-container.js` | scroll-container abstraction (`getScrollTop`, `scrollTo`, page-wrapper detection with `document.scrollingElement` fallback) | **Added to manifest 2026-07** (v4.1.1 sync): required by v4 `dialog.js`; registered in the importmap as `@theme/scroll-container`. |

### Manifest candidates (new in upstream v4.x, kept as inert reference files)

Brought in by the 2026-07 history-only merge; **not loaded** (no `scripts.liquid` reference)
until adopted deliberately:

`assets/standard-actions-override.js`, `assets/standard-actions.d.ts`,
`assets/standard-events.d.ts`, `assets/page-view-event.js`,
`assets/view-event-elements.js`, `assets/view-event-elements.d.ts`,
`assets/theme-drawer.js`, `assets/disclosures-summary-fit.js`
(`scroll-container.js` was promoted into the manifest at the v4.1.1 sync)

These implement upstream's v4 "Storefront Events & Actions" (app/agent/AI cart
interactions) and the theme-drawer primitive. Evaluate for the manifest during the
first engine sync.

## Rules

1. **No Rocky patches inside manifest files.** Extend by composition: new `r-*.js`
   modules importing `@theme/*`. If a patch is truly unavoidable, mark it with a
   `// r:` comment and record it in the table above (it becomes a hand-reapply
   obligation on every sync).
2. **Sync protocol:** see `.claude/skills/engine-sync/SKILL.md`. Summary: fetch
   upstream → diff `last-synced-ref..upstream/<new>` for manifest files only →
   per-file compat review → `git checkout upstream/<ref> -- <file>` → theme-check +
   preview theme → update the changelog below and the last-synced ref.
3. **Adding/removing files:** upstream may add engine modules (see candidates above)
   or split existing ones. Adding to the manifest is a deliberate decision — record
   it in the changelog with rationale. Removing (e.g. after a Rocky rebuild replaces
   a module) likewise.
4. **Mechanical enforcement** (both read the table above live — keep its
   `| \`assets/….js\`` row format stable):
   - A Claude Code PreToolUse hook (`.claude/hooks/protect-engine-manifest.sh`,
     wired in `.claude/settings.json`) blocks agent Edit/Write on tracked files.
     The engine-sync skill's `git checkout` path is unaffected. Override for a
     manifest-documented patch: `ENGINE_MANIFEST_ALLOW_EDIT=1` or `/hooks`.
   - CI (`.github/workflows/ci.yml`): theme-check at `--fail-level error`,
     `scripts/check-importmap.sh` (every `@theme/*` import must resolve), and a
     PR guard failing any PR that touches a tracked file without updating this
     manifest.

## Sync changelog

| Date | Upstream ref | Files | Outcome |
|---|---|---|---|
| 2026-07 | `70c27a8` (v3.5.1-era) | all | Baseline established (WS7 adoption). |
| 2026-07-14 | `68760d9` (v4.1.1), tag `engine-synced-v4.1.1` | **TAKEN (7):** component.js (pointerdown delegation + custom-element upgrade-race fix), morph.js (isEqualNode fast path + form-control state sync; escape hatches intact), section-renderer.js (abort/race fixes, backward-compatible API), utilities.js (isMetaInAppBrowser, owner-based lockScroll/unlockScroll; header region untouched), view-transitions.js (Meta in-app-browser white-screen fix — the v4.1.1 headline), money-formatting.js (refactor, exports unchanged), dialog.js (owner-based scroll locking via scroll-container). **PROMOTED:** scroll-container.js added to manifest + importmap (`snippets/scripts.liquid`, separate compat commit). **SKIPPED (2):** events.js — v4 deleted VariantUpdate/CartAdd/CartUpdate/CartError/Filter/Discount event classes that 21 Rocky-held files import; theme-editor.js — v4 removes the cart-drawer editor auto-open Rocky's v3.5.1 drawer needs. Both held at v3.5.1 until the cart/product JS rework. Verified: import-graph check clean, theme-check identical to baseline. |
