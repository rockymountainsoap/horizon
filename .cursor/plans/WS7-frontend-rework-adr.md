# WS7 — ADR: Ownership-Tier Model & Engine-Sync Strategy

**Status:** Accepted — 2026-07-14
**Deciders:** Henry B. (Rocky), via WS7 planning session
**Supersedes:** the "default upstream, opt out per file" fork-governance model
(`.gitattributes` merge=ours registry + `{%- # r: -%}` marker protocol + whole-tree
upstream merges).

---

## Context

Rocky is undertaking a large front-end rework: stripping most of Horizon's upstream
Liquid presentation layer and building a one-of-a-kind custom front-end, while keeping
Horizon's runtime engine (Component framework, morph, section renderer, events,
utilities). The previous governance model was built for **minimal divergence** — 63
`merge=ours` paths, mandatory inline markers, whole-tree merges per release. Once the
presentation layer is Rocky-owned wholesale, that machinery is pure friction: every
adopted-file edit paid a registration/marker tax, and whole-tree merges reviewed
hundreds of upstream changes to files Rocky had replaced.

Two events cemented the decision:

1. **Horizon v4.0.0 replaced the color-scheme system with color palettes**, rewriting
   the presentation layer (77 blocks / 40 sections / 59 snippets) around a theming
   model incompatible with Rocky's scheme-based settings. Staying presentation-synced
   with upstream would have required a full theming migration that the rework will
   immediately discard.
2. The `merge=ours` registry was found to be an **active footgun for normal
   development**: with `merge.ours.driver true`, *any* merge machinery (feature-branch
   merges, rebases, cherry-picks) touching a registered path silently keeps "ours"
   instead of raising a conflict — two Rocky branches editing `sections/header.liquid`
   would silently drop one side.

## Decision

**Invert the ownership default: the repo is Rocky-owned; upstream sync is opt-in via
an explicit engine manifest.** Three tiers:

| Tier | Scope | Obligation |
|---|---|---|
| **TRACK** | 14 engine JS files listed in `.cursor/references/engine-manifest.md` | The *only* upstream-sync obligation. Per Horizon release: diff manifest files, compat-review, cherry-pick via `git checkout upstream/<ref> -- <file>`. Never patched directly — extend by composition (`r-*` modules). |
| **ADOPT** | ~38 feature JS files + **all** Liquid, CSS, config, templates, locales | Frozen at the adoption baseline; Rocky-owned; **edited freely with no markers and no registration**. "Reference, not merge": upstream diffs may be consulted (`git diff adoption-baseline-v3.5.1..upstream/main -- <file>`) and fixes hand-ported when worth it. |
| **REBUILD / DROP** | ~16 presentational files (header cluster, media gallery, sticky ATC, decorative components) | Replaced by Rocky components during the rework, or not carried forward. Per-file calls: `.cursor/plans/WS7-feature-js-triage.md`. |

Supporting decisions:

- **Whole-tree upstream merges are retired.** The 2026-07 v4.1.1 merge was the final
  one, executed as a **history-only take**: upstream history merged through `68760d9`
  (v4.1.1), but all upstream-modified content was held back at v3.5.1-era state
  (palette rewrite not taken); only 10 new inert asset files, French locale updates,
  and release notes were taken. The v4.1.1 **engine** changes are the first pending
  engine-sync exercise (see manifest changelog).
- **Naming: the `r-` prefix is retained as a provenance convention** (Rocky-authored
  files, custom elements, CSS classes/vars, locale keys, metafields). Adopted files
  keep their existing names; rename opportunistically when a surface is rebuilt.
- **Two baselines:** the permanent tag `adoption-baseline-v3.5.1` (`70c27a8`) marks
  the frozen fork point for adopted-file reference diffs; the manifest's
  *last-synced upstream ref* advances with each engine sync.

## Consequences

**Positive**
- Development velocity: editing any adopted file is a plain edit — no
  `.gitattributes` registration, no `{%- # r: -%}` markers, no reconciliation debt.
- Upstream releases cost a manifest-scoped diff (~14 files) instead of a
  hundreds-of-files categorization exercise.
- Normal git operations (feature merges, rebases, cherry-picks) regain standard
  conflict behavior once the merge=ours registry is stripped.

**Negative / accepted**
- Upstream fixes to adopted files are no longer inherited; they require deliberate
  consultation of the baseline diff. Rocky owns all bugs in adopted code.
- Permanent drift from upstream presentation is accepted (and intended — the rework
  replaces it).
- `utilities.js` (tracked) contains header-DOM-coupled functions that must be split
  into an `r-` module when the custom header lands — a known obligation recorded in
  the manifest.

## Transition notes

- **Existing `{%- # r: -%}` markers are historical provenance.** They remain in:
  `snippets/cart-products.liquid`, `snippets/header-actions.liquid`,
  `snippets/cart-summary.liquid`, `snippets/cart-bumpers.liquid`,
  `snippets/cart-empty-state.liquid`, `sections/main-collection.liquid`,
  `blocks/_product-details.liquid`. **Leave them in place** (no removal churn); they
  are **never required again** for adopted files. Marker discipline survives only
  inside TRACKED manifest files (where patches are discouraged entirely).
- The un-prefixed Rocky files (`snippets/cart-bumpers.liquid`,
  `snippets/cart-empty-state.liquid`, `assets/cart-bumpers.js`,
  `blocks/variant-buttons.liquid`, `snippets/variant-buttons.liquid`,
  `assets/variant-buttons.js`) are simply Rocky-owned like everything else — the
  old registry concern about them is moot.

## Superseded artifacts

| Old artifact | Replacement |
|---|---|
| `.gitattributes` merge=ours registry (63 paths) | Comment-only pointer file; ownership recorded here + engine manifest |
| `.cursor/references/gitattributes-merge-strategy.md` | Tombstoned → `.cursor/references/engine-manifest.md` |
| `.claude/skills/upstream-merge/` (whole-tree merge playbook) | `.claude/skills/engine-sync/` (manifest-scoped sync) |
| `forked-theme-standards.mdc` §5 (upstream-modification protocol) + §12 (upstream update protocol) | Tier lookup + engine-sync summary in the rewritten rule |
| "Architecture-critical surfaces" concept (CLAUDE/AGENTS decision tree) | Everything is Rocky-owned except the engine manifest |

## Related documents

- `.cursor/references/engine-manifest.md` — the living TRACK registry + sync changelog
- `.cursor/plans/WS7-feature-js-triage.md` — per-file ADOPT/REBUILD/DROP calls
- `.claude/skills/engine-sync/SKILL.md` — the sync workflow
