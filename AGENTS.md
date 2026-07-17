# Rocky × Horizon — Agent Handbook

This file is the authoritative entry point for any AI agent working in this codebase. Read it completely before taking any action.

---

## What This Codebase Is

This is **Rocky's production Shopify theme** — originally a managed fork of [Shopify Horizon](https://github.com/Shopify/horizon), now operating under the **WS7 ownership-tier model** (2026-07): the repo is **Rocky-owned by default**, and upstream sync is opt-in for a small engine manifest. Rocky is building a fully custom front-end on top of Horizon's runtime engine (Component framework, morph, section renderer, events, utilities).

**The single most important constraint:** the 14 engine files listed in `.cursor/references/engine-manifest.md` are TRACKED from upstream and must not be patched directly — extend them by composition (`r-*.js` modules). Everything else is Rocky-owned: edit freely, no registration, no markers. Full rationale: `.cursor/plans/WS7-frontend-rework-adr.md`.

---

## Mandatory Reading Before Any Code Change

The primary rule set lives here — **always read it first**:

```
.cursor/rules/forked-theme-standards.mdc
```

This rule has `alwaysApply: true` and governs every file in the repo. It is the canonical reference for:

- The ownership-tier model (TRACK engine manifest / ADOPT everything else / REBUILD-DROP)
- How to name files, CSS classes, CSS variables, custom elements, and locale keys (`r-` provenance prefix)
- The CSS architecture (`r-base.css`, `{% stylesheet %}`, design tokens)
- Colour scheme strategy (3 schemes, `scheme-1/2/3` — Rocky kept schemes; upstream v4.x moved to palettes)
- App integration patterns (Loop, Judge.me, Klaviyo)
- Engine sync protocol and deploy discipline

All other rules in `.cursor/rules/` apply to their respective file types. The forked-theme-standards override them where there is any conflict.

---

## Repository Layout

```
horizon/                    # repo root = Horizon theme (Rocky fork)
├── apps/                 # Shopify app(s) — not theme code
│   └── variant-filter-app/  # Shopify app; extensions live here
├── workers/              # Edge workers (e.g. Cloudflare) — not theme code
│   └── locator_worker/   # Store locator API
├── assets/           # CSS, JS, images
│   ├── component.js / morph.js / events.js / … ← ENGINE MANIFEST (14 tracked files — do not patch; see .cursor/references/engine-manifest.md)
│   ├── base.css          ← adopted (Rocky-owned; edit deliberately, prefer r-base.css)
│   ├── r-base.css        ← Rocky shared stylesheet
│   ├── *.js              ← adopted feature JS (Rocky-owned; edit freely)
│   └── r-*.js / r-*.css  ← Rocky-authored assets
├── blocks/           # Theme blocks — all Rocky-owned (r-* = Rocky-authored, rest adopted)
├── config/
│   ├── settings_data.json   ← Rocky-owned (store settings + 3 colour schemes)
│   └── settings_schema.json ← Rocky-owned (theme editor schema, scheme-based)
├── layout/
│   └── theme.liquid      ← Rocky-owned (global shell)
├── locales/
│   ├── en.default.json        ← storefront copy (rocky.* namespace for Rocky keys)
│   └── en.default.schema.json ← editor labels (r_* keys for Rocky entries)
├── sections/         # All Rocky-owned (r-* = Rocky-authored, rest adopted)
├── snippets/         # All Rocky-owned (r-* = Rocky-authored, rest adopted)
├── templates/        # All Rocky-owned; *.r-*.json = alternate layouts
├── .gitattributes        ← comment-only pointer (merge=ours registry retired)
├── .cursor/
│   ├── rules/            ← All cursor rules (MDC files)
│   ├── references/       ← Living reference documents (incl. engine-manifest.md)
│   └── plans/            ← Workstream plans (WS-prefixed filenames; see below)
└── AGENTS.md             ← This file
```

**The `r-` prefix marks Rocky-authored files (provenance).** Un-prefixed theme files are adopted from Horizon and equally Rocky-owned — edit them freely. New Rocky files always get the `r-` prefix; adopted files keep their names until rebuilt.

**Monorepo:** **`apps/`** holds Rocky's Shopify apps (e.g. `variant-filter-app` and its `extensions/`). **`workers/`** holds edge workers (e.g. `locator_worker`). Those trees are not Horizon theme files — see `apps/README.md` and `workers/README.md`.

---

## Plan documents (workstreams)

Planning docs, work-back notes, and agent-oriented task breakdowns belong in **`.cursor/plans/`** — keep them out of the theme root and out of ad-hoc folders so agents and humans can find context quickly.

**Location:** `.cursor/plans/`

**Naming — WS (workstream) prefix**

- Start every filename with the workstream ID so files sort and group by program phase: **`WS0-`**, **`WS1-`**, **`WS2-`**, etc. (align numbering with your roadmap, e.g. WS 0 Core shell, WS 1 Global Nav).
- Follow the prefix with a short **kebab-case** slug describing the doc.

**Examples**

```
.cursor/plans/
├── WS0-theme-shell.md
├── WS1-global-navigation.md
├── WS2-homepage-plp-pdp.md
├── WS4-journal-content.md
└── WS6-data-qa.md
```

For related docs under one WS, keep the same prefix and vary the slug: `WS2-plp-audit.md`, `WS2-pdp-implementation.md`.

**Workflow**

- When starting or updating a workstream, add or revise its plan here.
- Before implementing WS-scoped work, agents should check `.cursor/plans/` for the relevant **`WS*`** file(s).
- Link to these files from issues or PRs when helpful.

---

## The `r-` Prefix — Provenance Convention

Everything Rocky **authors** uses the `r-` prefix. Since WS7 this is a provenance signal (Rocky-authored vs adopted-from-Horizon), not a merge-safety constraint — whole-tree merges are retired. Adopted files keep their existing names until rebuilt.

| What | Pattern | Example |
|---|---|---|
| Section files | `sections/r-*.liquid` | `sections/r-hero-campaign.liquid` |
| Block files | `blocks/r-*.liquid` | `blocks/r-shoppable-card.liquid` |
| Snippet files | `snippets/r-*.liquid` | `snippets/r-rewards-bar.liquid` |
| CSS asset | `assets/r-*.css` | `assets/r-base.css` |
| JS asset | `assets/r-*.js` | `assets/r-store-locator.js` |
| Template alternates | `templates/*.r-*.json` | `templates/product.r-pdp.json` |
| CSS class names | `.r-*` BEM | `.r-journal-card__image` |
| CSS custom properties | `--r-*` | `--r-journal-card-gap` |
| Custom elements | `r-*` | `customElements.define('r-store-locator', ...)` |
| Locale keys (storefront) | `rocky.*` | `rocky.journal.read_more` |
| Locale keys (schema) | `r_*` | `t:names.r_journal_index` |
| Metafield namespace | `rocky` | `product.metafields.rocky.tagline` |
| Metaobject definitions | `rocky_*` | `rocky_campaign_issue` |

---

## Decision Tree — Before Writing Any Code

```
Is the file listed in .cursor/references/engine-manifest.md? (14 tracked engine JS files)
│
├── YES (TRACK) → Do NOT patch it.
│    ├── Extend by composition: new r-*.js module importing @theme/*.
│    └── Patch truly unavoidable → `// r:` comment + record in the manifest table.
│
└── NO → The file (or the file you'd create) is Rocky-owned.
     ├── Net-new feature → create an r-* file (section/block/snippet/asset).
     ├── Change to an adopted file → edit it directly. No markers, no registration.
     │    (Optional: check `git diff adoption-baseline-v3.5.1..upstream/main -- <file>`
     │     for upstream fix ideas — reference, never merge.)
     └── Surface slated REBUILD/DROP in WS7-feature-js-triage.md
          → prefer building the Rocky replacement over investing in the old file.
```

---

## File-Type Cheat Sheet

### Creating a Rocky Section

1. File: `sections/r-{area}-{descriptor}.liquid`
2. Root element class: `r-{name} color-{{ section.settings.color_scheme }}`
3. CSS: **all styles inside `{% stylesheet %}` in the same file** — never in `r-base.css`
4. Schema name: `"t:names.r_{name}"` — add the key to `locales/en.default.schema.json` as `"Rocky — {Human Name}"`
5. Colour scheme setting + padding settings are required in every section schema (see §6 of forked-theme-standards)

### Creating a Rocky Block

1. File: `blocks/r-{descriptor}.liquid`
2. Must include `{{ block.shopify_attributes }}`
3. CSS: **inside `{% stylesheet %}`** — only move to `r-base.css` if used in 2+ Rocky files
4. For scheme inheritance, add `inherit_color_scheme` checkbox + conditional `color_scheme` picker (see §14 of forked-theme-standards)

### Creating a Rocky Template

Use Shopify alternate templates instead of editing upstream ones:

```
templates/product.r-pdp.json        ← Rocky PDP layout
templates/page.r-about.json         ← About Us page
templates/article.r-editorial.json  ← Journal article
```

### Modifying an Adopted File

Adopted files (everything not in the engine manifest) are Rocky-owned — **edit them directly.** No `.gitattributes` registration, no `{%- # r: -%}` markers, no ceremony. Keep changes composable where it helps (blocks, `content_for 'blocks'` insertion points), but that's a design preference, not a protocol.

Existing `{%- # r: -%}` markers from the pre-WS7 era are historical provenance — leave them in place; never add new ones.

**Inline-comment syntax — avoid `Syntax error in tag '#'`.** `{%- # … -%}` is Liquid's *line-oriented* comment tag: if a comment wraps onto multiple lines, **every** line must start with `#`. Shopify's upload validator throws on violations that theme-check misses locally. Keep `{%- # … -%}` comments single-line; use `{% comment %}` blocks for longer notes.

### Modifying a Tracked Engine File

Don't. Extend by composition — a new `r-*.js` module importing `@theme/*`. If a patch is truly unavoidable: mark it with a `// r:` comment, record it in the engine-manifest table (it becomes a hand-reapply obligation on every engine sync), and treat that as a debt to remove.

---

## CSS Rules in 6 Lines

1. All Rocky class names: `.r-` BEM prefix
2. All Rocky CSS variables: `--r-` prefix, scoped to their component — never on `:root` unless truly global
3. Rocky-specific colour tokens: scoped to `.color-scheme-1/2/3` in `r-base.css` (not `:root`)
4. Never use raw hex values — always `var(--color-*)` or `var(--r-*)`
5. Never define `--color-*` properties — that is the upstream namespace
6. Section/block CSS is self-contained in its `.liquid` file; `r-base.css` is only for shared styles used in 2+ Rocky files

---

## Colour Schemes in 5 Lines

1. Rocky uses exactly 3 schemes: `scheme-1` (Light), `scheme-2` (Dark), `scheme-3` (Journal)
2. Apply scheme to a section root: `class="r-{name} color-{{ section.settings.color_scheme }}"`
3. Use upstream tokens for standard UI: `var(--color-background)`, `var(--color-foreground)`, etc.
4. Add Rocky-specific extra tokens in `r-base.css` scoped to `.color-scheme-1/2/3` with `--r-` prefix
5. Never create scheme-4 or higher; never add colours to `settings_schema.json`

---

## Locale Keys

**Storefront copy** → `locales/en.default.json` under `rocky.*` namespace:
```json
{ "rocky": { "journal": { "read_more": "Read More" } } }
```
```liquid
{{ 'rocky.journal.read_more' | t }}
```

**Schema labels** → `locales/en.default.schema.json` under `names` and `settings`:
```json
{ "names": { "r_journal_index": "Rocky — Journal Index" } }
```
```json
{ "name": "t:names.r_journal_index" }
```

Both locale files are Rocky-owned. Keep Rocky keys in the `rocky.*` / `r_*` namespaces for findability.

---

## Metafields

All Rocky metafield definitions use the `rocky` admin namespace:
```liquid
{{ product.metafields.rocky.tagline }}
{{ article.metafields.rocky.campaign_issue }}
```

Metaobject types are prefixed `rocky_`: `rocky_campaign_issue`, `rocky_store_location`, `rocky_ingredient`.

---

## JavaScript

- Rocky JS: `assets/r-*.js` only — never add to upstream asset files
- Custom elements: `customElements.define('r-*', ...)` — `r-` prefix required
- Use the Horizon `Component` framework (`import { Component } from '@theme/component'`)
- Load JS from within the section that needs it — not globally from `theme.liquid`
- Defer non-critical scripts; no `console.log` in production
- See `.cursor/rules/javascript-standards.mdc` for full JS conventions

---

## The `.gitattributes` File (historical)

The `merge=ours` registry is **retired** (WS7). `.gitattributes` is now a comment-only pointer file. Do not re-add merge entries — ownership is recorded in the WS7 ADR and the engine manifest, and upstream sync happens via manifest-scoped cherry-picks, never `git merge`. The old registry's rationale survives in git history and the tombstoned `.cursor/references/gitattributes-merge-strategy.md`.

---

## App Integrations

| App | Pattern |
|---|---|
| Loop Subscriptions | App block inside `r-pdp-buy-button.liquid` or equivalent Rocky block |
| Judge.me | App block inside `r-pdp-social-proof.liquid` — never in upstream sections |
| Klaviyo | App blocks in Rocky sections; global script goes in `snippets/scripts.liquid` (Rocky-owned — edit directly) |

General rule: `{ "type": "@app" }` in section schemas enables app blocks. Keep third-party Liquid/JS contained in app blocks within Rocky sections rather than scattering it through the theme.

---

## Engine Sync Protocol (replaces the Upstream Update Protocol)

Whole-tree upstream merges are retired. When Shopify releases a new Horizon version:

1. Run the **engine-sync skill** (`.claude/skills/engine-sync/SKILL.md`)
2. It diffs only the 14 engine-manifest files from the last-synced ref, compat-reviews each change, and applies via `git checkout upstream/<ref> -- <file>` — never `git merge`
3. Verify with theme-check + a preview theme, then record the sync in the manifest changelog and advance the last-synced ref
4. For ADOPTED files, upstream fixes are consulted manually when worth it: `git diff adoption-baseline-v3.5.1..upstream/main -- <file>` (reference, never merge)

---

## Deploy Discipline

CLI flags live in `shopify.theme.toml` environments (`.shopifyignore` is retired —
it applied to `theme dev` too and stripped templates from the dev theme, 404ing
every page):

- Local preview: `shopify theme dev -e dev` (full tree, no ignores)
- Deploy: duplicate the live theme (`shopify theme duplicate`), then
  `shopify theme push -e staging --theme <ID>` — the environment's ignore list
  keeps merchant-owned JSON (templates, section groups, settings_data) untouched
- Seed a brand-new JSON file past the ignores: one-off
  `shopify theme push --theme <ID> --only "<path>"`
- Gate production behind a full cross-browser review on the preview theme
- Never push directly to the live theme during active development

---

## All Active Cursor Rules

These rules apply automatically to their respective file types. The forked-theme-standards override all others when there is a conflict.

| Rule file | Scope |
|---|---|
| `forked-theme-standards.mdc` | **Always on** — entire codebase |
| `sections.mdc` | `sections/*.liquid` |
| `blocks.mdc` | `blocks/*.liquid` |
| `snippets.mdc` | `snippets/*.liquid` |
| `liquid.mdc` | `*.liquid` |
| `css-standards.mdc` | `.css`, `{% stylesheet %}`, `{% style %}` |
| `javascript-standards.mdc` | `.js`, `{% javascript %}` |
| `schemas.mdc` | `blocks/*.liquid`, `sections/*.liquid` |
| `templates.mdc` | `templates/*.json` |
| `assets.mdc` | `assets/*` |
| `locales.mdc` | `locales/*.json` |
| `localization.mdc` | Liquid files with translation |
| `theme-settings.mdc` | `config/settings_schema.json` |
| Accessibility rules (`*-accessibility.mdc`) | All `.liquid`, `.html`, `.css`, `.js` files |

---

## Quick Decisions

| Question | Answer |
|---|---|
| Can I edit this file? | Yes, unless it's one of the 14 files in `.cursor/references/engine-manifest.md` — those are tracked from upstream; extend via `r-*.js` composition instead |
| Should I edit an adopted section (e.g. `sections/hero.liquid`)? | Yes — edit directly. No markers, no registration. |
| Should I edit `templates/product.json`? | Yes — templates are Rocky-owned. Alternates (`product.r-*.json`) are for offering additional layouts, not merge safety. |
| How do I pull a new Horizon release? | Run the engine-sync skill — manifest-scoped cherry-pick, never `git merge upstream/main` |
| How do I check upstream's fix for an adopted file? | `git diff adoption-baseline-v3.5.1..upstream/main -- <file>` — read it, hand-port if worth it |
| Do new files need the `r-` prefix? | Yes — it marks Rocky-authored files (provenance). Adopted files keep their names until rebuilt. |
| Where does section CSS go? | Inside the section's own `{% stylesheet %}` tag |
| Where does shared CSS go? | `assets/r-base.css` only if used in 2+ files |
| Can I edit `assets/base.css`? | Yes (it's adopted), but prefer `r-base.css`/`{% stylesheet %}`; edit base.css deliberately |
| Where do colour tokens for Journal go? | `.color-scheme-3 { --r-color-journal-bg: … }` in `r-base.css` |
| Can I use `#hex` in CSS? | Never — use `var(--color-*)` or `var(--r-*)` |
| Can I define `--color-*` in Rocky CSS? | No — that's the reserved token namespace; use `--r-*` |
| Can I create scheme-4 or adopt upstream's v4 palettes? | No — Rocky uses scheme-1/2/3; the palette system was deliberately not taken (see ADR) |
| Should I add Rocky copy to an existing locale namespace? | No — use `rocky.*` namespace |
| Can I add custom elements without `r-` prefix? | No — always `customElements.define('r-*', ...)` |
| Where do Rocky metafields live? | `rocky` namespace in Shopify admin |
| Where do planning / workstream docs go? | `.cursor/plans/` with a **`WS*`** workstream prefix on each filename (e.g. `WS3-pdp-routine.md`) |
