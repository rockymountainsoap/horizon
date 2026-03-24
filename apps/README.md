# Apps — Shopify (`rocky-wishlist-app`)

This directory holds the **Rocky native wishlist** Shopify app (WS0). The Horizon theme stays at the **repository root**; app code lives here to avoid mixing with theme merge rules.

## Current layout (implemented)

```
apps/rocky-wishlist-app/
├── shopify.app.toml          # App proxy, scopes, $app:wishlist metafield declaration
├── package.json              # npm workspaces → extensions/*
├── README.md
└── extensions/
    ├── wishlist-button/              # Theme app extension (PDP block)
    ├── customer-account-wishlist/    # Customer Account UI — full page
    └── wishlist-profile-block/       # Customer Account UI — profile card
```

You **do not** need `shopify app init` if this tree is already present. If you prefer a fresh CLI scaffold, use a different folder name or merge the generated `shopify.app.toml` / extension UIDs into this project.

## First-time setup

1. Edit **`rocky-wishlist-app/shopify.app.toml`**: `client_id`, worker URL, `app_proxy.url`, `auth.redirect_urls`.
2. Deploy **`workers/native_worker`** (Wrangler) and set secrets — see `workers/native_worker/README.md`.
3. From `rocky-wishlist-app/`:

   ```bash
   npm install
   shopify app dev
   ```

4. Install the app on a dev store with **New customer accounts**; request **Protected customer data** Level 1.

## Theme integration (repo root)

- **`snippets/r-wishlist-init.liquid`** — guest wishlist merge on login; rendered from **`layout/theme.liquid`**.
- PDP wishlist UI comes from the **wishlist-button** theme app block (add via theme editor after app install).

## Reference

Architecture and security checklist: `.cursor/plans/WS0-native-wishlist.md`

The **Cloudflare Worker** lives at **`workers/native_worker/`** (entry `native_worker.js` → `src/index.js`).
