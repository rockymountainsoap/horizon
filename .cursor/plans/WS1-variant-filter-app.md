# WS1 — Shopify Collection Variant Filter App

**Status**: Planning complete — ready to implement  
**Planned**: 2026-04-24  
**Location**: `apps/variant-filter-app/` (monorepo, alongside `rocky-wishlist-app`)

---

## What This Is

A Shopify embedded app that lets merchants define per-collection variant filter rules. When a rule is active, only the specified variant option values appear in the product card swatches, buttons, and dropdowns on the collection storefront — enforced entirely server-side in Liquid, no JavaScript.

---

## Architecture: Three Layers

| Layer | Technology | Purpose |
|---|---|---|
| Remix app | Cloudflare Workers + KV | Admin UI, OAuth, metafield writes |
| Metafield | `app--variant-filter / rule` (JSON, COLLECTION) | Stores the filter rule per collection |
| Theme App Extension | TAE (`variant-filter`) | Storefront badge block + filter logic snippet |

---

## Key Decisions (locked during planning)

| Decision | Choice | Reason |
|---|---|---|
| Repository location | `apps/variant-filter-app/` | Monorepo alongside wishlist app |
| Session storage | Cloudflare KV (`@shopify/shopify-app-session-storage-kv`) | No database needed — sessions are simple KV pairs |
| Metafield namespace | `app--variant-filter` | Human-readable, avoids `$app` complexity |
| TAE extension handle | `variant-filter` | Snippet deployed as `variant-filter--filter.liquid` |
| Integration guide scope | Generic Horizons (not Rocky-specific) | Reusable across any Horizons install |
| Option field in admin UI | Dropdown populated from store's product options | Better UX than free-text |
| Quick-clear from collection list | Yes | Confirmed |
| API version | `2025-04` | Matches existing wishlist app |

---

## Rule JSON Schema

```typescript
type FilterType = "exact" | "contains" | "size_range";

type FilterRule =
  | { filterType: "exact";      option: string; values: string[]; label: string }
  | { filterType: "contains";   option: string; values: string[]; label: string }
  | { filterType: "size_range"; option: string; maxMl: number;    label: string };
```

`size_range` limitation: uses Liquid `| plus: 0` to extract a leading integer from the option value name. Works correctly for ml-unit values (`"100ml"` → 100). Returns `1` for `"1L"` — a false positive. Documented constraint: `size_range` requires ml-unit option values.

---

## Final Directory Tree

```
apps/variant-filter-app/
│
├── app/
│   ├── routes/
│   │   ├── _index.tsx                      # Redirect → /app
│   │   ├── app.tsx                         # Authenticated layout shell
│   │   ├── app._index.tsx                  # Collection list + quick-clear action
│   │   ├── app.collections.$id.tsx         # Rule editor (save + clear actions)
│   │   └── webhooks.tsx                    # APP_UNINSTALLED handler
│   │
│   ├── components/
│   │   ├── CollectionList.tsx              # IndexTable with pagination + quick-clear
│   │   ├── RuleEditor.tsx                  # Form: type picker + inputs + save/clear
│   │   ├── RuleTypePicker.tsx              # ChoiceList: exact | contains | size_range
│   │   ├── ValueTagInput.tsx               # Tag input serialised to hidden JSON field
│   │   └── RuleBadge.tsx                   # Inline "Active — 1L only" / "No rule"
│   │
│   ├── graphql/
│   │   ├── collections.server.ts           # LIST_COLLECTIONS, GET_COLLECTION_WITH_RULE
│   │   └── metafields.server.ts            # REGISTER_DEFINITION, SET_RULE, DELETE_RULE
│   │
│   ├── models/
│   │   └── rule.server.ts                  # FilterRule type + Zod discriminatedUnion + parseRule()
│   │
│   ├── shopify.server.ts                   # createShopify(kvNamespace) factory
│   └── root.tsx                            # Polaris AppProvider + Remix root
│
├── extensions/
│   └── variant-filter-tae/
│       ├── blocks/
│       │   └── collection-filter-badge.liquid   # Storefront badge app block
│       ├── snippets/
│       │   ├── filter.liquid                    # Per-value filter logic → "skip" or ""
│       │   ├── precheck.liquid                  # Per-option pre-pass → "bypass" or ""
│       │   └── preselect.liquid                 # First rule-allowed variant id → "" or numeric id
│       ├── locales/
│       │   ├── en.default.json
│       │   └── en.default.schema.json
│       └── shopify.extension.toml
│
├── theme-integration/                           # Reference docs — NOT deployed
│   ├── INTEGRATION_GUIDE.md
│   ├── variant-swatches-patch.liquid
│   ├── variant-main-picker-patch.liquid
│   └── product-card-patch.liquid
│
├── public/
│   └── shopify.svg
├── package.json
├── shopify.app.toml
├── wrangler.toml
├── server.ts                                    # Cloudflare Worker entry point
├── tsconfig.json
├── vite.config.ts
└── .env.example
```

---

## Required Access Scopes

```toml
scopes = "read_collections,read_products,write_metafields,write_metafield_definitions"
```

`write_metafield_definitions` is required for the `afterAuth` registration step. Without it the mutation returns `PERMISSION_REQUIRED`.

---

## Metafield Registration (`afterAuth`)

Runs on every OAuth completion (install + reinstall). Idempotent — `ALREADY_EXISTS` is treated as success.

```graphql
mutation RegisterVariantFilterDefinition($definition: MetafieldDefinitionInput!) {
  metafieldDefinitionCreate(definition: $definition) {
    createdDefinition { id namespace key }
    userErrors { field message code }
  }
}
```

Variables:
```json
{
  "namespace": "app--variant-filter",
  "key": "rule",
  "name": "Variant Filter Rule",
  "type": "json",
  "ownerType": "COLLECTION",
  "access": { "storefront": "PUBLIC_READ" }
}
```

`access.storefront: "PUBLIC_READ"` is mandatory — without it `collection.metafields['app--variant-filter']['rule']` returns nil in all Liquid templates.

Error handling:
- `ALREADY_EXISTS` → log + return (idempotent)
- `UNSTRUCTURED_ALREADY_EXISTS` → throw (merchant must delete stale metafield manually)
- `PERMISSION_REQUIRED` → throw (scope misconfiguration)

---

## Admin UI GraphQL Operations

### List collections (paginated, 50/page)

```graphql
query ListCollections($first: Int!, $after: String, $before: String) {
  collections(first: $first, after: $after, before: $before, sortKey: TITLE) {
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    edges {
      node {
        id title handle
        image { url(transform: { maxWidth: 48, maxHeight: 48 }) altText }
        metafield(namespace: "app--variant-filter", key: "rule") { value }
      }
    }
  }
}
```

### Get one collection with rule

```graphql
query GetCollectionWithRule($id: ID!) {
  collection(id: $id) {
    id title handle
    metafield(namespace: "app--variant-filter", key: "rule") { id value }
  }
}
```

### Get product option names (populates the option dropdown in RuleEditor)

```graphql
query GetProductOptions($first: Int!) {
  products(first: $first) {
    edges {
      node {
        options { name }
      }
    }
  }
}
```

Deduplicate option names client-side after fetching. Fetch 50 products — covers almost all stores' option vocabulary.

### Save rule

```graphql
mutation SetVariantFilterRule($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { id namespace key value }
    userErrors { field message code }
  }
}
```

Input constructed in the action:
```typescript
{
  ownerId:   `gid://shopify/Collection/${params.id}`,
  namespace: "app--variant-filter",
  key:       "rule",
  type:      "json",
  value:     JSON.stringify(validatedRule),  // Zod-validated FilterRule
}
```

### Clear rule

```graphql
mutation DeleteVariantFilterRule($metafieldId: ID!) {
  metafieldDelete(input: { id: $metafieldId }) {
    deletedId
    userErrors { field message }
  }
}
```

---

## TAE Extension Config

```toml
# extensions/variant-filter-tae/shopify.extension.toml
api_version = "2025-04"

[[extensions]]
type   = "theme"
name   = "Variant Filter"
handle = "variant-filter"
```

TAE snippets deploy to the merchant's theme as `variant-filter--{filename}.liquid`:
- `snippets/filter.liquid` → `variant-filter--filter`
- `snippets/precheck.liquid` → `variant-filter--precheck`

---

## TAE Snippet: `snippets/filter.liquid`

Called inside every `for product_option_value` loop. Outputs `"skip"` or `""`.

Key behaviours:
- `vf_bypass = true` (passed as parameter) → outputs nothing → all values show (no-match fallback)
- `vf_rule == blank` → outputs nothing → all values show (no rule, app not installed, malformed JSON)
- `vf_rule.option != product_option.name` → outputs nothing → other options unaffected
- `values == blank` for exact/contains → outputs nothing → fail open
- `maxMl == blank or 0` for size_range → outputs nothing → fail open
- `size_range` with non-numeric string (`"Large"`) → `| plus: 0` = 0, 0 ≤ maxMl → shows (correct)

Render call from upstream snippets:
```liquid
{%- capture vf_skip -%}
  {%- render 'variant-filter--filter',
      product_option: product_option,
      product_option_value: product_option_value,
      vf_bypass: vf_bypass -%}
{%- endcapture -%}
{%- unless vf_skip == 'skip' -%}
  ... existing value rendering ...
{%- endunless -%}
```

`collection` is accessed directly inside the snippet — it is a Shopify global Liquid object, available inside `{% render %}` tags without being passed explicitly.

---

## TAE Snippet: `snippets/precheck.liquid`

Called once per `product_option` in the outer loop, before the inner value loop. Outputs `"bypass"` if no values in this option pass the rule. This prevents an empty swatch/button group when a product has no matching variants for the active collection rule (fail-open for the whole product).

Render call from upstream snippets (outer loop):
```liquid
{%- capture vf_bypass_signal -%}
  {%- render 'variant-filter--precheck', product_option: product_option -%}
{%- endcapture -%}
{%- assign vf_bypass = false -%}
{%- if vf_bypass_signal == 'bypass' -%}{%- assign vf_bypass = true -%}{%- endif -%}
```

`vf_bypass` is then passed to every inner `render 'variant-filter--filter'` call.

---

## Theme Patches — Four Insertion Points

Three patches use the same precheck/filter structure on the variant rendering snippets.
A fourth patch on `snippets/product-card.liquid` adds rule-based variant pre-selection.

1. **Outer loop** (`for product_option`): add precheck + assign `vf_bypass`
2. **Inner loop** (`for product_option_value`): add capture/unless wrapper
3. **Product card** (`snippets/product-card.liquid`): render `variant-filter--preselect` and override `variant_to_link`

### File 1: `snippets/variant-swatches.liquid`

Already registered as `merge=ours` in `.gitattributes` (line 69). ✓

**Outer loop** — after `{%- for product_option in product_resource.options_with_values -%}` (line 86):
```liquid
{%- # r: variant-filter app — pre-check if any values match for this product -%}
{%- capture vf_bypass_signal -%}
  {%- render 'variant-filter--precheck', product_option: product_option -%}
{%- endcapture -%}
{%- assign vf_bypass = false -%}
{%- if vf_bypass_signal == 'bypass' -%}{%- assign vf_bypass = true -%}{%- endif -%}
```

**Inner loop** — after `{%- for product_option_value in product_option.values -%}` (line 104):
```liquid
{%- # r: variant-filter app — skip values excluded by collection rule -%}
{%- capture vf_skip -%}
  {%- render 'variant-filter--filter',
      product_option: product_option,
      product_option_value: product_option_value,
      vf_bypass: vf_bypass -%}
{%- endcapture -%}
{%- unless vf_skip == 'skip' -%}
```

Before `{%- endfor -%}` (line 162):
```liquid
{%- endunless -%}
```

---

### File 2: `snippets/variant-main-picker.liquid`

**Must be added to `.gitattributes`** before editing:
```
snippets/variant-main-picker.liquid merge=ours
```
Also add a row to `.cursor/references/gitattributes-merge-strategy.md`.

Contains two inner loops — both need patching.

**Outer loop** — after `{%- for product_option in product_resource.options_with_values -%}` (approx. line 36):
Same precheck block as above.

**Inner loop A (buttons/swatches)** — after `{%- for product_option_value in product_option.values -%}` (line 83):
Same capture/unless block as above, with `vf_bypass` passed.
Close `{%- endunless -%}` before `{%- endfor -%}` (line 147).

**Inner loop B (dropdowns)** — after `{%- for product_option_value in product_option.values -%}` (line 186):
Same capture/unless block. Close before `{%- endfor -%}` (line 203).

---

### File 3: `snippets/product-card.liquid`

Already registered as `merge=ours` in `.gitattributes` (line 66). ✓

Replace the line `assign variant_to_link = product.selected_or_first_available_variant`
with the pre-selection block (see `apps/variant-filter-app/theme-integration/product-card-patch.liquid`).

This makes the product card link (`<a href="{{ variant_to_link.url }}">`) and the
view-transition `featured_media_url` honour the rule's preferred variant. Price and
swatch checked state on the rendered card still resolve through Shopify's default
`product.selected_or_first_available_variant` — matched up post-click via the existing
`swatches-variant-picker-component` fetch flow.

Also requires `apps/variant-filter-app/extensions/variant-filter-tae/snippets/preselect.liquid`.

---

## Graceful Degradation Summary

Every failure mode degrades to "show all variants":

| Failure | Why it's safe |
|---|---|
| App not installed | `collection.metafields[...]` → nil → `vf_rule == blank` → no output |
| TAE snippet missing | `{% render 'missing-snippet' %}` → `""` in production → `vf_skip != 'skip'` → shows |
| Malformed JSON | Shopify JSON parser returns nil → same as no rule |
| `values` field missing | Explicit nil-guard → fail open |
| `maxMl` field missing or zero | Explicit nil-guard → fail open |
| Non-collection page | `collection` is nil → `nil.metafields[...]` → nil → shows all |
| Product with no matching variants | Precheck snippet outputs `"bypass"` → inner filter skipped → all values show |
| Theme update overwrites patches | `merge=ours` prevents this for Rocky; audit command for others |

---

## Cloudflare Worker Config

```toml
# wrangler.toml
name = "variant-filter-app"
main = "build/server/index.js"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

[[kv_namespaces]]
binding = "SESSION_KV"
id = "<production-namespace-id>"

[env.preview]
[[env.preview.kv_namespaces]]
binding = "SESSION_KV"
id = "<preview-namespace-id>"
```

Session storage wired via `new KvSessionStorage(env.SESSION_KV)` inside the `createShopify(kvNamespace)` factory. The factory is called per-request from `server.ts` (the Cloudflare Worker entry point) with `env.SESSION_KV` from the Worker context.

---

## Data Flow (condensed)

```
WRITE PATH (merchant):
  Browser → Cloudflare Worker (Remix)
           → KV session lookup
           → Shopify Admin GraphQL API
           → Shopify stores metafield on collection

READ PATH (customer):
  Browser → Shopify CDN (~60s cache TTL)
           → Liquid renderer reads collection.metafields['app--variant-filter']['rule']
           → filter.liquid outputs "skip" or "" per option value
           → HTML rendered with only matching values
           → No JavaScript. No Cloudflare. No KV.
```

KV and Cloudflare Worker are write-path only. The read path is entirely within Shopify's infrastructure.

---

## Edge Cases Quick Reference

| Edge case | Handling |
|---|---|
| No product variant matches rule | Precheck → bypass → show all (fail open) |
| Malformed JSON (missing fields) | Nil-guards in filter.liquid → fail open |
| `size_range` with "1L" values | Known limitation — extracts `1`, false positive. Use `exact` for liter-unit products. |
| Multiple options (Size + Color) | Filter only applies to named option. Others unaffected. |
| Pre-selected variant is filtered | No radio/button appears selected — acceptable v1 UX |
| Non-collection page | `collection` is nil → all variants show |
| Quick-add modal | Does not render a variant picker — no patch needed |
| Combined listings | Don't filter the connecting option — document in admin UI |

---

## Implementation Order

1. `shopify app init` using Remix + Cloudflare Workers template
2. Wire `wrangler.toml` + KV namespace
3. `shopify.server.ts` factory function
4. `afterAuth` → `registerMetafieldDefinition()` 
5. Admin UI routes + components (collection list → rule editor)
6. `shopify app dev` — verify OAuth + metafield registration
7. TAE extension: `shopify.extension.toml` + `filter.liquid` + `precheck.liquid` + badge block
8. Apply three theme patches (outer + inner loops in both upstream snippets)
9. `shopify app deploy` — verify TAE snippet appears in theme
10. End-to-end: set a rule in admin → visit collection page → confirm filtered variants
