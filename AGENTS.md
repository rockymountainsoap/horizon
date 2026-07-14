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
│   └── rocky-wishlist-app/  # Shopify app; extensions live here
├── workers/              # Edge workers (e.g. Cloudflare) — not theme code
│   └── native_worker/    # Wishlist API entry: native_worker.js
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

**Monorepo:** **`apps/`** is for the Shopify app (`rocky-wishlist-app` and its `extensions/`, including `customer-account-wishlist`). **`workers/native_worker/`** holds the Cloudflare Worker entry **`native_worker.js`**. Those trees are not Horizon theme files — see `apps/README.md` and `workers/native_worker/README.md`. The Worker authenticates with the Shopify Admin API using the **Client Credentials Grant** (OAuth 2.0 §4.4) — tokens are auto-acquired and cached, no manual OAuth install step needed. See `workers/native_worker/README.md` for full setup.

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

## Horizon Runtime Internals — Patterns Learned From WS0

These patterns were discovered during the WS0 native wishlist implementation. Record new findings here immediately when discovered — do not wait to be asked.

---

### Horizon Morph Library (`assets/morph.js`)

Horizon uses a DOM morphing library (idiomorph-based) to update sections in-place without full re-renders. Understanding its escape hatches is critical for any Rocky component whose DOM is populated at runtime.

**How section re-renders work**

1. An event (e.g. `cart:update`) reaches a component listener.
2. The component calls `sectionRenderer.renderSection(sectionId, { cache: false })`.
3. `sectionRenderer` fetches the section HTML via Shopify's Section Rendering API (`?sections=<id>`).
4. `morphSection(sectionId, html, mode)` diffs the server-rendered HTML against the live DOM using `morph()`.
5. Rocky components that **dynamically populate** their subtree at runtime (e.g. a wishlist item list) will be **wiped** by this morph because the server HTML for those elements is always empty.

**Escape hatches (apply to the element in the Liquid template)**

| Attribute | Effect |
|---|---|
| `data-skip-subtree-update` | Skips morphing ALL children of this element. Server HTML must also have the attribute for the skip to apply. Add it directly to the Liquid template. |
| `data-skip-node-update` | Skips morphing the node's own attributes/content, but still morphs its children. |

**When to use `data-skip-subtree-update`**

Any element whose children are built entirely by JavaScript at runtime (e.g. a `<dialog>` or `<div>` whose `innerHTML` is set by a custom element's `connectedCallback` or event handlers). Add the attribute to the Liquid template so the server HTML and live DOM both carry it — the morph library checks both sides.

```liquid
{%- # Example: protect the wishlist dialog from cart section re-renders -%}
<dialog
  id="r-wishlist-dialog"
  class="r-wishlist-dialog"
  data-skip-subtree-update
>
  ...dynamically-rendered content...
</dialog>
```

**Critical gotcha: cart-items-component lives inside the header section**

`<cart-items-component>` (inside `snippets/header-actions.liquid`) uses `this.sectionId` = the header section's ID. When it receives `cart:update` without `sections` data, it calls `sectionRenderer.renderSection(headerSectionId)`, which morphs the **entire header section** — including anything rendered by Rocky snippets inside the header (e.g. `r-header-wishlist`). Any dynamically-inserted wishlist items will be wiped unless `data-skip-subtree-update` is present on their container.

---

### Horizon Event System (`assets/events.js`, `ThemeEvents`)

**`ThemeEvents.cartUpdate = 'cart:update'`** is the single string used by:
- `CartUpdateEvent` — a general cart state update
- `CartAddEvent` — dispatched when an item is added to cart

**Both classes share the same event name.** This means dispatching `new CustomEvent('cart:update', ...)` is indistinguishable from a real `CartAddEvent`.

**Who listens to `cart:update`**

| Listener | Behaviour |
|---|---|
| `cart-icon.js` | Updates the badge count via `renderCartBubble(itemCount, comingFromProductForm)`. Safe — no DOM side-effects. |
| `cart-drawer.js` | Calls `this.showDialog()` **if the element has the `auto-open` attribute**. This opens the cart drawer on top of whatever is currently visible. |
| `component-cart-items.js` | If `event.detail.data.sections?.[this.sectionId]` is present, morphs that section HTML. Otherwise calls `sectionRenderer.renderSection(this.sectionId, { cache: false })` — which re-fetches and morphs the header section. |

**Safe pattern for dispatching `cart:update` from a Rocky component**

When you need all cart components to update (icon count + cart-items refresh) **without** the cart drawer auto-opening and covering the current UI:

```javascript
const cartDrawer = document.querySelector('cart-drawer');
const hadAutoOpen = cartDrawer?.hasAttribute('auto-open');
if (hadAutoOpen) cartDrawer.removeAttribute('auto-open');

// dispatchEvent() is synchronous — all listeners fire before this line returns.
// cart-drawer's handler runs here and skips showDialog() because auto-open is gone.
document.dispatchEvent(new CustomEvent('cart:update', {
  bubbles: true,
  detail: {
    resource: cart,
    sourceId: 'r-my-component',
    data: { itemCount: cart.item_count },
  },
}));

if (hadAutoOpen) cartDrawer.setAttribute('auto-open', '');
```

**Never dispatch `cart:update` without this guard** when the user is viewing a Rocky modal/drawer that must remain open.

---

### Shopify Admin API vs Storefront API — Type Differences

These differ from each other in ways that cause GraphQL errors if you copy query patterns between the two.

**`ProductVariant.price`**

| API | Type | Query syntax |
|---|---|---|
| **Storefront API** | `MoneyV2` object | `price { amount currencyCode }` |
| **Admin API** | `Money` **scalar** (plain decimal string) | `price` — no sub-selections |

Selecting `price { amount currencyCode }` in the Admin API throws:
```
Selections can't be made on scalars (field 'price' returns Money but has selections ["amount", "currencyCode"])
```

**Admin API workaround** — get currency from the product level (which does have a `MoneyV2`-style field) and get the amount as a scalar per variant:

```graphql
query WishlistProductDetails($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on Product {
      priceRange {
        minVariantPrice { currencyCode }   # MoneyV2 — sub-selections work here
      }
      variants(first: 10) {
        edges {
          node {
            price              # Money scalar — NO sub-selections
            compareAtPrice     # Money scalar — NO sub-selections
            availableForSale
          }
        }
      }
    }
  }
}
```

In JavaScript, pass the product-level `currencyCode` when formatting variant prices:
```javascript
const currencyCode = product.priceRange?.minVariantPrice?.currencyCode ?? 'USD';
const price = formatCurrency(variant.price, currencyCode); // variant.price is "12.00"
```

---

### CSS `[hidden]` Attribute vs `display` Declarations

The `[hidden]` HTML attribute sets `display: none` in the browser's UA stylesheet — but **without `!important`** in most modern resets. Any author CSS rule with equal or higher specificity that sets `display: anything` will override it.

**Example of the bug:**
```css
/* Author CSS — overrides [hidden] because same specificity, later in cascade */
.r-wishlist-dialog__loading {
  display: flex;  /* wins over [hidden]'s display: none */
}
```

**Fix — use a modifier class for the visible state:**
```css
.r-wishlist-dialog__loading {
  display: none;        /* default hidden */
}
.r-wishlist-dialog__loading--visible {
  display: flex;        /* JS adds this class to show */
}
```

```javascript
// In JS — toggle class instead of the hidden attribute
this._loadingEl.classList.toggle('r-wishlist-dialog__loading--visible', isLoading);
```

Never use `element.hidden = true/false` when author CSS sets `display` on that element class.

---

### `renderCartBubble` — Direct Cart Icon Update

`cart-icon.js` exposes `renderCartBubble(itemCount, comingFromProductForm, animate?)` as a public instance method. It can be called directly on the custom element to update the badge count without triggering any event side-effects:

```javascript
const cartIcon = /** @type {any} */ (document.querySelector('cart-icon'));
cartIcon?.renderCartBubble?.(cart.item_count, false);
```

Use this **only** when you also need to suppress the `cart:update` event for other reasons. In most cases, use the `auto-open` guard pattern above so all components stay in sync.

---

### Customer Account UI Extensions — Rendering Architecture (2026-01)

**API version: `2026-01`.** All Customer Account UI extensions use **Polaris web components** (`s-*` custom elements) rendered via **Preact to `document.body`** (Remote DOM). This IS the correct approach per Shopify docs.

**The `reactExtension()` / React component approach (`InlineStack`, `Button`, `Page` etc. from `@shopify/ui-extensions-react`) is the LEGACY 2025 API. Do NOT use it for new extensions.**

---

#### How Remote DOM Extensions Work — The Full Pipeline

The extension runs in a **Web Worker sandbox**. Understanding the full pipeline from source to execution is critical:

**1. Build time (Shopify CLI `shopify app build`):**

The CLI checks `api_version` in `shopify.extension.toml`. If `api_version >= 2025-10`, it treats the extension as a **Remote DOM extension** and generates a virtual entry point:

```javascript
// CLI-generated stdin entry for esbuild (you never see this file):
import Target_0 from './src/FullPageExtension.jsx';
shopify.extend('customer-account.page.render', (...args) => Target_0(...args));
```

If `api_version < 2025-10`, the CLI generates a **bare import** instead:
```javascript
import './src/FullPageExtension.jsx';  // no shopify.extend wrapper!
```

**⚠️ CRITICAL: `api_version` must be `2025-10` or later** for Remote DOM extensions. With older versions:
- The CLI's bare import doesn't consume `export default` → esbuild tree-shakes it → blank extension
- Manual `shopify.extend()` in your source runs, but the runtime doesn't set up Remote DOM → `document is not defined`

**2. Runtime (in the browser):**

1. Shopify Worker sandbox `eval()`'s the IIFE bundle — `shopify` global exists, `document` does NOT
2. The CLI-generated `shopify.extend()` call registers our callback — observable side effect, cannot be tree-shaken
3. Shopify runtime sets up **Remote DOM** — creates `document` in the Worker scope
4. Runtime calls the registered callback — our `export default` function runs, `document.body` is now available
5. Preact's `render()` mounts the component tree into the Remote DOM root

**3. Correct 2025-10+ Pattern:**

```jsx
/** @jsxImportSource preact */
import '@shopify/ui-extensions/preact'; // side-effect: registers @preact/signals
import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';

function MyExtension() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('shopify://customer-account/api/2025-10/graphql.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ customer { firstName } }' }),
    })
      .then((r) => r.json())
      .then(({ data }) => setData(data.customer.firstName));
  }, []);

  return (
    <s-page heading={shopify.i18n.translate('heading')}>
      <s-section>
        <s-text>{data ?? '…'}</s-text>
      </s-section>
    </s-page>
  );
}

// The CLI wraps this with shopify.extend() automatically — do NOT add shopify.extend() manually.
// document.body is available inside this callback because the runtime sets up Remote DOM first.
export default async () => {
  render(<MyExtension />, document.body);
};
```

**`shopify.extension.toml` must have:**
```toml
api_version = "2025-10"   # MINIMUM for Remote DOM — do NOT use 2025-04
```

**Things that DON'T work:**

| Approach | Why it fails |
|---|---|
| `render(<App />, document.body)` at module top level | `document is not defined` — Remote DOM not set up at eval time |
| `export default` with `api_version < 2025-10` | CLI generates bare import → default export not consumed → tree-shaken away → blank |
| Manual `shopify.extend()` with `api_version < 2025-10` | Callback runs but runtime doesn't set up Remote DOM → `document is not defined` |
| Manual `shopify.extend()` with `api_version >= 2025-10` | Double registration — CLI also generates `shopify.extend()` wrapper |

#### Component Reference (`s-*` Polaris Web Components)

All available components use the `s-` prefix. Common ones for the wishlist:

| Component | Usage |
|---|---|
| `<s-page heading="...">` | Page layout wrapper |
| `<s-section heading="...">` | Content section within a page |
| `<s-stack direction="block\|inline" gap="base\|small">` | Flex-like stack layout |
| `<s-grid grid-template-columns="..." gap="base">` | CSS grid layout |
| `<s-grid-item>` | Grid cell |
| `<s-text>` / `<s-text type="strong">` | Body text / bold text |
| `<s-heading>` | Section heading |
| `<s-image src="..." alt="..." aspect-ratio="1">` | Image |
| `<s-button href="...">` | Link button |
| `<s-button variant="secondary" onClick={fn}>` | Action button |
| `<s-badge tone="warning\|critical">` | Status badge |
| `<s-banner tone="critical\|info">` | Alert banner |
| `<s-skeleton-paragraph>` | Loading placeholder |
| `<s-spinner>` | Loading spinner |
| `<s-link href="shopify:customer-account/orders">` | Navigation link |

#### API Access

| Need | Correct approach |
|---|---|
| Customer metafields (read/write) | `fetch('shopify://customer-account/api/2025-10/graphql.json', {...})` |
| Storefront API (products, etc.) | `await shopify.query('query { nodes(ids:...) { ... } }', { variables: {...} })` |
| i18n | `shopify.i18n.translate('key')` / `shopify.i18n.formatCurrency(...)` |
| Extension settings | `shopify.settings?.my_setting_key` |

#### Key Bug: `customerAccountGraphql()` Variables Double-Nesting

The helper function `customerAccountGraphql(query, variables)` serialises `{ query, variables }` into the request body. If you call it with `customerAccountGraphql(query, { variables: { metafields: [...] } })`, the body becomes `{ query, variables: { variables: { metafields: [...] } } }` — GraphQL can't find `$metafields` and returns "was provided invalid value".

**Correct:**
```javascript
await customerAccountGraphql(mutationQuery, { metafields: [...] });
```

**Wrong (double-nesting):**
```javascript
await customerAccountGraphql(mutationQuery, { variables: { metafields: [...] } });
```

#### Key Bug: `s-grid` Is Not Production-Ready ("Coming Soon")

The official Polaris docs list `s-grid` as **"coming soon"**. The runtime sets `grid-template-columns` to `none` regardless of the value — including responsive `@container` syntax. This renders as a single-column stacked layout.

**Do not use `s-grid` / `s-grid-item`.** Use `s-stack direction="inline"` with `s-box` children instead. `s-stack direction="inline"` auto-wraps when space is limited, giving a natural multi-column feel:

```jsx
// ✅ Correct — s-stack inline wraps items naturally
<s-stack direction="inline" gap="base">
  {products.map((p) => (
    <s-box key={p.id}>
      <s-stack direction="block" gap="small">
        {/* card content */}
      </s-stack>
    </s-box>
  ))}
</s-stack>

// ❌ Wrong — s-grid sets columns to `none`, renders as 1 column
<s-grid grid-template-columns="1fr 1fr" gap="base">
  {products.map((p) => <s-grid-item key={p.id}>...</s-grid-item>)}
</s-grid>
```

#### Key Bug: Customer Account Extension Cannot Write to `$app` Namespace

The `$app` metafield namespace is **app-owned and write-protected**. The Customer Account API's `metafieldsSet` mutation rejects writes to it from extensions with:
> "Access to this namespace and key on Metafields for this resource type is not allowed."

**Reads work** (the extension can read `customer { metafield(namespace: "$app", ...) }`), but **writes must go through the Worker** which has Admin API access.

---

#### App Proxy Cannot Be Used from Customer Account Extensions

**DO NOT** route extension writes through the App Proxy URL (`{storeUrl}/apps/wishlist/...`). Shopify's App Proxy returns `302 Found` for any cross-origin request that lacks a storefront session cookie. Extensions run on `https://extensions.shopifycdn.com` and cannot provide a storefront cookie. The 302'd response also lacks CORS headers, so the browser fails with:
> "No 'Access-Control-Allow-Origin' header is present on the requested resource."

This happens for ALL requests (including "simple" requests that skip preflight). The simple-request workaround (omit Content-Type) avoids the preflight redirect but does NOT prevent the actual POST from being redirected.

---

#### Customer Account Extension → Worker Auth: Session Token

The correct pattern: call the Worker **directly** using a Shopify session token.

- Extensions get a JWT via `shopify.sessionToken.get()` (available on the global `shopify` object)
- Tokens are HS256, signed with the **app client secret** (`SHOPIFY_CLIENT_SECRET`)
- The `sub` claim contains the customer GID: `gid://shopify/Customer/12345`
- The `dest` claim contains the shop domain: `store-name.myshopify.com`
- Tokens expire in 5 minutes; `sessionToken.get()` auto-caches and refreshes

**Worker endpoint**: `POST /wishlist/ext/remove` (handled by `handlers/extRemove.js`)
- Reads `Authorization: Bearer <token>` header
- Validates JWT using `crypto.subtle` (HMAC-SHA256) in `shopify/sessionToken.js`
- Extracts customer ID and shop from claims
- Performs Admin API remove, returns `{ ok: true, list: [...] }`

**Extension code**:
```javascript
const WORKER_EXT_REMOVE_URL =
  'https://native-wishlist-worker.rocky-mountain-soap.workers.dev/wishlist/ext/remove';

async function removeFromWishlist(removeGid) {
  const token = await shopify.sessionToken.get(); // auto-cached JWT
  const res = await fetch(WORKER_EXT_REMOVE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ productGid: removeGid }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.reason || 'remove failed');
  return data.list;
}
```

**CORS**: The direct Worker URL (`*.workers.dev`) handles OPTIONS preflights correctly and returns `Access-Control-Allow-Origin: *`. The `Authorization` header must be listed in `Access-Control-Allow-Headers` in the preflight response (see `corsPreflightResponse()` in `index.js`).

#### Key Bug: Tree-Shaking and `api_version` Mismatch

If the extension shows a blank page, the most likely cause is one of:

**1. `api_version` is too old (< 2025-10):**
- The CLI generates `import './src/Extension.jsx';` (bare import, no wrapper)
- `export default` is never consumed → esbuild tree-shakes the entire component tree
- Bundle contains only Preact runtime (~19KB) with no extension code
- Symptom: blank container `<div class="..."></div>` with no content

**2. Manual `shopify.extend()` in source code:**
- Don't do this — the CLI generates it automatically for `api_version >= 2025-10`
- With `api_version < 2025-10`, manual `shopify.extend()` runs but Remote DOM isn't initialised → `document is not defined`

**How to verify builds**: after `shopify app build`, run:
```bash
python3 - <<'EOF'
import re
for name, path in [
  ('FullPage', 'extensions/customer-account-wishlist/dist/customer-account-wishlist.js'),
  ('ProfileBlock', 'extensions/wishlist-profile-block/dist/wishlist-profile-block.js'),
]:
  content = open(path).read()
  print(f"\n=== {name} ({len(content):,} bytes) ===")
  for label, pat in [('shopify.extend', r'shopify\.extend'), ('document.body', r'document\.body'), ('component tag', r's-page|s-stack|s-text')]:
    print(f"  {'✓' if re.search(pat, content) else '✗'} {label}")
EOF
```
`shopify.extend` (CLI-generated), `document.body`, and at least one `s-*` tag must be `✓`. If `shopify.extend` is missing, `api_version` is too old. If `s-*` tags are `✗`, the component tree is tree-shaken (also an `api_version` issue).

#### Dependencies (correct for 2026-01)

```json
{
  "dependencies": {
    "@preact/signals": "^2.0.0",
    "@shopify/ui-extensions": "^2026.1.1",
    "preact": "^10.25.4"
  }
}
```

Do NOT include `@shopify/ui-extensions-react`, `react`, or `react-reconciler` — those are the legacy React API packages.

---

### Embedded Admin Pages — App Bridge + Worker Served HTML (2026-04)

The wishlist app's admin stats page (`GET /admin` on `native_worker`) is an
**embedded** Shopify admin page, rendered as static HTML from the Worker and
authenticated via App Bridge session tokens. This is a different auth path
from both App Proxy (storefront) and Customer Account extensions.

**Pipeline:** Shopify admin loads `<app_url>/admin?shop=…&host=…&hmac=…` inside
an iframe. The HTML loads `https://cdn.shopify.com/shopifycloud/app-bridge.js`
with a `<meta name="shopify-api-key">` tag. App Bridge 4 exposes the global
`shopify`, and `await shopify.idToken()` returns an HS256 JWT signed with the
app's client secret. All stats calls attach it as
`Authorization: Bearer <token>`. The Worker verifies via
`verifyAdminToken(token, secret, expectedShop)` in
`src/shopify/sessionToken.js`.

**Non-obvious gotchas:**

| Gotcha | Fix |
|---|---|
| `X-Frame-Options: DENY` in default `secureHeaders` blocks the Shopify admin iframe | The admin page handler omits `X-Frame-Options` and uses `Content-Security-Policy: frame-ancestors https://*.myshopify.com https://admin.shopify.com` |
| `shopify.sessionToken.get()` (Customer Account) ≠ `shopify.idToken()` (App Bridge admin) | Use `idToken()` in admin pages. Both produce HS256 JWTs signed with the same client secret, but the `sub` claim differs — Customer Account puts `gid://shopify/Customer/…`, admin puts `gid://shopify/User/…` |
| `verifySessionToken` hard-fails on non-Customer `sub` | Use the sibling `verifyAdminToken` helper, which accepts any `sub` and instead requires `dest` == expected shop |
| App Bridge may not be ready synchronously when the initial `<script>` runs | Poll `typeof shopify.idToken === 'function'` with a 3s deadline before the first fetch (see `handlers/adminPage.js` `init()`) |
| CSV downloads need custom auth headers — a plain `<a href>` can't attach them | Fetch the CSV with the session token, `URL.createObjectURL(blob)`, click a temporary `<a download>` |

**Aggregating customer metafields at scale:** Shopify's Admin API has no
"give me every value for metafield X" query, so the stats endpoint paginates
every customer (up to 500 × 100 = 50 000) with the `$app/saved_products`
metafield inline, filters client-side to non-empty, then caches the result in
`APP_KV` under `admin_stats_v1` for 10 min. For stores larger than that, the
next upgrade path is a bulk operation or a webhook-maintained aggregate.

---

## Engine Sync Protocol (replaces the Upstream Update Protocol)

Whole-tree upstream merges are retired. When Shopify releases a new Horizon version:

1. Run the **engine-sync skill** (`.claude/skills/engine-sync/SKILL.md`)
2. It diffs only the 14 engine-manifest files from the last-synced ref, compat-reviews each change, and applies via `git checkout upstream/<ref> -- <file>` — never `git merge`
3. Verify with theme-check + a preview theme, then record the sync in the manifest changelog and advance the last-synced ref
4. For ADOPTED files, upstream fixes are consulted manually when worth it: `git diff adoption-baseline-v3.5.1..upstream/main -- <file>` (reference, never merge)

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
