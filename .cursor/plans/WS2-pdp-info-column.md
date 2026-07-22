# WS2 — PDP Info Column (product details rework)

## Context

The PDP gallery is done (`blocks/r-pdp-gallery.liquid` — see the carousel work). This
workstream rebuilds the **info column** (the `_product-details` side) to match the
approved desktop + mobile mockups (Cold-pressed Bar Soap / Juicy Orange).

Today's info column is minimal: title → price → variant-picker (global buttons) →
buy-buttons → accordion (Description / Ingredients / Sustainability / How to use /
Find in Store). The mockups add breadcrumbs, a badge, a scent subtitle, review
placement, a "Made with" list, a combined-listing scent dropdown, a display-only
skin-type taxonomy line, a native one-time/subscribe toggle, and merchant-editable
guarantee links + modals — and restructure the price/description/reviews/made-with
area into a **two-column cluster that persists on mobile**.

All decisions below are confirmed with the user.

---

## Layout

The info column has a prominent **two-column intro cluster** that stays two-column on
mobile (only the breakpoints narrow):

**Desktop** (info column = right half of page; gallery left)
```
Soap — Bar Soap                                    ← breadcrumb, top, right-aligned
[BEST SELLER]
Cold-pressed Bar Soap                              ← h1
JUICY ORANGE                                       ← scent subtitle
┌ col A (~60%) ─────────────┬ col B (~40%) ───────┐
│ $7.95                     │ ★★★★★  4.9 / 5       │  ← reviews top-aligned ~price row
│ A cold-process bar soap…  │ Made with           │
│ …craftsmanship.           │ Fair trade, organic │
│ Show less                 │ Vitamin C rich …    │
│                           │ Gentle calendula …  │
└───────────────────────────┴─────────────────────┘
SIZE   [100g] 180g 1.9kg                           ← variant option, buttons
SCENT  Juicy Orange ▾                              ← combined-listing, dropdown
SKIN TYPE  Oily                                    ← taxonomy, display-only
QTY  − 1 +        ● One-time  ○ Subscribe          ← native selling-plan toggle
[ Add to bag ]                                     ← (no "Deliver to me")
LOVE IT OR RETURN IT · FREE SHIPPING OVER $60 CAD  ← links → modals
▸ Ingredients  ▸ Sustainability  ▸ How to use  ▸ Find in Store
```

**Mobile** — gallery on top, then the same order stacked; the intro cluster keeps its
2-col split: `$7.95 | ★ 4.9/5` on one row, `description | made-with` on the next
(description ~60% left, made-with ~40% right, description collapsed → "Show more").

---

## Element inventory → data source → status

| Element | Source (confirmed) | Status |
|---|---|---|
| Breadcrumb "Soap — Bar Soap" | `product.type` + `product.category` (Shopify standard taxonomy) | 🔴 new |
| BEST SELLER badge | product **tag** (e.g. `Best Seller`) | 🔴 new |
| Title | `product.title` | ✅ exists |
| Subtitle "JUICY ORANGE" | product's **scent** = the combined-listing Scent option's selected value | 🔴 new |
| Price $7.95 | native price (`blocks/price.liquid`) | ✅ exists — reposition into col A |
| Reviews ★ 4.9/5 | `product.metafields.reviews.rating` + `reviews.rating_count` (Judge.me syncs); `blocks/review.liquid` | 🟡 exists, not placed — place in col B |
| Description (inline, Show more/less) | `product.description` via `r-pdp-description` | 🟡 exists **in accordion** → move **inline**, add truncation |
| **Made with** (ingredient list) | Shopify **standard-taxonomy category attribute** (list) — see Data contracts | 🔴 new |
| SIZE | variant option → **buttons** | ✅ exists |
| SCENT | **Combined Listing** → **dropdown** (auto-detect: option values with `product_url`) | 🟡 navigation supported; needs per-option rendering |
| SKIN TYPE "Oily" | Shopify **standard-taxonomy category attribute**, display-only | 🔴 new |
| QTY | `blocks/quantity.liquid` | ✅ exists |
| One-time / Subscribe | **native** selling-plan selector on `product.selling_plan_groups` (Loop plans). No "Deliver to me" frequency. | 🔴 new |
| Add to bag | `blocks/add-to-cart.liquid` (+ selling-plan id from toggle) | ✅ exists — extend |
| "LOVE IT OR RETURN IT" → modal | copy from **theme setting**; native `<dialog>` modal | 🔴 new |
| "FREE SHIPPING OVER $60 CAD" → modal | copy from **theme setting** (like existing free-shipping text); native `<dialog>` modal | 🔴 new |
| Accordion (Ingredients / Sustainability / How to use / Find in Store) | existing metafields | ✅ keep — **remove the Description row** (now inline). Drop "Useful information"/"Precautions" (not adopted). |

---

## Data contracts (define now; taxonomy values populated in production post-dev)

The user will **define and populate the taxonomy attributes after dev, in the
production store**. So build every taxonomy/metafield-driven element **defensively —
render only when the source is non-empty**, against a fixed contract:

- **Made with** and **Skin Type** — intended source is Shopify standard-taxonomy
  category attributes. ⚠️ **Liquid cannot reliably read standard-taxonomy attribute
  *values*** (`product.category` gives the category, not the selected attribute
  values). Build against a **metafield contract** that either is the taxonomy mirror
  or is populated directly:
  - `product.metafields.rocky.made_with` — list / multi-line (ingredient lines)
  - `product.metafields.rocky.skin_type` — single/list text
  - Verify the live Liquid access path against a real product first; if the standard
    attribute is readable, use it directly, else this metafield is the fallback. Either
    way the render gates on presence.
- **Badge** — product **tag** match (config the trigger tag, default `Best Seller`).
- **Subtitle scent** — read the combined-listing Scent option's `selected_value`;
  fallback `product.metafields.rocky.scent` if needed.
- **Guarantee copy** — **theme settings** (store-wide, rich text), e.g.
  `settings.rocky_free_shipping_text`, `settings.rocky_returns_text`, alongside the
  existing free-shipping default. Modals read these.
- **Breadcrumb** — `product.type` + `product.category.name` (no free text).

---

## Build order

**Phase 1 — layout shell + reposition existing**
1. New intro-cluster layout (2-col, persists on mobile) holding: badge, title,
   subtitle, then col A (price + inline description) / col B (reviews + made-with).
   Likely a Rocky snippet/section arranging these rather than loose group blocks.
2. Move **description inline** with Show more/less; **remove the Description row** from
   the accordion in `templates/product.json`.
3. Place the existing **review** block in col B; place **price** in col A.

**Phase 2 — new Rocky blocks (all `r-*`, gate on presence)** — ✅ DONE
4. `blocks/r-pdp-breadcrumbs.liquid` — `product.category` (+ ancestors) with
   `product.type` fallback; `source` and parent-depth are settings.
5. `blocks/r-pdp-badge.liquid` — tag-driven pill, case-insensitive match, optional
   label override.
6. `blocks/r-pdp-subtitle.liquid` — named option's `selected_value` (Scent), metafield
   fallback.
7. + 8. **Folded into one `blocks/r-pdp-attribute.liquid`** rather than two blocks —
   "Made with" and "Skin type" are the same shape (label + value(s) from a metafield),
   differing only in presentation. A `layout` setting switches `stacked` (label above a
   list) vs `inline` (label beside the value). This also means any *future* taxonomy
   attribute is a no-code addition.

Wired into `templates/product.json`: breadcrumbs + badge above the header, subtitle
inside the header under the title, "Made with" in intro col B under the review, and
"Skin type" as an inline row after the variant picker.

**Phase 3 — variant picker + subscriptions** — ✅ DONE
9. Edit `snippets/variant-main-picker.liquid`: auto-detect combined-listing options
   (values carry `product_url`) → render as **dropdown**; ordinary options (Size)
   stay **buttons**. (Adopted file — edit directly.)
   - DONE by extracting the dropdown markup into `snippets/variant-option-dropdown.liquid`
     (shared by the merchant "Dropdowns" style and combined options) and adding one
     `use_combined_dropdown` branch **before** the buttons branch — existing button/
     swatch conditions untouched, so zero regression risk. Verified: multi-value Size
     (baby-bum-balm 120g/60g) still renders buttons; no combined dropdown misfires.
   - ⚠️ Positive path (a real combined-listing Scent → dropdown navigating to siblings)
     is **not yet verifiable** — no dev-store product is a Combined Listing. Confirm once
     WS6 seeds one. The refactor is proven non-regressive.
   - **SIZE selector restyled to the mockup (underline, in `assets/r-base.css`,
     scoped to `.product-details`).** The button/pill style is reshaped, not replaced:
     the value labels lose their box/fill and Horizon's per-label sliding pill
     (`.variant-option__button-label__pill`) is reshaped into a 2px underline, so the
     selected value glides on select with the *exact* Horizon transition
     (`transform`, `--animation-speed` 0.125s / `--animation-easing`). Layout:
     **equal-width, stretched columns** (`display:grid; grid-auto-flow:column;
     grid-auto-columns:1fr`, forced so it holds regardless of the merchant's
     button-width setting), so the underline spans the full selected column and
     slides between equal columns. Corners are square — the label keeps
     `overflow: clip` (to mask the non-selected pills) so its `border-radius` must be
     zeroed or it rounds the underline's ends. The option name drops into a left
     label column via an absolutely-positioned `<legend>` (a legend can't be a
     flex/grid item; absolute keeps it an accessible group label); gutter is
     `--r-pdp-option-label-col` (5.5rem) so Scent/Skin-type can align to it later.
     Verified live on baby-bum-balm (120g/60g): equal-width, square-cornered
     underline slides between columns on select.
10. `blocks/r-pdp-subscribe.liquid` + `assets/r-pdp-subscribe.js` — native one-time/
    subscribe radio bound to `product.selling_plan_groups`; passes the selling-plan id
    into the product form / add-to-cart. No frequency dropdown.
    - DONE. The JS injects a hidden `selling_plan` input as a **direct child of the
      product form** (survives variant morphs, which only touch the button container);
      product-form serialises the whole form so the plan is carried on add-to-cart.
      Verified on `community-soap-grounded` (Loop "Subscribe and Save", plan 6333235422):
      Subscribe → FormData carries `selling_plan`; One-time → cleared. Gated off on
      products without plans (verified hidden on baby-bum-balm).

**Option-row redesign (mockup v2)** — ✅ DONE
- **Reorder Size above Scent**: `variant-main-picker.liquid` now renders options in
  two passes — ordinary options first, combined-listing (dropdown) options last — so
  Size sits above the Scent combined-listing dropdown. Verified on `cedarwood-soap`
  (a real combined listing: Scent dropdown + Size buttons).
- **Unified option rows** (`r-base.css`, scoped `.product-details`): SIZE / SCENT /
  SKIN TYPE / QTY share one olive uppercase label column (`--r-pdp-option-label-col`),
  each row a thin bottom rule, all values aligned. SIZE reverted to compact
  left-aligned values (the equal-width from the prior turn is gone) keeping the sliding
  underline; SCENT is a flat dropdown (box stripped, caret pinned right); SKIN TYPE is
  the display value. Consecutive option blocks are pulled flush (negative margin =
  `--r-pdp-block-gap`, must match the `_product-details` block gap) so the rows read as
  one continuous table rather than being spaced by the column gap.
- **QTY + One-time/Subscribe on one row**: `buy-buttons.liquid` renders a QTY row
  (label + stepper + a `data-r-subscribe-slot`); `r-pdp-subscribe.js` docks its toggle
  into that slot (the hidden `selling_plan` input still lives in the form). The stepper
  is flattened (no box) and Add to bag / Buy it now stack full-width beneath. Verified
  on `baby-bum-balm` (has plans → toggle docks) and `cedarwood-soap` (no plans → QTY
  alone).
- ⚠️ SKIN TYPE has **no caret** even though the mockup shows one — it is display-only,
  so a caret would falsely imply a dropdown. Flag for the user; trivial to add if they
  want the purely-visual chevron.

**Subscribe reveal panel** — ✅ DONE
- Selecting **Subscribe** now reveals a full-width panel below the QTY row with the
  delivery-frequency options (all `default_group.selling_plans` as pill radios), a
  benefits list, and a Learn-more link (URL is a block setting). One-time collapses it.
- Architecture (server-render, hydrate — **zero CLS**): `buy-buttons.liquid` renders
  the controls in their final positions via `{% render 'r-pdp-subscribe', part: … %}` —
  the `<r-pdp-subscribe>` toggle inline in the QTY row, the panel full-width below —
  gated on `product.selling_plan_groups`. `r-pdp-subscribe.js` is a pure coordinator:
  it never moves DOM (no docking), just wires the toggle + frequency changes to the
  hidden `selling_plan` input on the form and expands/collapses the panel. Toggle
  values are `onetime` / `subscribe`; the plan comes from the frequency radios
  (defaults to the first plan). Learn-more URL is a theme setting
  (`settings.pdp_subscribe_learn_more_url`, Rocky — Product page panel).
  - Earlier this used a JS "docking" model (element moved its parts into slots after
    load) which caused a visible load-time layout shift — the toggle first painted as
    its own row, then jumped into the QTY row. Retired in favour of server-rendering
    everything in place. Verified CLS = 0 via the Layout Instability API; the old block
    `blocks/r-pdp-subscribe.liquid` was replaced by `snippets/r-pdp-subscribe.liquid`.
- Animation uses Horizon's patterns: `grid-template-rows: 0fr→1fr` for height +
  staggered opacity/translateY on the content, timed with `--animation-speed-slow` /
  `--animation-easing`; `@media (prefers-reduced-motion: reduce)` disables it; the
  panel is `inert` while collapsed so its controls aren't focusable. Verified on
  `baby-bum-balm` (Loop "Subscribe and Save", 4 frequencies).
- Copy is placeholder/"mockup" per request (`rocky.pdp_subscribe.*`), lightly polished.

**Phase 4 — guarantees** — ✅ DONE
11. `blocks/r-pdp-guarantees.liquid` — two links → two native `<dialog class="dialog-modal">`
    modals composing Horizon's `<dialog-component>` (showDialog/closeDialog, focus trap,
    scroll-lock; `dialog.js` is loaded globally in `scripts.liquid`). Copy from theme
    settings; a link hides when its label setting is blank. Verified: links render
    ("Love it or return it · Free shipping over $60 CAD"), modal opens with the settings
    copy, closes on Escape / close button.
12. Added a dedicated **"Rocky — Product page"** panel to `config/settings_schema.json`
    with `pdp_returns_label`/`pdp_returns_body` and `pdp_shipping_label`/`pdp_shipping_body`
    (richtext bodies).

**Regression fixed during this pass (grounding on the live PDP)**
- The intro two-column cluster was frozen in its single-column fallback: Phase 2 folded
  "Made with" into the shared `r-pdp-attribute` block (class `.r-pdp-attribute`), but
  `r-base.css` still keyed the cluster off the old `.r-pdp-made-with` class, so
  `:has(.r-pdp-made-with)` never matched. Updated the three selectors → the native
  56%/38% two-column layout now materialises when Made-with is present. Verified live.

All new files use the `r-` prefix, `color-{{ scheme }}`, `{% stylesheet %}`, and
`t:`/`rocky.*`/`r_*` locale keys per `forked-theme-standards.mdc`.

---

## Resolved during Phase 2 (supersedes the ⚠️ in Data contracts)

- **`product.category` IS readable in Liquid.** It is a `taxonomy_category` object
  exposing `name`, `ancestors[]` (leaf→root), `id`, `gid`. The breadcrumb uses it
  directly, so no metafield mirror is needed for the trail.
- **Taxonomy attribute values are `list.metaobject_reference` metafields.** Render them
  with `metafield_tag: field: '…'` (→ `<ul><li>`) or `metafield_text: field: '…'`
  (→ "A, B, and C"). The `field` parameter is required and must name a
  `single_line_text_field` on the metaobject — hence the block's `value_field` setting
  (default `label`).
- **Dashed handles require bracket notation.** `shopify.skin-type` must be read as
  `product.metafields['shopify']['skin-type']`; with dot notation Liquid applies a
  built-in filter to the namespace instead of reading the metafield. The block always
  uses bracket lookup, so dashed taxonomy handles are safe.
- **Liquid has no array-append filter.** `push` does not exist (theme-check catches it
  as `UnknownFilter`). Build lists by accumulating a delimited string and `split`ting.

## Dev-store data gap — CLOSED 2026-07-21 by WS6

> **Seeded by `WS6-dev-store-data-seeding.md`.** The dev store
> (`rocky-horizon-development`) was enriched from production
> (`rocky-soap-development`) across a 60-product slice. The data→render path is now
> verifiable positively. Historical note preserved below.

**Historical (pre-seed):** no dev product had any theme-consumed metafield populated,
so Phase 2 blocks could only be verified **negatively** (clean hide) and by injecting
emitted markup. That gap is now closed for the seeded slice.

**What WS6 seeded (resolved facts):**
- **Made with** — there is **no dedicated standard-taxonomy attribute** for it. The
  closest taxonomy attributes (`Ingredients` = `TaxonomyAttribute/1385`,
  `Constitutive ingredients` = `1629`) are **unused in production (0 products)**. The
  real data path is the **`rocky.made_with` fallback**, populated from production
  `descriptionHtml` ("KEY INGREDIENTS AND BENEFITS" blocks) where present, generated
  and tagged `seed:synthetic` otherwise. → `made-with` block `key` stays **blank** by
  design; the fallback is the source of truth.
- **Skin type** — real taxonomy handle is **`suitable-for-skin-type`**, NOT `skin-type`.
  `templates/product.json` was corrected (`key: "skin-type"` → `"suitable-for-skin-type"`).
  Primary path seeded on `perfect-pair-box` (taxonomy metaobject `all-skin-types`);
  `rocky.skin_type` fallback seeded broadly from "Best for:" lines.
- **Scent** — `shopify.scent` maps to taxonomy attribute **Fragrance** (`1637`); values
  are `shopify--fragrance` metaobjects carrying a globally-portable
  `product_taxonomy_value_reference`. 16 fragrance metaobjects provisioned on dev and
  attached to 18 products (**exercises the `shopify.*` primary path**). `rocky.scent`
  subtitle seeded too.
- **Badge** — production has **no `Best Seller` tag**; real tags are `best-seller` (10)
  and `best-sellers` (44). Shopify **silently drops tags containing a space**, so the
  old `tag: "Best Seller"` default could never match. Fixed: badge `tag` →
  `best-sellers` with `label: "Best Seller"` (template instance + block default/preset).
- **Combined listing** — `bath-bombs` parent rebuilt on dev with a `Scent` option and
  all 8 scent children linked (mirrors production).
- **Reviews** — production `reviews.rating`/`rating_count` **mirrored verbatim** for 54
  products; 4 lacking them stubbed.

## Refactor / quality pass — 2026-07-22 ✅

Comprehensive sweep over the whole branch (self-audit + independent adversarial
review of the full diff). Fixed:
- **Broken scent-trigger aria-label** — snippet referenced `rocky.pdp.scent_choose`
  but the key lived at `rocky.pdp_options.scent_choose` (rendered "Translation
  missing"). Then superseded: dropped the aria-label entirely — it hid the current
  scent from screen readers; the accessible name is now "Scent <current value>"
  via a visually-hidden option-name span. Row label became a plain `<span>`
  (was a `<label for>` pointing at the aria-hidden select).
- **Mobile description fade on short copy** — the clamp+mask applied even when the
  copy fit (`data-fits`), permanently fading the last lines with no toggle to
  reveal them. Clamp/mask now gated on `:not([data-fits])`. Also `#000` → `rgb(0 0 0)`.
- **`aria-haspopup="dialog"`** added to all drawer triggers (matches the cart trigger).
- **Dead code removed**: orphaned schema keys from the deleted subscribe block
  (`names.r_pdp_subscribe`, `content.r_pdp_subscribe_info`), unused
  `scent_choose` storefront key, duplicate `min-width: 0`, dead `href="#"` on
  Learn-more (link now hidden when the theme setting is blank).
- **Standards**: new `{%- # r: … -%}` marker in buy-buttons reworded to a plain
  `{% comment %}` (handbook forbids adding new `r:` markers).
- Review verified clean: all locale/schema keys resolve, no duplicate ids, JS
  listeners all cleaned up in disconnectedCallback, no tracked-engine edits, no
  raw hex in Rocky CSS (gallery's deliberate dark-glass rgb() noted, left as-is),
  `.r-bleed` utilities intentionally unused (documented infrastructure).

**Verification trap discovered (cost real time, now in agent memory):** CSS layout
transitions FREEZE in hidden/background Chrome tabs (rendering pauses) — the
subscribe panel's grid 0fr→1fr reveal read as "stuck at 0" in automation and was
temporarily rewritten to a JS-measured height animation before the cause was found
(`visibilityState: hidden`, 0 rAF frames). Reverted to the original CSS-only grid
reveal (verified at 277px in a visible tab). Assert end-states with transitions
disabled when the tab may be hidden. The scent drawer's synchronous URL mirror was
kept (idempotent with the engine's deferred update, which can stall in
deprioritized contexts).

## Desktop layout refinement — balance + smart sticky — 2026-07-22 ✅

**Column balance (fluid, premium).** The media/details split is no longer
proportional (`2fr 1fr` ≈ 67/33 oversized the gallery). Final form (matched to the
approved mockup, which measures ≈49/51 imagery/info): the MEDIA column is the
anchor — `--r-shell-pdp-media-col: minmax(0, 48vw)` keeps the gallery just under
half the viewport — and the details pane absorbs the remainder
(`minmax(26rem, 1fr)`; on wide screens the extra room reads as whitespace right
of the copy, like the mockup). Verified 49/51 at 1687px (media 48% of viewport).
The fluid rule now starts at **990px** (was 1200) so the step from the 750–989
`--sidebar-width` band is small. Tune from the GLOBAL PAGE SHELL block in
`r-base.css` (50vw = even halves, 45vw = smaller gallery).

**Smart sticky (abouolia/sticky-sidebar behaviour, native).** A May-era
`<r-sticky-sidebar>` element already bottom-pinned a too-tall details column;
upgraded to the full dual-direction behaviour with a delta-clamp on native
`position: sticky`'s `top`: `top ∈ [vh − colH − bottomSpacing, headerOffset]`,
slid by the scroll delta — down-scroll travels then pins the BOTTOM edge,
up-scroll re-engages and pins the TOP edge, container bounds guaranteed by native
sticky. No transforms (compositor-smooth), zero writes while parked at either pin.

**Key insight:** on this PDP the gallery is a fixed-height hero, so the details
column is usually the TALLEST pane — a sticky details column has zero travel
slack. The pane that needs pinning is the **media column**. Both columns are now
`<r-sticky-sidebar>` (media always, in `product-information-content.liquid` with
the load-bearing `align-self: start`; details via its existing block setting) —
the engine only engages where slack exists, so whichever pane is shorter pins
automatically. Verified live: gallery bottom (thumbnail rail) pins at viewport
bottom scrolling down, re-engages and top-pins scrolling up, bounded at section
end. CLS 0.

Verification note: the boot rAF, scroll events, and `scroll-behavior: smooth`
scrolls are all frozen in hidden tabs — drive `_setup()`/`_travel()` manually and
use `behavior: 'instant'` when measuring there (see hidden-tab memory).

## Spacing rhythm pass — matched to mockup — 2026-07-22 ✅

Measured the approved mockup's vertical gaps and matched them (live-verified px):
breadcrumb↔badge 44 (was 28) · title↔subtitle 12 (was 4) · price↔description and
review↔made-with 24 (were 12/16, keeps the two intro columns row-aligned) ·
intro↔SIZE 60 with the **divider block removed** (mockup separates the option
cluster with whitespace, not a rule — first rule on the page is under SIZE) ·
guarantees↔accordion 52+pad (was 28). Implemented as template gap settings
(header 12, intro cols 24) plus a documented "PDP vertical rhythm" block in
r-base.css (breadcrumb margin, variant-picker + accordion margin-block-start
layered on the uniform 28px column gap). QTY↔buttons already matched (20).

## Typography unification — 2026-07-22 ✅

The PDP info column had font sizes "all over the place": labels split 13/14 (row
labels 13 but subtitle + made-with 14), values split 14/16 (SIZE 14 but SCENT +
SKIN 16), plus raw `0.85rem`/`0.9em`/`0.7em`/`0.75rem` and drifted token fallbacks
(`0.8rem` vs the real `0.8125rem`, `0.9rem` vs `0.875rem`) scattered across files.

Fixed with a **two-token PDP type scale** on `.product-details`:
`--r-pdp-label-size: var(--font-size--xs)` (13px, all uppercase micro-labels) and
`--r-pdp-value-size: var(--font-size--sm)` (14px, all body/values/controls). Every
Rocky PDP file now routes its font-size through one of these two tokens — single
source of truth, tunable from two lines. Live-verified: **all 7 measured labels =
13px, all 8 measured values = 14px**, zero outliers. Also swept raw-hex color
fallbacks in the touched files (`#555` → `rgb(var(--color-foreground-rgb)/…)`);
`<sup>` kept at `0.7em` (correct relative superscript). Cart-bumper `.r-cart-*`
sizes are a separate component, left untouched. theme-check clean, CLS unaffected.

## Open / follow-up
- **Selling plan group (Phase 4 / WS6 Group 7) — NOT seeded.** `sellingPlanGroupCreate`
  requires `write_own_subscription_contracts`, which the Shopify CLI's `store auth` app
  **cannot grant on this store** (OAuth `missing_shopify_permission`). Install a
  subscription app (Loop / Shopify Subscriptions) via the admin UI, or use a custom-app
  token carrying the scope, then attach a group to one product. The theme reads the
  native `product.selling_plan_groups`, so any mechanism works.
- Confirm Judge.me is populating `product.metafields.reviews.*` in production (dev now
  carries mirrored/stubbed values so stars render).
- `gift-card` was created on dev as a lightweight `productType: "Gift Card"` product
  (tagged `seed:synthetic`) to exercise the `r-pdp-description` gift-card branch — it is
  not a real Shopify gift card.

## Verification
- `shopify theme dev -e dev`, product `evergreen-bottle` (and a Bar Soap w/ scents).
- Desktop + mobile: 2-col intro cluster holds price/description (A) and reviews/made-with
  (B) and stays 2-col on mobile; description Show more/less works.
- Combined-listing Scent dropdown navigates to sibling scent products; Size stays buttons.
- One-time/Subscribe sets the selling plan; Add to bag adds the right line.
- Guarantee links open the right modals with theme-setting copy; focus trap + restore.
- Taxonomy/metafield-gated elements (badge, made-with, skin-type, subtitle) **hide
  cleanly when empty**.
- `theme check` — no new offenses vs baseline.
