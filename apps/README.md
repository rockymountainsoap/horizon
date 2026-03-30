# Apps — Shopify (`rocky-wishlist-app`)

This directory holds the **Rocky native wishlist** Shopify app (WS0). The Horizon theme stays at the **repository root**; app code lives here to avoid mixing with theme merge rules.

## Layout

```
apps/rocky-wishlist-app/
├── shopify.app.toml              # App proxy, scopes, OAuth redirect
├── package.json                  # npm workspaces → extensions/*
├── README.md
└── extensions/
    ├── wishlist-button/                # Theme app extension (PDP block)
    │   ├── assets/
    │   │   ├── wishlist-button.js      # Toggle logic, guest state, session cache
    │   │   └── wishlist-button.css     # Button + active/loading states
    │   ├── blocks/
    │   │   └── wishlist-button.liquid  # App block (draggable in theme editor)
    │   └── locales/
    │       ├── en.default.json         # Storefront (`| t` in Liquid)
    │       └── en.default.schema.json  # Theme editor (`t:` keys in {% schema %})
    ├── customer-account-wishlist/      # Customer Account UI — full page
    │   ├── src/
    │   │   └── FullPageExtension.jsx   # Full wishlist with product grid + remove
    │   └── locales/
    │       └── en.default.json
    └── wishlist-profile-block/         # Customer Account UI — profile card
        ├── src/
        │   └── ProfileBlockExtension.jsx
        └── locales/
            └── en.default.json
```

## First-time setup

1. Edit **`shopify.app.toml`**: verify `client_id`, worker URL, `app_proxy.url`, `auth.redirect_urls`.
2. Deploy **`workers/native_worker`** and complete OAuth install — see `workers/native_worker/README.md`.
3. From this directory:

   ```bash
   npm install
   shopify app dev
   ```

4. Install the app on a dev store with **New customer accounts**; request **Protected customer data** Level 1.

## Deploy to production

```bash
shopify app deploy --allow-updates
```

Verify in Partner Dashboard → Apps → rocky-wishlist-app → Versions.

## Theme integration (repo root)

- **`snippets/r-header-wishlist.liquid`** — header wishlist icon + mini-drawer (includes guest merge-on-login in `r-header-wishlist.js`).
- **`assets/r-header-wishlist.js`** — header wishlist logic (fetch, render, add-to-cart).
- PDP wishlist UI comes from the **wishlist-button** theme app block (add via theme editor after app install).

## Key architecture decisions

- **Customer Account UI extensions — two GraphQL surfaces:** `useApi().query()` is routed to the **Storefront API** only. Reads/writes to **customer metafields** and `metafieldsSet` must use `fetch('shopify://customer-account/api/2025-04/graphql.json', …)`. Using `useApi().query()` for `customer { metafield(...) }` fails silently or errors because that is not a Storefront schema. See `extensions/customer-account-wishlist/src/customerAccountGraphql.js`.
- **Customer Account extensions use `metafieldsSet`** (Customer Account API) for remove — not App Proxy `fetch('/apps/wishlist/remove')`, because extensions run on `shopify.com` and App Proxy is on the storefront host (and would lack HMAC/session context from the extension worker).
- **PDP button uses App Proxy** (`/apps/wishlist/add`) for logged-in customers, `localStorage` for guests.
- **Guest-to-account sync** runs from `r-wishlist-header` (`_mergeGuestList` in `r-header-wishlist.js`).

## Reference

Architecture and security checklist: `.cursor/plans/WS0-native-wishlist.md`

The **Cloudflare Worker** lives at **`workers/native_worker/`** (entry `native_worker.js` → `src/index.js`).
