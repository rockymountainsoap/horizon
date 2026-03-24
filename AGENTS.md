# Rocky × Horizon — Agent Handbook

This file is the authoritative entry point for any AI agent working in this codebase. Read it completely before taking any action.

---

## What This Codebase Is

This is **Rocky's production Shopify theme** — a managed fork of [Shopify Horizon](https://github.com/Shopify/horizon). The upstream theme receives ongoing updates from Shopify. Every decision made here must balance Rocky's customizations against the ability to pull those updates cleanly.

**The single most important constraint:** Rocky-owned code must never overwrite upstream code. The `r-` prefix enforces this at the file system and CSS level. When in doubt, create a new `r-*` file rather than touching an existing one.

---

## Mandatory Reading Before Any Code Change

The primary rule set lives here — **always read it first**:

```
.cursor/rules/forked-theme-standards.mdc
```

This rule has `alwaysApply: true` and governs every file in the repo. It is the canonical reference for:

- Whether to create a new file or modify an existing one
- How to name files, CSS classes, CSS variables, custom elements, and locale keys
- The CSS architecture (`r-base.css`, `{% stylesheet %}`, upstream tokens)
- Colour scheme strategy (3 schemes, `scheme-1/2/3`)
- How to modify upstream files safely (`.gitattributes` + `{%- # r: -%}` markers)
- Template alternates vs editing upstream templates
- App integration patterns (Loop, Judge.me, Klaviyo)
- Upstream update protocol and deploy discipline

All other rules in `.cursor/rules/` apply to their respective file types. The forked-theme-standards override them where there is any conflict.

---

## Repository Layout

```
horizon/                    # repo root = Horizon theme (Rocky fork)
├── apps/                 # Shopify app(s) — not theme code
│   └── rocky-wishlist-app/  # Shopify app; extensions live here
├── workers/              # Edge workers (e.g. Cloudflare) — not theme code
│   └── native_worker/    # Wishlist API entry: native_worker.js
├── assets/           # CSS, JS, images
│   ├── base.css          ← UPSTREAM — do not edit
│   ├── r-base.css        ← Rocky shared stylesheet (Rocky-owned)
│   └── r-*.js / r-*.css  ← Rocky-specific assets
├── blocks/           # Theme blocks
│   └── r-*.liquid        ← Rocky blocks (Rocky-owned)
├── config/
│   ├── settings_data.json   ← merge=ours (store settings + 3 colour schemes)
│   └── settings_schema.json ← merge=ours (theme editor schema)
├── layout/
│   └── theme.liquid      ← merge=ours (global shell)
├── locales/
│   ├── en.default.json        ← merge=ours (storefront copy, rocky.* namespace)
│   └── en.default.schema.json ← merge=ours (editor labels, r_* keys)
├── sections/
│   ├── header.liquid     ← UPSTREAM but merge=ours (customised)
│   ├── r-*.liquid        ← Rocky sections (Rocky-owned)
│   └── *.liquid          ← All other upstream sections
├── snippets/
│   ├── stylesheets.liquid ← merge=ours (loads r-base.css)
│   ├── r-*.liquid         ← Rocky snippets (Rocky-owned)
│   └── *.liquid           ← Upstream snippets
├── templates/
│   ├── product.json          ← UPSTREAM but merge=ours
│   ├── product.r-pdp.json    ← Rocky alternate template
│   └── *.r-*.json            ← Rocky alternate templates
├── .gitattributes        ← Merge strategy (keep reading)
├── .cursor/
│   ├── rules/            ← All cursor rules (MDC files)
│   ├── references/     ← Living reference documents
│   └── plan/             ← Workstream plans (WS-prefixed filenames; see below)
└── AGENTS.md             ← This file
```

**Rocky-owned files are always prefixed `r-`.** Any file without that prefix is upstream Horizon. Never create a non-`r-` file in `sections/`, `blocks/`, `snippets/`, or `assets/`.

**Monorepo:** **`apps/`** is for the Shopify app (`rocky-wishlist-app` and its `extensions/`, including `customer-account-wishlist`). **`workers/native_worker/`** holds the Cloudflare Worker entry **`native_worker.js`**. Those trees are not Horizon theme files — see `apps/README.md` and `workers/README.md`. WS0 native wishlist is scaffolded there; run `shopify app dev` from `apps/rocky-wishlist-app` after filling `shopify.app.toml` and deploying the Worker.

---

## Plan documents (workstreams)

Planning docs, work-back notes, and agent-oriented task breakdowns belong in **`.cursor/plan/`** — keep them out of the theme root and out of ad-hoc folders so agents and humans can find context quickly.

**Location:** `.cursor/plan/`

**Naming — WS (workstream) prefix**

- Start every filename with the workstream ID so files sort and group by program phase: **`WS0-`**, **`WS1-`**, **`WS2-`**, etc. (align numbering with your roadmap, e.g. WS 0 Core shell, WS 1 Global Nav).
- Follow the prefix with a short **kebab-case** slug describing the doc.

**Examples**

```
.cursor/plan/
├── WS0-theme-shell.md
├── WS1-global-navigation.md
├── WS2-homepage-plp-pdp.md
├── WS4-journal-content.md
└── WS6-data-qa.md
```

For related docs under one WS, keep the same prefix and vary the slug: `WS2-plp-audit.md`, `WS2-pdp-implementation.md`.

**Workflow**

- When starting or updating a workstream, add or revise its plan here.
- Before implementing WS-scoped work, agents should check `.cursor/plan/` for the relevant **`WS*`** file(s).
- Link to these files from issues or PRs when helpful.

---

## The `r-` Prefix — The Golden Rule

Everything Rocky creates uses the `r-` prefix. This is not a stylistic choice — it is a hard merge-safety constraint.

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
Is this a net-new Rocky feature?
│
├── YES: Does any existing upstream file cover this surface?
│    ├── NO  → Create r-* file. Done.
│    └── YES → Can I compose a new r-* section/block on top of it?
│              ├── YES → Create r-* file using content_for 'blocks'. Done.
│              └── NO  → Must modify upstream file. Follow §5 of forked-theme-standards.
│
└── NO (bug fix / upstream improvement):
     ├── Bug is in an upstream file and upstream hasn't fixed it
     │    → Register file in .gitattributes, fix it, mark with {%- # r: -%}
     └── Bug is in an r-* file → fix freely
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

### Modifying an Upstream File (last resort)

1. Add the file to `.gitattributes` as `merge=ours`
2. Add it to the table in `.cursor/references/gitattributes-merge-strategy.md`
3. Mark every Rocky change with a valid Liquid inline comment:
   ```liquid
   {%- # r: brief description of what was added -%}
   ```
4. Keep changes minimal — prefer adding hooks that Rocky sections can compose from

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

Both locale files are `merge=ours`. Never add Rocky keys to upstream key namespaces.

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

## The `.gitattributes` File

`merge=ours` tells Git to keep our version of a file when merging from upstream Horizon. Registered files include: config, core layout, modified upstream sections, all templates, primary locales, key snippets, and `r-base.css`.

**Before modifying any upstream file:** add it to `.gitattributes` and the reference table at `.cursor/references/gitattributes-merge-strategy.md`.

**One-time developer setup:**
```bash
git config merge.ours.driver true
```

Full details: `.cursor/references/gitattributes-merge-strategy.md`

---

## App Integrations

| App | Pattern |
|---|---|
| Loop Subscriptions | App block inside `r-pdp-buy-button.liquid` or equivalent Rocky block |
| Judge.me | App block inside `r-pdp-social-proof.liquid` — never in upstream sections |
| Klaviyo | App blocks in Rocky sections; global script goes in `snippets/scripts.liquid` (register as `merge=ours` first) |

General rule: `{ "type": "@app" }` in section schemas enables app blocks. Never embed third-party Liquid/JS directly into upstream files.

---

## Upstream Update Protocol

When Shopify releases a new Horizon version:

1. Pull upstream into a **staging branch** — never directly into the working branch
2. Diff every `merge=ours` file against the new upstream version — cherry-pick bug fixes
3. Audit every `{%- # r: -%}` marker in upstream files we touched — ensure they survive
4. Accept non-conflicting upstream files freely — they don't touch Rocky-owned code
5. Test in a **development/preview theme** before merging to main
6. Update `.gitattributes` for any newly customized files

---

## Deploy Discipline

- Use `shopify theme dev` for local preview
- Push to a development theme with `shopify theme push --development`
- Gate production pushes behind a full cross-browser review on a preview theme
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
| Should I edit an upstream section? | No — create `sections/r-*.liquid` instead |
| Should I edit `templates/product.json`? | No — create `templates/product.r-*.json` |
| Where does section CSS go? | Inside the section's own `{% stylesheet %}` tag |
| Where does shared CSS go? | `assets/r-base.css` only if used in 2+ files |
| Where do colour tokens for Journal go? | `.color-scheme-3 { --r-color-journal-bg: … }` in `r-base.css` |
| Can I use `#hex` in CSS? | Never — use `var(--color-*)` or `var(--r-*)` |
| Can I define `--color-*` in Rocky CSS? | No — that namespace belongs to upstream |
| Can I create scheme-4? | No — Rocky uses scheme-1, 2, 3 only |
| Should I add Rocky copy to an existing locale namespace? | No — use `rocky.*` namespace |
| Can I add custom elements without `r-` prefix? | No — always `customElements.define('r-*', ...)` |
| I need to modify upstream — what first? | Add to `.gitattributes` + reference doc, then edit with `{%- # r: -%}` markers |
| Where do Rocky metafields live? | `rocky` namespace in Shopify admin |
| Where do planning / workstream docs go? | `.cursor/plan/` with a **`WS*`** workstream prefix on each filename (e.g. `WS3-pdp-routine.md`) |
