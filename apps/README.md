# Apps — Shopify (`variant-filter-app`)

This directory holds Rocky Mountain Soap's custom Shopify apps. The Horizon theme lives at the **repository root**; app code lives here to avoid mixing with theme merge rules.

---

## Apps at a glance

| App | Workstream | Runtime | Purpose |
|-----|-----------|---------|---------|
| `variant-filter-app` | WS1 | Cloudflare Worker + Theme App Extension | Per-collection variant filter rules with server-side product-card pre-selection |

---

## `variant-filter-app`

### Overview

A Shopify-embedded admin app that lets merchants configure a **variant filter rule** per collection. On the storefront, collection pages automatically show only the allowed variant option values in the product card variant pills — pre-selected, with the correct image, price (including compare-at), and click-through URL resolved entirely server-side (no client-side flash).

### Layout

```
apps/variant-filter-app/
├── shopify.app.toml                    # App URL, scopes, TAE handle
├── wrangler.toml                       # Cloudflare Worker config + KV namespace
├── server.ts                           # Cloudflare Worker entry
├── package.json
├── app/
│   ├── root.tsx                        # Remix root shell + top-level ErrorBoundary
│   ├── shopify.server.ts               # shopifyApp() factory, KV session storage, afterAuth hook
│   ├── routes/
│   │   ├── _index.tsx                  # Redirect /  →  /app
│   │   ├── app.tsx                     # <AppProvider> layout shell
│   │   ├── app._index.tsx              # Collections list with inline Clear (Polaris Modal confirm)
│   │   ├── app.collections.$id.tsx     # Rule editor (set / clear via Polaris Modal confirm)
│   │   ├── auth.$.tsx                  # OAuth callback
│   │   ├── auth.login.tsx              # Login page
│   │   └── webhooks.tsx                # APP_UNINSTALLED handler
│   ├── components/
│   │   ├── RuleBadge.tsx               # Green badge when rule is active
│   │   ├── RuleEditor.tsx              # Form: type picker + option select + values input
│   │   ├── RuleTypePicker.tsx          # ChoiceList: exact / contains / size_range
│   │   └── ValueTagInput.tsx           # Tag-style multi-value text input
│   ├── graphql/
│   │   ├── collections.server.ts       # LIST_COLLECTIONS, GET_COLLECTION_WITH_RULE, GET_PRODUCT_OPTIONS
│   │   └── metafields.server.ts        # SET_RULE (metafieldsSet), DELETE_RULE (metafieldsDelete), REGISTER_DEFINITION
│   └── models/
│       └── rule.server.ts              # FilterRuleSchema (Zod), parseRule(), FilterRule type
└── extensions/
    └── variant-filter-tae/             # Theme App Extension
        ├── shopify.extension.toml
        ├── blocks/
        │   └── collection-filter-badge.liquid  # Optional storefront badge (shows active rule label)
        ├── snippets/
        │   ├── filter.liquid           # Decides whether to skip a variant option value
        │   ├── precheck.liquid         # Detects when the rule doesn't match any value (bypass)
        │   └── preselect.liquid        # Returns the best matching variant ID for the rule
        └── locales/
```

### Filter rule types

| Type | How it works |
|------|-------------|
| `exact` | Shows option values that exactly match one of the listed strings |
| `contains` | Shows option values whose name contains one of the listed substrings (e.g. "Litre" matches "1 Litre", "2 Litre") |
| `size_range` | Shows option values with a volume ≤ max ml; parses numeric prefix from values like "100ml", "1L" |

Rules are stored as JSON in a `variant-filter.rule` metafield on the Collection object (type `json`, storefront access `PUBLIC_READ`).

### How server-side pre-selection works

The TAE snippets are copied into the theme's `snippets/` directory as `variant-filter--*.liquid` so they can be called with Liquid `render` from non-TAE template files. The theme resolves the rule variant server-side in four places:

| File | What it does |
|------|-------------|
| `snippets/product-card.liquid` | Resolves `variant_to_link` — the overlay link href — to the rule variant's URL |
| `snippets/card-gallery.liquid` | Lifts the rule variant's featured media to DOM slide 0 so the correct image is painted on first load |
| `snippets/price.liquid` | Renders price + compare-at markup for the rule variant (full structural rebuild, not text replace) |
| `snippets/variant-buttons.liquid` | Pre-checks the rule variant's pill and moves it to first position via flexbox `order: -1` |
| `blocks/product-title.liquid` | Points the title link href at the rule variant's URL |

When a user clicks a variant pill, the AJAX response (`section-rendering-product-card`) passes `vf_skip_rule: true` to `price` and `variant-buttons` so the user's selection is honoured instead of being overridden by the rule.

### Setup (first time)

```bash
cd apps/variant-filter-app
npm install
shopify app dev
```

This starts the local Shopify tunnel and Cloudflare Worker dev server simultaneously. On first OAuth, the `afterAuth` hook auto-registers the `variant-filter.rule` metafield definition.

### Deploy

**Both surfaces must be deployed when you change admin UI or TAE snippets:**

```bash
# Ship everything (rebuilds Remix bundle, deploys Worker, then deploys TAE):
npm run deploy

# Only the embedded admin UI (changed app/routes/, app/components/, etc.):
npm run deploy:worker

# Only the TAE snippets (changed extensions/variant-filter-tae/):
npm run deploy:extension
```

> **Important:** `shopify app deploy` alone does **not** update the Cloudflare Worker (the embedded admin UI). You must run `npm run deploy:worker` (which does `remix vite:build && wrangler deploy`) whenever app route or component code changes. Skipping this is why admin UI changes can appear "not to land" even after multiple `shopify app deploy` runs.

### GraphQL API notes

The app targets **Admin API 2025-04**. Key mutations:

- **`metafieldsSet`** — create or update a rule. Takes `[{ ownerId, namespace, key, type, value }]`.
- **`metafieldsDelete`** (plural) — delete a rule by `{ ownerId, namespace, key }`. The singular `metafieldDelete` (by GID) was **removed in API 2025-01**; do not use it.
- **`metafieldDefinitionCreate`** — called once in `afterAuth` to register the formal definition; safe to call repeatedly (ALREADY_EXISTS is ignored).

### Error handling

- **GraphQL `userErrors`** are surfaced to merchants as a Polaris `Banner tone="critical"` in both the list and editor routes.
- **Unhandled exceptions** (loader/action throws) are caught by the root `ErrorBoundary` in `app/root.tsx` and rendered as a styled recovery page with the actual error message — not the bare "Application Error" string.
- **Clear rule confirmation** uses a Polaris `Modal` (not the native browser `confirm()`) so the dialog matches the embedded admin style.

### Theme files owned by this feature

These files in the repo root must be kept in sync with the TAE snippets and protected in `.gitattributes`:

| File | Role |
|------|------|
| `snippets/variant-filter--preselect.liquid` | Copy of TAE `preselect.liquid` for use by theme Liquid |
| `snippets/variant-filter--precheck.liquid` | Copy of TAE `precheck.liquid` |
| `snippets/variant-filter--filter.liquid` | Copy of TAE `filter.liquid` |
| `snippets/variant-buttons.liquid` | Variant pill picker with rule pre-selection and `vf_skip_rule` support |
| `snippets/card-gallery.liquid` | Gallery with rule-priority media at slide 0 |
| `snippets/price.liquid` | Price/compare-at rendering using rule variant |
| `snippets/product-card.liquid` | Overlay link href resolved to rule variant |
| `blocks/variant-buttons.liquid` | Block schema + settings for the pill picker |
| `blocks/_product-card.liquid` | Schema extended: `variant-buttons` + `buy-buttons` in allowed children, `hide_quick_add` setting |
| `blocks/product-card.liquid` | Default preset: gallery → variant pills → title → price → buy-buttons |
| `blocks/product-title.liquid` | Title link href resolved to rule variant |
| `assets/variant-buttons.js` | `<variant-buttons-component>` custom element; overrides `buildRequestUrl` to force `section_id=section-rendering-product-card` |
| `assets/product-card.js` | Extended: `variantPicker` getter includes `variant-buttons-component`; `updatePrice` falls back to first price container |
| `sections/section-rendering-product-card.liquid` | AJAX target: renders `variant-buttons` + `price` with `vf_skip_rule: true` |
| `templates/collection.json` | Preset config: includes `variant-buttons` + `buy-buttons` blocks, `hide_quick_add: true` |
| `templates/search.json` | Same preset config as collection |
| `locales/en.default.schema.json` | Schema label keys for `variant_buttons`, `hide_quick_add`, pill styling settings |

Full integration detail: `apps/variant-filter-app/theme-integration/INTEGRATION_GUIDE.md`
