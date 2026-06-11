# Release Notes

---

## v3.5.0-rocky — WS0 Wishlist + WS1 Variant Filter (April 2026)

This Rocky-fork release introduces the **Variant Filter** system: a custom Shopify embedded app that lets merchants define per-collection variant filter rules, with fully server-side product card pre-selection — zero client-side flash.

### Added

* **`apps/variant-filter-app/`** — new Shopify embedded app (Remix + Cloudflare Worker + Polaris UI):
  * Collections list showing active rules; per-collection rule editor (exact / contains / size range filter types).
  * Polaris Modal confirmation for destructive "Clear rule" action (replaces native `confirm()`).
  * Green success Banner on save; critical Banner with API error message on failure.
  * Top-level `ErrorBoundary` in `app/root.tsx` — unhandled loader/action exceptions now render a styled recovery page instead of the bare "Application Error" string.
  * `metafieldsDelete` mutation (plural) for rule removal — compatible with Admin API 2025-04+ (the deprecated singular `metafieldDelete` was removed in 2025-01).
  * Typed GraphQL response interfaces throughout; eliminated `as any` casts except two documented workarounds for nested `@shopify/shopify-api` version mismatches.
  * `npm run deploy` script rebuilds the Remix bundle and deploys the Cloudflare Worker (`deploy:worker`) then the TAE extension (`deploy:extension`) in one command.

* **`extensions/variant-filter-tae/`** — Theme App Extension with three snippets:
  * `preselect.liquid` — returns the best rule-matching variant ID for the current product and collection.
  * `precheck.liquid` — returns `"bypass"` when the rule doesn't match any option on the product.
  * `filter.liquid` — returns `"skip"` for option values excluded by the rule.
  * `blocks/collection-filter-badge.liquid` — optional storefront badge displaying the active rule label.

* **`snippets/variant-filter--preselect.liquid`**, **`--precheck.liquid`**, **`--filter.liquid`** — theme-accessible copies of the TAE snippets (Liquid `render` cannot call TAE snippets from non-TAE templates).

* **`snippets/variant-buttons.liquid`** — text-pill variant picker for product cards:
  * Calls `variant-filter--preselect`; the matching pill is pre-checked and moved to first position via flexbox `order: -1`.
  * Accepts `vf_skip_rule: true` (from AJAX renders) to honour the user's selection instead of the collection rule.

* **`blocks/variant-buttons.liquid`** — block schema and style settings (font size, padding, border width for selected state, color scheme).

* **`assets/variant-buttons.js`** — `<variant-buttons-component>` custom element (extends `VariantPicker`); overrides `buildRequestUrl` to force `section_id=section-rendering-product-card` for AJAX pill updates.

### Changed

* **`snippets/card-gallery.liquid`** — calls `variant-filter--preselect` and moves the rule variant's `featured_media` to DOM slide 0 (first rendered image), eliminating any client-side image swap on load. Gallery link href also points to the rule variant's URL.

* **`snippets/price.liquid`** — calls `variant-filter--preselect` and renders the full price + compare-at markup for the rule variant from the initial server render (structural rebuild, not text replace). Accepts `vf_skip_rule: true` for the AJAX path.

* **`snippets/product-card.liquid`** — resolves `variant_to_link` (overlay link href) to the rule variant's URL on initial load.

* **`blocks/_product-card.liquid`** — schema extended: `variant-buttons` and `buy-buttons` added to allowed child blocks; `hide_quick_add` setting added.

* **`blocks/product-card.liquid`** — default preset rebuilt to `_product-card-gallery → variant-buttons → product-title → price → buy-buttons`; `hide_quick_add: true`; quick-add hidden via `--quick-add-display: none`.

* **`blocks/product-title.liquid`** — calls `variant-filter--preselect`; title anchor href points to the rule variant's URL so clicking the title opens the PDP at the correct variant.

* **`assets/product-card.js`** — `variantPicker` getter extended to also match `<variant-buttons-component>`; `updatePrice` falls back to `priceContainers[0]` when index `[1]` is absent.

* **`sections/section-rendering-product-card.liquid`** — renders `variant-buttons` and `price` with `vf_skip_rule: true` so AJAX responses from pill clicks honour the user's selection.

* **`templates/collection.json`**, **`templates/search.json`** — preset updated: includes `variant-buttons` and `buy-buttons` blocks; `hide_quick_add: true`.

* **`locales/en.default.schema.json`** — schema label keys added: `variant_buttons`, `hide_quick_add`, `padding_block`, `padding_inline`, `border_width_selected`, `font_size`.

* **`.gitattributes`** — all new and modified files added with `merge=ours` to protect them from upstream Horizon merges.

* **`.cursor/references/gitattributes-merge-strategy.md`** — updated to document all new paths and rationale.

* **`apps/README.md`** — expanded to cover both apps (`rocky-wishlist-app` and `variant-filter-app`) with architecture overview, file layout, setup, and deploy instructions.

* **`apps/variant-filter-app/theme-integration/INTEGRATION_GUIDE.md`** — rewritten to document the Rocky fork's actual server-side architecture (no manual snippet patching required), rule lifecycle, AJAX feedback loop, TAE sync process, upstream merge checklist, and deployment reference.

### Fixes

* **Application Error on rule removal** — root cause was the deprecated `metafieldDelete` mutation (removed in Admin API 2025-01). Replaced with `metafieldsDelete` (by `ownerId + namespace + key`).
* **Compare-at price not displaying correctly** — price was previously replaced via text substitution which could not add/remove the compare-at `<span>` structure. Fixed by making `price.liquid` directly rule-aware and rendering the correct markup from the server.
* **Product card links opening wrong variant** — the overlay link, gallery link, and title link now all resolve to the rule variant's URL on initial load. Previously only the overlay link was updated.
* **Product card image showing wrong variant on load** — fixed by reordering `media_list_to_show` in `card-gallery.liquid` so the rule variant's media is physically DOM slide 0, keeping the slideshow's internal state aligned with the visual display.
* **`onKeyDown` TS error in `ValueTagInput`** — Polaris 13's `TextField` doesn't expose `onKeyDown`. Wrapped the field in a `<div onKeyDown>` to catch keyboard events via bubbling.
* **Missing `vite/client` types** — added to `tsconfig.json` `types` array so `*.css?url` imports type-check correctly.
* **Stale Cloudflare Worker deploys** — `shopify app deploy` was being used alone, which only ships the TAE. Added `deploy:worker` and `deploy` scripts to `package.json` that force a fresh `remix vite:build` before `wrangler deploy`.

---

## v3.5.1 (upstream Horizon)

Various fixes to translation strings and better support for "Split showcase" section on small screens.

### Fixes and improvements

* [Accessibility] Fixed header logo alt text bug caused by translation strings
* [Performance] Color swatch rendering improvement for combined listing products
* [Split Showcase] Stop content overlap when blocks wrap on mobile
* [Collections] Added missing translations strings for price filtering components

---

## v3.4.0 (upstream Horizon)

### Added

* [Header] Added text style for header links (Search, Account and Cart)
* [Product card] Added width control settings for desktop and mobile

### Changed

* [Header] Changed existing account menu in favor of new web component version
* [Accessibility] Marked the footer section as a semantic footer element
* [Accessibility] Improved accessibility of the header menu with better aria roles
* [Product] Allow product details column to expand on larger viewports
* [Product] Display single-value variant options as text instead of dropdown
