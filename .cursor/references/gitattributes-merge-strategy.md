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

Mapped to the Phase 1 workback plan so only files we intentionally customize are protected.

| Area | Paths | Workstream / rationale |
|------|--------|-------------------------|
| **Config** | `config/settings_data.json`, `config/settings_schema.json` | Store-specific theme settings and schema extensions; should not be replaced by upstream. |
| **Layout** | `layout/theme.liquid` | Core shell: fonts, colours, scripts, structure (WS 0). |
| **Header / Nav** | `sections/header*.liquid`, `footer*.liquid`, `search-header`, `predictive-search*` | Global nav, mega menus, mobile drawer, footer (WS 1). |
| **Engine A** | `hero`, `main-collection`, `product-list`, `product-information`, `featured-product*`, `carousel`, `main-cart` | Homepage, PLP, PDP, mini-cart (WS 2–3). |
| **Journal / Content** | `main-blog*`, `featured-blog-posts`, `main-page`, `main-404`, `search-results` | Journal index, article template, pages, 404, search (WS 4). |
| **Templates** | `templates/*.json` (index, 404, product, collection, cart, blog, article, search, page, page.contact) | Section order and settings per page type; editor/customizations live here. |
| **Locale** | `locales/en.default.json`, `locales/en.default.schema.json` | Primary language copy and schema labels. |
| **Snippets** | `stylesheets.liquid`, `theme-styles-variables`, `fonts`, `color-schemes`, header/cart/product-card snippets, `variant-swatches`, `quick-add*`, `add-to-cart-button`, `product-information-content` | Design tokens, stylesheet loader (`r-base.css` is registered here), and high-touch UI reused across sections. |
| **Rocky assets** | `assets/r-base.css` | Rocky-owned; no upstream equivalent. Listed for explicit intent. |

## Adding or Removing Paths

- **Add:** If we customize a new file and want to keep our version on upstream merges, add a line:  
  `path/to/file merge=ours`
- **Remove:** If we decide to track upstream for a file again, delete (or comment out) its line in `.gitattributes`.
- **New sections/snippets:** When a new workstream adds sections or snippets we fully own, add them to `.gitattributes` and to this table.

## Pitfalls

- **Merge direction:** `ours` is the branch you're on when you run `git merge`. So when we merge `upstream/main` **into** our branch, "ours" = our branch and those paths keep our version. If someone merges our branch into upstream, "ours" would be upstream; avoid that flow for these files.
- **Rebase:** `merge=ours` applies to **merges** only. Rebasing rewrites history and does not use this strategy; prefer merging upstream into our branch.
- **First-time setup:** Run `git config merge.ours.driver true` once (see "How It Works" above). Without this, `merge=ours` has no effect.

## Reference

- Workback plan: Phase 1 workstreams 0–6 (Core, Global Nav, Engine A, Cart & Account, Journal, Data/QA).
- Git: [gitattributes – merge strategies](https://git-scm.com/docs/gitattributes#_defining_a_custom_merge_driver) (merge driver and `merge=ours` behaviour).
