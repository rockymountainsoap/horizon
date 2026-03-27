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

**Monorepo:** **`apps/`** is for the Shopify app (`rocky-wishlist-app` and its `extensions/`, including `customer-account-wishlist`). **`workers/native_worker/`** holds the Cloudflare Worker entry **`native_worker.js`**. Those trees are not Horizon theme files — see `apps/README.md` and `workers/native_worker/README.md`. The Worker authenticates with the Shopify Admin API using the **Client Credentials Grant** (OAuth 2.0 §4.4) — tokens are auto-acquired and cached, no manual OAuth install step needed. See `workers/native_worker/README.md` for full setup.

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
{{- # Example: protect the wishlist dialog from cart section re-renders -}}
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
