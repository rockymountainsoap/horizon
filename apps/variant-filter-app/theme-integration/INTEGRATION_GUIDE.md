# Variant Filter App — Theme Integration Guide

> **Rocky Mountain Soap fork status:** The integration described in this guide is **already applied** to this repository. This document explains the architecture, where each piece lives, and what to check when pulling upstream Horizon updates. It also serves as a reference if the integration ever needs to be re-applied to a fresh Horizon fork.

---

## Architecture overview

The variant filter system works across three layers:

```
┌─────────────────────────────────────────┐
│  Shopify Admin (embedded app)           │
│  Merchant sets a rule per collection:   │
│  "Show only Size = 1 Litre"             │
│  → stored as collection metafield       │
│    namespace: variant-filter            │
│    key: rule  (JSON, PUBLIC_READ)       │
└────────────────┬────────────────────────┘
                 │ metafield read at render time
┌────────────────▼────────────────────────┐
│  Theme App Extension snippets           │
│  (copied into theme snippets/ dir)      │
│  • variant-filter--preselect.liquid     │
│  • variant-filter--precheck.liquid      │
│  • variant-filter--filter.liquid        │
└────────────────┬────────────────────────┘
                 │ render calls from theme files
┌────────────────▼────────────────────────┐
│  Theme (Horizon fork — repo root)       │
│  Server-side, zero client-side flash:   │
│  • Card overlay link  → rule variant URL│
│  • Gallery image      → rule variant    │
│  • Price / compare-at → rule variant    │
│  • Variant pills      → rule pill first │
│  • Title link         → rule variant URL│
└─────────────────────────────────────────┘
```

The entire pre-selection is **server-rendered**. There is no client-side swap or flash on page load.

---

## Prerequisites

1. The Variant Filter app is installed on the store.
2. The app has been deployed at least once:

   ```bash
   cd apps/variant-filter-app
   npm run deploy
   ```

3. The TAE snippets exist in the theme's `snippets/` directory as `variant-filter--*.liquid`.  
   These are **copies** of the TAE extension snippets, maintained manually to match.  
   See [Keeping TAE snippets in sync](#keeping-tae-snippets-in-sync).

---

## Rocky fork: what is already done

All theme file patches are committed and protected. No manual editing is required.

### New files (Rocky-owned, no upstream equivalent)

| File | Purpose |
|------|---------|
| `snippets/variant-filter--preselect.liquid` | Returns the rule-matching variant ID for a product in the current collection context |
| `snippets/variant-filter--precheck.liquid` | Returns `"bypass"` when no option values match the rule (so all values render) |
| `snippets/variant-filter--filter.liquid` | Returns `"skip"` for a specific option value when the rule excludes it |
| `snippets/variant-buttons.liquid` | Variant pill picker for product cards; respects rule pre-selection |
| `blocks/variant-buttons.liquid` | Block schema + style settings for the pill picker |
| `assets/variant-buttons.js` | `<variant-buttons-component>` custom element |

### Modified upstream files

| File | What changed |
|------|-------------|
| `snippets/product-card.liquid` | Calls `variant-filter--preselect` to set `variant_to_link` (overlay link href) to the rule variant's URL |
| `snippets/card-gallery.liquid` | Calls `variant-filter--preselect`; lifts the rule variant's `featured_media` to DOM slide 0 so the correct image is shown on first load; sets gallery link href to the rule variant's URL |
| `snippets/price.liquid` | Calls `variant-filter--preselect` to select the rule variant and renders its full price + compare-at markup (structural rebuild, not text replace). Accepts `vf_skip_rule: true` from AJAX paths |
| `blocks/_product-card.liquid` | Schema: added `variant-buttons` and `buy-buttons` to allowed child blocks; added `hide_quick_add` setting |
| `blocks/product-card.liquid` | Default preset rebuilt: `_product-card-gallery → variant-buttons → product-title → price → buy-buttons`; `hide_quick_add: true` |
| `blocks/product-title.liquid` | Calls `variant-filter--preselect`; points title link href at the rule variant's URL |
| `assets/product-card.js` | `variantPicker` getter extended to match `<variant-buttons-component>`; `updatePrice` falls back to first price container |
| `sections/section-rendering-product-card.liquid` | Renders `variant-buttons` and `price` with `vf_skip_rule: true` so AJAX updates honour the user's pill click, not the collection rule |
| `templates/collection.json` | Preset: includes `variant-buttons` and `buy-buttons` blocks; `hide_quick_add: true` |
| `templates/search.json` | Same changes as `collection.json` |
| `locales/en.default.schema.json` | Added schema label keys: `variant_buttons`, `hide_quick_add`, pill style settings |

### `.gitattributes` protection (obsolete)

> **WS7 (2026-07):** the `merge=ours` registry and whole-tree upstream merges are
> retired — these files are plainly Rocky-owned and no registration is needed. See
> `.cursor/plans/WS7-frontend-rework-adr.md`. The historical steps below no longer apply.

---

## Rule lifecycle

### Creating / editing a rule

1. Open the Variant Filter admin app from the Shopify Partners dashboard or the store's Apps page.
2. Find the collection in the list and click **Set rule** (or **Edit**).
3. Choose a filter type, option, values, and a display label, then click **Save rule**.
4. The rule is stored as a `variant-filter.rule` collection metafield (JSON, storefront-public).
5. The storefront picks up the change on the next page render — no theme republish needed.

### Clearing a rule

1. Click **Clear** on the collections list (or **Clear rule** in the editor).
2. A Polaris confirmation modal asks for confirmation.
3. On confirm, the `metafieldsDelete` mutation removes the metafield.
4. The collection immediately shows all variants again.

### Filter types

| Type | Behaviour |
|------|-----------|
| `exact` | Shows option values that exactly match one of the listed strings (case-sensitive) |
| `contains` | Shows option values whose name contains any of the listed substrings |
| `size_range` | Shows option values with a volume ≤ the max ml; parses numeric prefix from values like `"100ml"`, `"500ml"`, `"1L"` |

`precheck.liquid` returns `"bypass"` when the rule's option doesn't match any option on the product (e.g. the product doesn't have a Size option), so all values render normally.

---

## How the AJAX variant-pill update works

When a shopper clicks a variant pill on a product card, the `<variant-buttons-component>` (a subclass of `VariantPicker`) fires a Section Rendering API request to `section-rendering-product-card`. The response morphs the card's price, gallery, and pill markup.

To prevent the collection rule from overriding the shopper's selection during this AJAX re-render:

- `section-rendering-product-card.liquid` passes `vf_skip_rule: true` to both `variant-buttons` and `price`.
- With `vf_skip_rule: true`, both snippets skip the `variant-filter--preselect` call and use `product.selected_or_first_available_variant` instead, which the Section Rendering API resolves to the variant the shopper clicked (via `?option_values=` in the request URL).

The `buildRequestUrl` override in `assets/variant-buttons.js` ensures the request always includes `section_id=section-rendering-product-card`.

---

## Keeping TAE snippets in sync

The three `snippets/variant-filter--*.liquid` files are **manual copies** of the TAE extension snippets in `extensions/variant-filter-tae/snippets/`. Liquid's `render` tag cannot call TAE snippets from a regular theme context, so copies are required.

When TAE snippet logic is updated:

1. Edit the source in `extensions/variant-filter-tae/snippets/<name>.liquid`.
2. Copy the updated content to `snippets/variant-filter--<name>.liquid` (keeping the `--` prefix).
3. Deploy the TAE: `npm run deploy:extension` (from `apps/variant-filter-app/`).
4. Deploy the theme: `shopify theme push`.

**Diff checklist after any TAE snippet change:**

- [ ] `variant-filter--preselect.liquid` returns the correct variant ID (prefer available variant over unavailable one).
- [ ] `variant-filter--precheck.liquid` returns `"bypass"` when no values match.
- [ ] `variant-filter--filter.liquid` returns `"skip"` for excluded values, empty string for allowed ones.
- [ ] Test on a collection with a rule, a collection without a rule, and a non-collection page (PDP, search).

---

## Upstream Horizon merge checklist

After running `git pull upstream main`:

1. **Check automatically preserved files.** Files in `.gitattributes` with `merge=ours` are kept as-is. Verify nothing was unexpectedly overwritten:
   ```bash
   git diff HEAD~1 -- snippets/product-card.liquid snippets/card-gallery.liquid snippets/price.liquid
   ```

2. **Check upstream changes to patched files.** Even though `merge=ours` preserves our version, upstream may have useful bug fixes in the same files. Review:
   - `snippets/variant-swatches.liquid` — does the option loop structure still match what `variant-filter--filter` expects?
   - `snippets/variant-main-picker.liquid` — same check.
   - `assets/product-card.js` — did upstream change `variantPicker` getter or `updatePrice`? Reapply our two extensions if so.
   - `sections/section-rendering-product-card.liquid` — did upstream add new render calls that should also be rule-aware?

3. **Test the storefront** on a collection with an active rule after any upstream merge.

---

## Testing

### Quick smoke test

```bash
shopify theme dev
```

1. Set a rule in the admin app (e.g. exact, option "Size", values ["1 Litre"]).
2. Visit the collection page on the dev theme.
   - Variant pill for "1 Litre" should be first (rule-preselected), others visible.
   - Product card image should show the 1 Litre variant image.
   - Price should show the 1 Litre variant price (and compare-at if on sale).
   - Clicking the card (overlay, title, or gallery image) should open the PDP at the 1 Litre variant.
3. Click a different pill (e.g. "500ml") — price and image should update via AJAX without reverting to 1 Litre.
4. Visit a collection with no rule — all variants render normally.
5. Visit a PDP or search page — all variants render normally (no collection context).
6. Clear the rule from the admin — all variants show on the next collection page load.

### Admin app smoke test

1. Open the Variant Filter app.
2. Confirm the collections list shows titles only (no collection images).
3. Click **Set rule** → configure and save → success banner appears.
4. Click **Clear** → Polaris modal appears (not a browser confirm) → confirm → rule removed, redirect to list.
5. Trigger an error (e.g. network off) → red Banner with message, not a bare "Application Error" page.

---

## Deployment reference

Run from `apps/variant-filter-app/`:

| Command | What it deploys |
|---------|----------------|
| `npm run deploy` | Builds React Router bundle + deploys Cloudflare Worker + deploys TAE |
| `npm run deploy:worker` | Builds React Router bundle + deploys Cloudflare Worker only (admin UI changes) |
| `npm run deploy:extension` | Deploys TAE only (storefront snippet / badge changes) |
| `shopify app dev` | Local dev (tunnel + Worker dev server) |

> `shopify app deploy` alone deploys only the TAE extension and app config — it does **not** ship the Cloudflare Worker. Always use `npm run deploy:worker` or `npm run deploy` when admin route/component code changes.
