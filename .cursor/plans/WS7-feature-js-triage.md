# WS7 — Feature JS Triage: TRACK vs ADOPT vs REBUILD/DROP

> Companion to `.cursor/plans/WS7-frontend-rework-adr.md`. Compares ownership options
> for Horizon's ~70 feature JS files given the goal: a one-of-a-kind custom theme that
> keeps Horizon's engine but replaces the presentation layer. ADOPT files' markup
> contracts migrate to Rocky vocabulary over time as each surface is redesigned.
>
> Line counts and content are at the adoption baseline (`adoption-baseline-v3.5.1`,
> upstream `70c27a8`). Upstream v4.x feature-JS changes were deliberately not taken
> (see ADR "history-only merge"); consult them per-file with
> `git diff adoption-baseline-v3.5.1..upstream/main -- assets/<file>`.

## 1. The three options, precisely

| | **TRACK** | **ADOPT** | **REBUILD / DROP** |
|---|---|---|---|
| What it means | File stays in the engine manifest; diffed each release. | Frozen at the adoption baseline as Rocky's starting point. Modify freely — rename custom elements, reshape markup contracts. Upstream changes ignored (or consulted as *reference*, never merged). | Delete. REBUILD = write a Rocky `r-*.js` component on the same engine. DROP = feature not carried forward. |
| Markup obligation | Liquid must permanently reproduce upstream's exact DOM contract (tag, `ref=`, `on:` methods, `data-*`). | None — the contract becomes yours. | None — contract defined from scratch. |
| Who owns bugs | Shopify (fixes inherited on sync). | Rocky (inherits the baseline's battle-tested state). | Rocky, including edge cases upstream already solved. |
| Rework freedom | Lowest — actively constrains redesign. | High — start from working code. | Total, at blank-page cost. |
| Per-release cost | Diff + compat review, forever. | Zero mechanical; optional changelog skim. | Zero. |

**Traps:** *Over-TRACK* handcuffs the redesign to markup you don't control.
*Over-REBUILD* re-discovers years of edge-case handling (cart API error paths, URL
state, a11y announcements) in production. **Sweet spot for a very custom theme:
ADOPT-then-reshape.** The moment you meaningfully modify a tracked file you've
converted it to ADOPT-with-extra-steps anyway — better to make ADOPT the honest
default. TRACK is reserved for code run unmodified: the engine.

## 2. Per-file triage

Legend: **ADOPT** = freeze & own · **REBUILD** = replace with Rocky component ·
**DROP** = not carried forward · **(D?)** = drop candidate pending design.

### Commerce core — ADOPT (the logic is the value)

| File | Lines | Call | Why |
|---|---|---|---|
| `product-form.js` | 781 | **ADOPT** | Highest edge-case density (add-to-cart, cart errors, morph integration, live regions). Never blank-page it. |
| `facets.js` | 843 | **ADOPT** | Filtering, URL/history state, re-render races. |
| `variant-picker.js` | 505 | **ADOPT** | Rocky already extends this space (`variant-buttons.js`). |
| `product-card.js` | 631 | **ADOPT** | Already Rocky-modified (de-facto adopted). |
| `predictive-search.js` | 430 | **ADOPT** | Fetch/a11y/keyboard skeleton worth keeping under custom search UX. |
| `paginated-list.js` | 355 | **ADOPT** | Pairs with facets. |
| `quick-add.js` | 343 | **ADOPT** | Cart-adjacent logic. |
| `component-cart-items.js` | 334 | **ADOPT** | Subject of Rocky's morph escape-hatch work. |
| `component-quantity-selector.js` | 297 | **ADOPT** | Small, everywhere. |
| `localization.js` | 552 | **ADOPT** | Logic-heavy, low churn. |
| `gift-card-recipient-form.js` | 414 | **ADOPT** | Shopify-API-shaped. |
| `quick-order-list.js` | 556 | **ADOPT or DROP** | Only if quick order lists are used. |

### Cart cluster — ADOPT (already heavily Rocky-invested)

`cart-drawer.js` (131 — own it and fix `auto-open` properly), `cart-icon.js` (134),
`cart-discount.js` (203), `cart-note.js` (46), `cart-progress-bar.js` (112),
`cart-quick-add.js` (100), `component-cart-quantity-selector.js` (38),
`local-pickup.js` (79) — all **ADOPT**. `cart-free-gift.js` (261) **ADOPT or DROP**
(promo roadmap). `fly-to-cart.js` (80) **REBUILD or DROP** (pure flourish).

Note: upstream v4.x shipped "cart drawer reliability" fixes — worth a reference diff
when the cart surface is reworked.

### PDP media & info — mixed (design-driven)

| File | Lines | Call |
|---|---|---|
| `media-gallery.js` | 95 | **REBUILD** — signature surface, tiny file |
| `media.js` | 248 | **ADOPT** — video/model plumbing under any gallery |
| `zoom-dialog.js` / `drag-zoom-wrapper.js` | 289/510 | **ADOPT (D?)** — gesture handling is fiddly |
| `sticky-add-to-cart.js` | 359 | **REBUILD** — presentation-dominant |
| `product-price.js` / `product-sku.js` / `product-inventory.js` | 82/67/39 | **ADOPT** — tiny `variant:update` listeners |
| `volume-pricing.js` / `volume-pricing-info.js` / `price-per-item.js` | 20/69/134 | **ADOPT or DROP** |
| `product-recommendations.js` | 155 | **ADOPT** |
| `recently-viewed-products.js` | 35 | **ADOPT** (inline-script dependency in `scripts.liquid`) |
| `product-title-truncation.js` | 86 | **DROP** — typography belongs to the new design (upstream deleted it in v4.x too) |
| `product-custom-property.js` | 33 | **ADOPT** |
| `product-hotspot.js` | 338 | **DROP (D?)** |

### Header / navigation — REBUILD (signature surface, most markup-entangled)

`header.js` (274), `header-menu.js` (393), `header-drawer.js` (188),
`header-actions.js` (39) — **REBUILD** (also frees the `utilities.js` header-coupling
caveat in the engine manifest). `overflow-list.js` (386) **ADOPT** (generic
overflow-collapse primitive). `announcement-bar.js` (130) **REBUILD or ADOPT**.

### Marketing / decorative — REBUILD or DROP (Horizon's voice, replaced by Rocky's)

`slideshow.js` (943) **REBUILD, or ADOPT internals as an `r-carousel` engine** —
biggest call in this tier; generic sliders are genuinely hard (a11y, touch, autoplay).
`layered-slideshow.js` (602), `marquee.js` (276), `jumbo-text.js` (199),
`collection-links.js` (232) — **DROP**. `comparison-slider.js` (157) **DROP (D?)**.
`video-background.js` (32), `accordion-custom.js` (107) — **ADOPT** (generic).

### Small primitives — ADOPT (near-engine, markup-light)

`anchored-popover.js` (132), `floating-panel.js` (63), `copy-to-clipboard.js` (26),
`auto-close-details.js` (15), `show-more.js` (162), `results-list.js` (78),
`search-page-input.js` (49), `paginated-list-aspect-ratio.js` (171, D?),
`blog-posts-list.js` (10), `rte-formatter.js` (29), `qr-code-generator.js` /
`qr-code-image.js` (1663/35 — gift-card only, vendored) — all **ADOPT**.

### New v4.x reference assets (unloaded; manifest candidates)

`standard-actions-override.js`, `page-view-event.js`, `view-event-elements.js`,
`theme-drawer.js`, `scroll-container.js`, `disclosures-summary-fit.js` + the
`*.d.ts` type defs — kept inert by the 2026-07 history-only merge. Evaluate for the
engine manifest at the first engine sync (see manifest "candidates" section).

*(Rocky-owned `r-*.js`, `variant-buttons.js`, `cart-bumpers.js` are outside the
triage — already ours.)*

## 3. Tally

| Call | Count | Consequence |
|---|---|---|
| TRACK | 14 files (~4,900 lines) | The only recurring upstream obligation (engine manifest). |
| ADOPT | ~38 files | Frozen at baseline; reshaped incrementally; contracts migrate to Rocky vocabulary. |
| REBUILD | ~8 | Header cluster + signature surfaces. |
| DROP | ~8 | Horizon's decorative voice. |

Net: upstream-sync surface shrinks from 63 protected paths + whole-tree merges to
~14 engine files diffed per release.
