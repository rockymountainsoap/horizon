# .gitattributes Merge Strategy

When merging from **upstream Horizon** (e.g. `upstream/main`), the repo uses `merge=ours` for selected paths so **our branch's version is kept** and upstream changes to those files do not overwrite Rocky-specific customizations.

## How It Works

- **`merge=ours`** = in a merge, keep the version from the branch you're merging **into** (our branch), not from the branch being merged in (upstream).
- Use when pulling from upstream: `git pull upstream main` (or merge `upstream/main` into your branch). Our customized files stay as-is; other files can receive upstream updates.

**One-time setup (required):** Git does not define the `ours` merge driver by default. Each developer (or CI) should run once:

```bash
git config merge.ours.driver true
```

Use `--global` to set for all repos, or omit to set for this repo only.

## Paths Included (and why)

| Area | Paths | Workstream / rationale |
|------|--------|-------------------------|
| **Config** | `config/settings_data.json`, `config/settings_schema.json` | Store-specific theme settings and schema extensions; should not be replaced by upstream. |
| **Layout** | `layout/theme.liquid` | Core shell: fonts, colours, scripts, structure (WS 0). |
| **Header / Nav** | `sections/header*.liquid`, `footer*.liquid`, `search-header`, `predictive-search*` | Global nav, mega menus, mobile drawer, footer (WS 1). |
| **Engine A** | `hero`, `main-collection`, `product-list`, `product-information`, `featured-product*`, `carousel`, `main-cart`, `section-rendering-product-card` | Homepage, PLP, PDP, mini-cart (WS 2–3). `section-rendering-product-card` is patched to render `variant-buttons` with `vf_skip_rule: true` so AJAX pill clicks honour the user's selection instead of being overridden by the collection rule. |
| **Journal / Content** | `main-blog*`, `featured-blog-posts`, `main-page`, `main-404`, `search-results` | Journal index, article template, pages, 404, search (WS 4). |
| **Templates** | `templates/*.json` (index, 404, product, collection, cart, blog, article, search, page, page.contact) | Section order and settings per page type; editor customizations live here. `collection.json` and `search.json` include the `variant-buttons` and `buy-buttons` blocks, and set `hide_quick_add: true`. |
| **Locale** | `locales/en.default.json`, `locales/en.default.schema.json` | Primary language copy and schema labels. `en.default.schema.json` includes keys for `variant_buttons`, `hide_quick_add`, and pill style settings. |
| **Snippets** | `stylesheets.liquid`, `theme-styles-variables`, `fonts`, `color-schemes`, header/cart/product-card snippets, `card-gallery`, `price`, `variant-swatches`, `variant-main-picker`, `quick-add*`, `add-to-cart-button`, `product-information-content` | Design tokens, stylesheet loader, and high-touch UI reused across sections.<br><br>**Variant-filter specific changes:**<br>• `card-gallery` lifts the rule variant's `featured_media` to DOM slide 0 so the correct product image is painted on first load with no client-side flash; gallery link href is also set to the rule variant URL.<br>• `price` calls `variant-filter--preselect` to render the correct price + compare-at markup (full structural rebuild, not text replace) for the rule variant. The AJAX path passes `vf_skip_rule: true` to honour the user's pill click instead.<br>• `product-card` resolves `variant_to_link` (overlay link href) to the rule variant's URL.<br><br>**Cart subscription toggle:** `cart-products.liquid` carries a `r-cart-line-subscription-toggle` script tag and per-line `{% render 'r-cart-line-subscription-toggle', item: item %}` call (both wrapped in `{%- # r: -%}` markers). The Rocky-owned snippet emits a switch that POSTs to `/cart/change.js` with `selling_plan` set/unset to convert the line between one-time and Loop subscription. |
| **Variant-filter TAE copies** | `snippets/variant-filter--preselect.liquid`, `snippets/variant-filter--precheck.liquid`, `snippets/variant-filter--filter.liquid` | Manual copies of the Theme App Extension snippets. Liquid's `render` tag cannot reach TAE snippets from regular theme templates; these copies make them available. Must be kept in sync with `apps/variant-filter-app/extensions/variant-filter-tae/snippets/`. |
| **Blocks** | `blocks/_product-card.liquid`, `blocks/product-card.liquid`, `blocks/product-title.liquid`, `blocks/_product-details.liquid` | `_product-card`: schema extended to allow `variant-buttons` + `buy-buttons` child blocks; `hide_quick_add` setting added. `product-card`: default preset rebuilt to `gallery → variant pills → title → price → buy-buttons`. `product-title`: resolves the rule variant URL for the title anchor so clicking the title opens the right variant's PDP. `_product-details`: when `sticky_details_desktop` is on, the block root renders as `<r-sticky-sidebar>` (driven by `assets/r-sticky-sidebar.js`) instead of a `<div>`, and the column is pinned with native `position: sticky` while the taller media gallery scrolls past. All changes wrapped in `{%- # r: -%}` markers. |
| **Rocky assets** | `assets/r-base.css`, `assets/r-sticky-sidebar.js`, `assets/variant-buttons.js`, `blocks/variant-buttons.liquid`, `snippets/variant-buttons.liquid` | Rocky-owned; no upstream equivalent. `r-sticky-sidebar.js` defines `<r-sticky-sidebar>` — a thin helper around native `position: sticky` for the PDP details column. It adds no transform (transforming that text-heavy subtree jitters during scroll); the browser pins the column on the compositor. JS only sets a negative inline `top` for columns taller than the viewport (bottom-pin), recomputed on resize/`ResizeObserver` — never per scroll frame. `variant-buttons.liquid` renders text-pill variant pickers in product cards with rule pre-selection support and a `vf_skip_rule` opt-out for the AJAX path. `variant-buttons.js` defines `<variant-buttons-component>` and overrides `buildRequestUrl` to force `section_id=section-rendering-product-card`. |
| **Upstream JS we extend** | `assets/product-card.js` | Two surgical changes: the `variantPicker` getter also matches `<variant-buttons-component>`, and `updatePrice` falls back to the first `priceContainer` when index `[1]` is absent. If upstream rewrites these methods, reapply manually. |

## Adding or Removing Paths

- **Add:** If we customize a new file and want to keep our version on upstream merges, add a line:
  `path/to/file merge=ours`
- **Remove:** If we decide to track upstream for a file again, delete (or comment out) its line in `.gitattributes`.
- **New sections/snippets:** When a new workstream adds sections or snippets we fully own, add them to `.gitattributes` and to this table.

## Pitfalls

- **Merge direction:** `ours` is the branch you're on when you run `git merge`. So when we merge `upstream/main` **into** our branch, "ours" = our branch and those paths keep our version. If someone merges our branch into upstream, "ours" would be upstream; avoid that flow for these files.
- **Rebase:** `merge=ours` applies to **merges** only. Rebasing rewrites history and does not use this strategy; prefer merging upstream into our branch.
- **First-time setup:** Run `git config merge.ours.driver true` once (see "How It Works" above). Without this, `merge=ours` has no effect.
- **TAE snippet copies:** `snippets/variant-filter--*.liquid` are copies, not symlinks. If TAE logic changes, update both the source (`extensions/variant-filter-tae/snippets/`) and the copies (`snippets/variant-filter--*.liquid`).

## Upstream Merge Checklist

After `git pull upstream main`, verify:

- [ ] `merge=ours` files are intact (run `git diff HEAD~1 -- snippets/product-card.liquid snippets/card-gallery.liquid snippets/price.liquid`).
- [ ] Review upstream changes to patched files for useful bug fixes to cherry-pick.
- [ ] `variant-swatches.liquid` option loop structure unchanged (used by `variant-filter--filter`).
- [ ] `variant-main-picker.liquid` buttons and dropdown loop structure unchanged.
- [ ] `assets/product-card.js` `variantPicker` getter and `updatePrice` unchanged; reapply our extensions if not.
- [ ] `sections/section-rendering-product-card.liquid` — did upstream add new render calls that should also be rule-aware?
- [ ] Smoke-test a collection with an active filter rule on a dev theme.

## Reference

- Variant filter app docs: `apps/variant-filter-app/theme-integration/INTEGRATION_GUIDE.md`
- Apps overview: `apps/README.md`
- Git: [gitattributes — merge strategies](https://git-scm.com/docs/gitattributes#_defining_a_custom_merge_driver)
